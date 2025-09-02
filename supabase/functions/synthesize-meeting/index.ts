/*
  # Supabase Edge Function: synthesize-meeting
  
  This function synthesizes a meeting transcript into a structured summary.
  
  ## Endpoint
  POST /functions/v1/synthesize-meeting
  
  ## Request Body
  ```json
  {
    "meetingId": "uuid - Meeting ID",
    "transcript": "array - Meeting transcript items"
  }
  ```
  
  ## Response
  ```json
  {
    "summary": {
      "keyInsights": ["string[]"],
      "actionItems": ["string[]"], 
      "potentialRisks": ["string[]"],
      "consensusPoints": ["string[]"]
    }
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
  transcript: any[];
}

async function callGeminiAPI(prompt: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
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

    const { meetingId, transcript }: RequestBody = await req.json()

    if (!meetingId || !transcript) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify meeting belongs to user
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('roundtable_meetings')
      .select(`
        *,
        roundtable_sessions!inner(user_id, topic)
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

    // Condense transcript for synthesis
    const condensedTranscript = transcript
      .filter((item: any) => item.type === 'response' || item.type === 'answer')
      .map((item: any) => {
        if (item.type === 'response') {
          return `[${item.agent?.name || 'Agent'}'s Main Answer]: ${item.content}`;
        }
        if (item.type === 'answer') {
          return `[${item.agent?.name || 'Agent'}'s Answer]: ${item.content}`;
        }
        return '';
      })
      .join('\n\n');

    const prompt = `
      You are an expert meeting facilitator. Analyze the following condensed roundtable meeting transcript.
      The goal of this meeting was to discuss: "${meeting.roundtable_sessions.topic}"
      Meeting Goal: "${meeting.goal}"

      Condensed Transcript:
      ---
      ${condensedTranscript}
      ---

      Based on the entire discussion, generate a comprehensive summary. Your summary must be structured as a JSON object with the following keys: "keyInsights", "actionItems", "potentialRisks", and "consensusPoints". Each key must have an array of strings as its value. Ensure each point is concise and actionable.

      CRITICAL FORMATTING RULE: Your entire response must be ONLY a single, raw, valid JSON object. Do not add any text, markdown, or formatting before or after the JSON.
    `;

    const geminiResponse = await callGeminiAPI(prompt);
    const summary = parseJsonResponse(geminiResponse);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in synthesize-meeting function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})