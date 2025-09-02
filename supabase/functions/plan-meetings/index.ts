/*
  # Supabase Edge Function: plan-meetings
  
  This function handles the AI-powered meeting planning for the Roundtable Meeting Agent.
  It takes a topic and returns a structured meeting plan using the Gemini API.
  
  ## Endpoint
  POST /functions/v1/plan-meetings
  
  ## Request Body
  ```json
  {
    "topic": "string - The discussion topic"
  }
  ```
  
  ## Response
  ```json
  {
    "sessionId": "uuid - Created session ID",
    "meetingPlan": [
      {
        "goal": "string - Meeting objective",
        "agentIds": ["string[] - Agent IDs"]
      }
    ]
  }
  ```
  
  ## Authentication
  Requires valid Supabase auth token in Authorization header
  
  ## Environment Variables
  - GEMINI_API_KEY: Google Gemini API key (stored in Supabase secrets)
*/

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PlannedMeeting {
  goal: string;
  agentIds: string[];
}

interface RequestBody {
  topic: string;
}

// Available agents configuration - matches frontend constants
const ALL_AGENTS = [
  { id: 'product', name: 'Product Manager', shortPersona: 'Defines product vision, user personas, and a feature roadmap using the RICE framework.' },
  { id: 'vc', name: 'Venture Capitalist', shortPersona: 'Analyzes market size (TAM/SAM/SOM), business model, and competitive landscape for a 10x return potential.' },
  { id: 'marketing', name: 'Marketing Lead', shortPersona: 'Develops a full-funnel go-to-market strategy, including ICP, acquisition channels, and AARRR KPIs.' },
  { id: 'design', name: 'UX/UI Designer', shortPersona: 'Advocates for the user, creating user journey maps, information architecture, and ensuring an accessible (WCAG) design.' },
  { id: 'tech', name: 'Tech Lead', shortPersona: 'Defines the system architecture, tech stack, identifies technical risks, and estimates engineering effort.' },
  { id: 'legal', name: 'Legal Counsel', shortPersona: 'Identifies and mitigates legal and regulatory risks, focusing on data privacy, IP, and compliance.' },
  { id: 'risk', name: 'Risk Analyst', shortPersona: 'Identifies market, operational, financial, and reputational risks and proposes mitigation plans.' },
  { id: 'growth', name: 'Growth Hacker', shortPersona: 'Focuses on rapid user acquisition and retention by defining a North Star Metric and designing growth experiments.' },
  { id: 'data_scientist', name: 'Data Scientist', shortPersona: 'Defines essential KPIs, recommends an analytics stack, and proposes data-backed A/B tests.' },
  { id: 'customer_support', name: 'Customer Support Lead', shortPersona: 'Anticipates common user complaints and plans support channels and metrics to ensure user satisfaction.' },
  { id: 'devops', name: 'DevOps Engineer', shortPersona: 'Plans the cloud infrastructure, CI/CD pipeline, and monitoring strategy for reliability and scalability.' },
  { id: 'community', name: 'Community Manager', shortPersona: 'Develops strategies to build, engage, and moderate a loyal user community on platforms like Discord or Reddit.' },
  { id: 'sales', name: 'Sales Lead', shortPersona: 'Assesses commercial viability, defines the ICP for B2B sales, and outlines a potential sales process.' },
  { id: 'bizdev', name: 'Business Development', shortPersona: 'Identifies strategic partnership opportunities to create non-linear growth for the project.' },
  { id: 'operations', name: 'Operations Manager', shortPersona: 'Maps core operational workflows and identifies potential bottlenecks to ensure the business can scale.' },
  { id: 'content', name: 'Content Strategist', shortPersona: 'Defines content pillars and an SEO-driven strategy to build the brand and drive inbound interest.' },
  { id: 'qa', name: 'QA Engineer', shortPersona: 'Guardian of quality, defining the test strategy, critical user flows for testing, and bug triage process.' },
  { id: 'security', name: 'CISO', shortPersona: 'Protects the product and users by creating a threat model and defining essential security controls.' },
  { id: 'hr', name: 'Talent/HR Lead', shortPersona: 'Ensures the right team is in place by assessing skill gaps and creating a high-level hiring plan.' },
  { id: 'finance', name: 'CFO', shortPersona: 'Owns the financial model, projects revenue and costs, and determines the required investment and ROI.' },
  { id: 'ethics', name: 'Ethical AI Specialist', shortPersona: 'Serves as the project\'s conscience, identifying ethical risks like algorithmic bias and proposing mitigations.' },
  { id: 'sustainability', name: 'Sustainability Officer', shortPersona: 'Analyzes the project through an Environmental, Social, and Governance (ESG) framework to ensure long-term responsibility.' }
];

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

    const { topic }: RequestBody = await req.json()

    if (!topic || typeof topic !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Topic is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate meeting plan using Gemini
    const prompt = `
      You are an expert project manager and strategist. Your task is to devise a logical and efficient series of meetings to analyze a project from inception to a go-to-market plan.

      Topic: "${topic}"

      Available Experts (use their 'id' for selection):
      ${ALL_AGENTS.map(a => `- ${a.name} (id: ${a.id}) - Core function: ${a.shortPersona}`).join('\n')}

      Your goal is to create a project plan as a series of meetings. Follow these rules strictly:
      1. **Project Lifecycle Flow:** The meetings must follow a logical project lifecycle. Start with strategy and validation, then move to feasibility and design, and finally cover execution and go-to-market.
      2. **Strict 3-Expert Limit Per Meeting:** Each meeting MUST have exactly 3 experts. No more, no less. This is a critical constraint for focus.
      3. **Optimal Expert Selection:** For each meeting's goal, select the three most critical experts.
      4. **Actionable Goals:** Each meeting must have a concise, actionable 'goal'.
      5. **Number of Meetings:** Plan for 2 to 4 meetings in total.

      CRITICAL FORMATTING RULE: Your entire response must be ONLY a single, raw, valid JSON object. Do not add any text, markdown, or formatting before or after the JSON.

      Example format:
      [
        {
          "goal": "Define the product vision, validate the market opportunity, and assess the business case.",
          "agentIds": ["product", "vc", "marketing"]
        },
        {
          "goal": "Determine technical feasibility, design the core user experience, and identify legal risks.",
          "agentIds": ["tech", "design", "legal"]
        }
      ]
    `;

    const geminiResponse = await callGeminiAPI(prompt);
    const meetingPlan = parseJsonResponse<PlannedMeeting[]>(geminiResponse);

    // Create session in database
    const { data: session, error: sessionError } = await supabaseClient
      .from('roundtable_sessions')
      .insert({
        user_id: user.id,
        topic,
        status: 'planning',
        meeting_plan: meetingPlan
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        meetingPlan 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in plan-meetings function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})