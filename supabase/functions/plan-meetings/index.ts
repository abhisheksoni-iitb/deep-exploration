import { GoogleGenAI } from "npm:@google/genai@^1.16.0";
import { createClient } from "npm:@supabase/supabase-js@^2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PlanMeetingsRequest {
  topic: string;
}

interface PlannedMeeting {
  goal: string;
  agentIds: string[];
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY') ?? '' });

    const { topic }: PlanMeetingsRequest = await req.json();

    if (!topic?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

      Your entire response must be ONLY a single, raw, valid JSON array. Do not add any text, markdown, or formatting before or after the JSON.

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const meetingPlan: PlannedMeeting[] = JSON.parse(response.text);

    // Create project in database
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        topic,
        status: 'PLANNING',
        meeting_plan: meetingPlan
      })
      .select()
      .single();

    if (projectError) {
      throw new Error(`Failed to create project: ${projectError.message}`);
    }

    // Create meetings in database
    const meetingsToInsert = meetingPlan.map((meeting, index) => ({
      project_id: project.id,
      meeting_index: index,
      goal: meeting.goal,
      status: 'PENDING'
    }));

    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .insert(meetingsToInsert)
      .select();

    if (meetingsError) {
      throw new Error(`Failed to create meetings: ${meetingsError.message}`);
    }

    // Create meeting_agents relationships
    const agentRelations = meetings.flatMap(meeting => {
      const planMeeting = meetingPlan[meeting.meeting_index];
      return planMeeting.agentIds.map(agentId => ({
        meeting_id: meeting.id,
        agent_id: agentId
      }));
    });

    const { error: agentsError } = await supabase
      .from('meeting_agents')
      .insert(agentRelations);

    if (agentsError) {
      throw new Error(`Failed to create meeting agents: ${agentsError.message}`);
    }

    return new Response(
      JSON.stringify({
        project_id: project.id,
        meeting_plan: meetingPlan,
        meetings
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in plan-meetings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});