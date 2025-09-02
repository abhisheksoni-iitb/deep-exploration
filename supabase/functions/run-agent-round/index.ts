/*
  # Supabase Edge Function: run-agent-round
  
  This function handles individual agent responses in roundtable meetings.
  It processes different rounds (1, 2, 3) and generates appropriate responses using Gemini.
  
  ## Endpoint
  POST /functions/v1/run-agent-round
  
  ## Request Body
  ```json
  {
    "meetingId": "uuid - Meeting ID",
    "agentId": "string - Agent identifier", 
    "round": "number - Round number (1, 2, or 3)",
    "context": {
      "topic": "string - Discussion topic",
      "meetingGoal": "string - Meeting objective",
      "otherAgents": ["string[] - Other agent names"],
      "questionsForAgent": ["string[] - Questions for this agent"],
      "previousMeetingSummary": "object - Previous meeting summary",
      "userContext": "string - User feedback/direction"
    }
  }
  ```
  
  ## Response
  ```json
  {
    "response": "object - Agent's response data",
    "sources": ["object[] - Grounding sources from Gemini"]
  }
  ```
*/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
  meetingId: string;
  agentId: string;
  round: number;
  context: {
    topic: string;
    meetingGoal: string;
    otherAgents?: string[];
    questionsForAgent?: string[];
    previousMeetingSummary?: any;
    userContext?: string;
  };
}

async function callGeminiAPI(prompt: string, useSearch: boolean = false): Promise<{ text: string, sources?: any[] }> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const requestBody: any = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  if (useSearch) {
    requestBody.tools = [{ googleSearch: {} }];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  // Extract sources if available
  const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .map((chunk: any) => chunk.web)
    .filter((web: any) => web?.uri && web.title);

  return { text, sources };
}

function parseJsonResponse<T>(text: string): T {
  let jsonText = text;

  // Handle code block wrapping
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    jsonText = jsonMatch[1];
  }

  // Find JSON boundaries
  const firstBrace = jsonText.indexOf('{');
  const firstBracket = jsonText.indexOf('[');
  
  let startIndex = -1;
  if (firstBrace > -1 && firstBracket > -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace > -1) {
    startIndex = firstBrace;
  } else {
    startIndex = firstBracket;
  }

  if (startIndex === -1) {
    throw new Error('No JSON object or array found in response');
  }

  const lastBrace = jsonText.lastIndexOf('}');
  const lastBracket = jsonText.lastIndexOf(']');
  const endIndex = Math.max(lastBrace, lastBracket);

  if (endIndex === -1 || endIndex < startIndex) {
    throw new Error('JSON object or array not properly closed');
  }

  jsonText = jsonText.substring(startIndex, endIndex + 1);

  try {
    return JSON.parse(jsonText) as T;
  } catch (e1) {
    // Try to fix common issues
    try {
      let fixedJson = jsonText.replace(/(\r\n|\n|\r)/gm, " ");
      fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixedJson) as T;
    } catch (e2) {
      throw new Error('Failed to parse JSON response from Gemini API');
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { meetingId, agentId, round, context }: RequestBody = await req.json()

    // Validate input
    if (!meetingId || !agentId || !round || !context) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get agent persona from database
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .select('full_persona, name')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify meeting belongs to user
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('roundtable_meetings')
      .select(`
        *,
        roundtable_sessions!inner(user_id)
      `)
      .eq('id', meetingId)
      .eq('roundtable_sessions.user_id', user.id)
      .single();

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate appropriate prompt based on round
    let prompt = '';
    const JSON_FORMATTING_INSTRUCTION = `CRITICAL FORMATTING RULE: Your entire response must be ONLY a single, raw, valid JSON object. Do not add any text, markdown, or formatting before or after the JSON. In all string values, you MUST correctly escape all special characters. Specifically, any double quote (") inside a string must be written as \\", and any newline character must be written as \\n.`;

    if (round === 1) {
      const contextPrompt = context.previousMeetingSummary ? `
        This is a follow-up meeting.
        The goal of this specific meeting is: "${context.meetingGoal}".
        Context from the previous meeting's summary:
        - Key Insights: ${context.previousMeetingSummary.keyInsights?.join('; ') || 'None'}
        - Action Items: ${context.previousMeetingSummary.actionItems?.join('; ') || 'None'}
        - Potential Risks: ${context.previousMeetingSummary.potentialRisks?.join('; ') || 'None'}
        - Consensus Points: ${context.previousMeetingSummary.consensusPoints?.join('; ') || 'None'}
      ` : `This is the first meeting on this topic. The goal of this meeting is: "${context.meetingGoal}"`;

      const userContextPrompt = context.userContext ? `
        IMPORTANT: You must also consider the following feedback and direction from the user, which was provided after the previous meeting concluded. This is a critical instruction to guide your response.
        --- USER DIRECTION ---
        ${context.userContext}
        --- END USER DIRECTION ---
      ` : '';

      prompt = `
        Overall Topic: "${context.topic}"

        ${contextPrompt}

        ${userContextPrompt}

        Your Role: ${agent.full_persona}

        You are in Round 1 of a roundtable discussion with other experts for THIS meeting: ${context.otherAgents?.join(', ') || 'None'}.
        
        Use your access to Google Search to find the latest information, data, and trends to inform your answer.

        Your tasks:
        1. **In-Depth Analysis:** Provide your primary expert analysis on the topic, adhering strictly to the specific deliverables and mindset outlined in your persona. Your answer should be detailed, insightful, and directly address the meeting's goal. Support your points with specific data, real-world examples, or the frameworks mentioned in your persona. Avoid generic statements. Aim for a comprehensive and actionable response.
        2. **Cross-Questions:** Raise a maximum of 2 brief, insightful questions for up to 2 other specific experts in this meeting. Your questions should challenge their perspective or ask for clarification based on this meeting's goal.

        ${JSON_FORMATTING_INSTRUCTION}

        The JSON object must have this exact structure. Do not add or remove keys.
        {
          "mainAnswer": "Your comprehensive and detailed analysis here. Remember to escape characters correctly, like this: \\"quoted text\\" and newlines like this.\\nAnother line.",
          "crossQuestions": [
            { "ask_expert": "Expert Name", "question": "Your question for them." },
            { "ask_expert": "Another Expert Name", "question": "Your second question." }
          ]
        }
      `;
    } else if (round === 2) {
      prompt = `
        Topic: "${context.topic}"

        Your Role: ${agent.full_persona}

        You are in Round 2 of a roundtable discussion with other experts: ${context.otherAgents?.join(', ') || 'None'}. In Round 1, other experts asked you the following questions:
        ${context.questionsForAgent?.map((q, i) => `${i + 1}. "${q}"`).join('\n') || 'No questions were asked.'}

        Use your access to Google Search to find the latest information, data, and trends to inform your answers.

        Your tasks:
        1. **Answer Questions:** Provide concise, direct answers to each of these questions based on your persona.
        2. **Raise Follow-up Questions:** Based on the discussion so far, raise a maximum of 2 new, brief follow-up questions for up to 2 other experts to deepen the conversation.

        ${JSON_FORMATTING_INSTRUCTION}

        The JSON object must have this exact structure. Do not add or remove keys.
        {
          "answers": [
            { "question": "The first question you were asked.", "answer": "Your answer to it." }
          ],
          "crossQuestions": [
            { "ask_expert": "Expert Name", "question": "Your new follow-up question." }
          ]
        }
      `;
    } else if (round === 3) {
      prompt = `
        Topic: "${context.topic}"

        Your Role: ${agent.full_persona}

        You are in the FINAL round (Round 3) of a roundtable discussion. This is the last chance for clarification. In Round 2, other experts asked you the following follow-up questions:
        ${context.questionsForAgent?.map((q, i) => `${i + 1}. "${q}"`).join('\n') || 'No questions were asked.'}

        Your task is to provide concise, final answers to each of these questions. Do NOT ask any new questions.

        ${JSON_FORMATTING_INSTRUCTION}
        
        The JSON object must have this exact structure. Do not add or remove keys.
        {
          "answers": [
            { "question": "The first question you were asked.", "answer": "Your final answer to it." },
            { "question": "The second question you were asked.", "answer": "Your final answer." }
          ]
        }
      `;
    }

    // Call Gemini API
    const useSearch = round === 1 || round === 2; // Use search for rounds 1 and 2
    const { text, sources } = await callGeminiAPI(prompt, useSearch);
    const response = parseJsonResponse(text);

    // Store response in database
    const { error: responseError } = await supabaseClient
      .from('roundtable_responses')
      .insert({
        meeting_id: meetingId,
        agent_id: agentId,
        round_number: round,
        response_data: response,
        sources: sources || []
      });

    if (responseError) {
      console.error('Failed to store response:', responseError);
      // Continue anyway - don't fail the request
    }

    return new Response(
      JSON.stringify({ 
        response,
        sources: sources || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in run-agent-round function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})