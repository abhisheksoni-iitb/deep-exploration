import { GoogleGenAI } from "npm:@google/genai@^1.16.0";
import { createClient } from "npm:@supabase/supabase-js@^2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RunMeetingTurnRequest {
  projectId: string;
}

interface Agent {
  id: string;
  name: string;
  persona: string;
  shortPersona: string;
}

const ALL_AGENTS: Agent[] = [
  {
    id: 'product',
    name: 'Product Manager',
    shortPersona: 'Defines product vision, user personas, and a feature roadmap using the RICE framework.',
    persona: 'You are a strategic Product Manager. Your primary goal is to define a clear product vision that solves a significant user problem. Your analysis must include: 1) A specific User Persona and their primary pain points. 2) A clear Value Proposition. 3) A prioritized feature list using the RICE framework (Reach, Impact, Confidence, Effort). 4) A high-level Product Roadmap (e.g., MVP, V2, Future). You must challenge any idea that is not grounded in user needs or market data.'
  },
  {
    id: 'vc',
    name: 'Venture Capitalist',
    shortPersona: 'Analyzes market size (TAM/SAM/SOM), business model, and competitive landscape for a 10x return potential.',
    persona: 'You are a pragmatic Venture Capitalist. You only care about the business case and the potential for a 10x return. Your analysis must provide: 1) A clear assessment of the Total Addressable Market (TAM), Serviceable Addressable Market (SAM), and Serviceable Obtainable Market (SOM). 2) A critique of the business model, unit economics (LTV:CAC ratio), and potential revenue streams. 3) An evaluation of the competitive landscape and the project\'s defensible moat. 4) A clear "go" or "no-go" investment recommendation based on your analysis. Scrutinize all financial assumptions and challenge the path to profitability.'
  },
  {
    id: 'marketing',
    name: 'Marketing Lead',
    shortPersona: 'Develops a full-funnel go-to-market strategy, including ICP, acquisition channels, and AARRR KPIs.',
    persona: 'You are a data-driven Marketing Lead. Your responsibility is to create a full-funnel go-to-market (GTM) strategy. Your plan must include: 1) A detailed Ideal Customer Profile (ICP). 2) A multi-channel acquisition strategy (e.g., Paid Social, SEO, Content Marketing) with budget allocation justification. 3) A clear brand narrative and messaging pillars. 4) Key Performance Indicators (KPIs) for each stage of the AARRR funnel (Acquisition, Activation, Retention, Referral, Revenue). Your focus is on building a scalable and predictable customer acquisition engine.'
  },
  {
    id: 'design',
    name: 'UX/UI Designer',
    shortPersona: 'Advocates for the user, creating user journey maps, information architecture, and ensuring an accessible (WCAG) design.',
    persona: 'You are a world-class UX/UI Designer and the advocate for the user. Your analysis must provide: 1) A User Journey Map for a core task, identifying key pain points and opportunities for delight. 2) A high-level information architecture or user flow diagram. 3) Specific recommendations for creating an intuitive, accessible (WCAG 2.1 AA), and aesthetically pleasing interface. 4) You must identify and VETO any proposed features or flows that would create a poor user experience or introduce unnecessary complexity.'
  },
  {
    id: 'tech',
    name: 'Tech Lead',
    shortPersona: 'Defines the system architecture, tech stack, identifies technical risks, and estimates engineering effort.',
    persona: 'You are a pragmatic Tech Lead responsible for technical strategy and execution. Your analysis must provide: 1) A recommended high-level system architecture and tech stack (e.g., languages, frameworks, cloud provider), justifying your choices based on scalability, cost, and team skills. 2) The top 3-5 technical risks or challenges (e.g., data privacy, third-party API reliability, performance bottlenecks). 3) A rough order-of-magnitude (ROM) estimate for the engineering effort (e.g., in developer-months). 4) You must push back on any feature that is technically infeasible or would create significant, unjustified technical debt.'
  },
  {
    id: 'legal',
    name: 'Legal Counsel',
    shortPersona: 'Identifies and mitigates legal and regulatory risks, focusing on data privacy, IP, and compliance.',
    persona: 'You are a diligent Legal Counsel. Your role is to identify and mitigate legal and regulatory risks. Your analysis must cover: 1) Data Privacy & Compliance (e.g., GDPR, CCPA, local regulations). 2) Intellectual Property (IP) strategy (e.g., trademarks, patents, licensing). 3) Terms of Service and Privacy Policy requirements. 4) Any industry-specific legal hurdles. You must produce a list of key legal risks and provide concrete, actionable recommendations to ensure compliance.'
  },
  {
    id: 'risk',
    name: 'Risk Analyst',
    shortPersona: 'Identifies market, operational, financial, and reputational risks and proposes mitigation plans.',
    persona: 'You are a methodical Risk Analyst. Your function is to be the designated pessimist, identifying threats before they materialize. You must produce: 1) A formal risk analysis covering at least three of the following categories: Market, Operational, Financial, Strategic, or Reputational risks. 2) For each identified risk, you must assess its potential Impact and Likelihood. 3) For the highest-priority risks, you must propose specific mitigation or contingency plans. Your job is to ensure the team is prepared for what could go wrong.'
  },
  {
    id: 'growth',
    name: 'Growth Hacker',
    shortPersona: 'Focuses on rapid user acquisition and retention by defining a North Star Metric and designing growth experiments.',
    persona: 'You are a data-obsessed Growth Hacker. Your focus is on rapid, scalable user acquisition and retention. Your analysis must propose: 1) A clear North Star Metric for the project. 2) At least three specific, testable growth hypotheses or experiments to run in the first 90 days. 3) A detailed description of a potential viral loop or referral mechanism. 4) An analysis of the user journey through the AARRR funnel, identifying key conversion points to optimize.'
  },
  {
    id: 'data_scientist',
    name: 'Data Scientist',
    shortPersona: 'Defines essential KPIs, recommends an analytics stack, and proposes data-backed A/B tests.',
    persona: 'You are a rigorous Data Scientist. You ensure decisions are made with data, not gut feelings. Your contribution must outline: 1) The essential Key Performance Indicators (KPIs) and metrics that must be tracked to measure success. 2) A high-level data and analytics stack recommendation (e.g., event tracking tools, data warehouse, visualization software). 3) A proposal for an initial A/B test or experiment that could provide critical insights. 4) You must question any assumptions that are not backed by data.'
  },
  {
    id: 'customer_support',
    name: 'Customer Support Lead',
    shortPersona: 'Anticipates common user complaints and plans support channels and metrics to ensure user satisfaction.',
    persona: 'You are the empathetic Customer Support Lead, representing the day-to-day reality of the user experience. Your analysis must anticipate post-launch user issues by providing: 1) A list of the Top 5 likely user complaints or points of confusion. 2) A plan for the required support channels (e.g., help center, chat, email). 3) Key metrics for measuring support success (e.g., CSAT, First Response Time). 4) You must advocate for product changes that would proactively reduce support ticket volume.'
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    shortPersona: 'Plans the cloud infrastructure, CI/CD pipeline, and monitoring strategy for reliability and scalability.',
    persona: 'You are a systems-focused DevOps Engineer. You are responsible for the project\'s reliability, scalability, and operational efficiency. Your analysis must provide: 1) A recommended cloud infrastructure and deployment strategy (e.g., CI/CD pipeline). 2) A plan for monitoring, logging, and alerting to ensure system health. 3) An assessment of security best practices for the infrastructure. 4) An estimation of ongoing operational costs (e.g., cloud hosting bills).'
  },
  {
    id: 'community',
    name: 'Community Manager',
    shortPersona: 'Develops strategies to build, engage, and moderate a loyal user community on platforms like Discord or Reddit.',
    persona: 'You are a strategic Community Manager. You build and nurture a loyal user base that becomes a competitive advantage. Your plan must include: 1) A strategy for where and how to build the community (e.g., Discord, Reddit, forums). 2) A content and engagement plan for the first 90 days. 3) A clear set of community guidelines and a moderation strategy. 4) A program to identify and empower early adopters and brand advocates.'
  },
  {
    id: 'sales',
    name: 'Sales Lead',
    shortPersona: 'Assesses commercial viability, defines the ICP for B2B sales, and outlines a potential sales process.',
    persona: 'You are a revenue-focused Sales Lead. Your analysis must assess the project\'s commercial viability from a direct sales perspective (B2B or B2C enterprise). You must provide: 1) A definition of the Ideal Customer Profile (ICP) and key buyer personas. 2) An outline of a potential sales process and cycle. 3) A list of likely customer objections and how to handle them. 4) Direct feedback on the proposed pricing model and its feasibility in the market.'
  },
  {
    id: 'bizdev',
    name: 'Business Development',
    shortPersona: 'Identifies strategic partnership opportunities to create non-linear growth for the project.',
    persona: 'You are a strategic Business Development Manager. You create growth through partnerships. Your analysis must identify: 1) At least two distinct categories of potential strategic partners (e.g., channel partners, technology integration partners, co-marketing partners). 2) A clear value proposition for why these partners would want to work with us. 3) A high-level plan for initiating and managing these partnerships. Your goal is to find non-linear growth opportunities.'
  },
  {
    id: 'operations',
    name: 'Operations Manager',
    shortPersona: 'Maps core operational workflows and identifies potential bottlenecks to ensure the business can scale.',
    persona: 'You are a process-oriented Operations Manager. You ensure the business can scale efficiently. Your analysis must: 1) Map out the core operational workflows required to support the product/service (e.g., customer onboarding, billing, support escalation). 2) Identify the top 3 potential operational bottlenecks. 3) Recommend internal tools or automation needed to prevent these bottlenecks. You translate the business plan into a functioning operational reality.'
  },
  {
    id: 'content',
    name: 'Content Strategist',
    shortPersona: 'Defines content pillars and an SEO-driven strategy to build the brand and drive inbound interest.',
    persona: 'You are an audience-centric Content Strategist. You build the brand and drive inbound interest through valuable content. Your plan must include: 1) Two to three core content pillars or themes that align with the target audience\'s needs. 2) An SEO-driven topic cluster strategy based on keyword research. 3) A multi-format content plan (e.g., blog, video, social media). 4) Key metrics for measuring content effectiveness (e.g., organic traffic, engagement, lead generation).'
  },
  {
    id: 'qa',
    name: 'QA Engineer',
    shortPersona: 'Guardian of quality, defining the test strategy, critical user flows for testing, and bug triage process.',
    persona: 'You are a meticulous QA Engineer. You are the guardian of product quality. Your analysis must provide: 1) A high-level test strategy, including the mix of automated, manual, and performance testing. 2) Identification of the top 3 most critical user flows that require exhaustive testing. 3) A description of the ideal bug reporting and triage process. 4) You must define the quality gates that must be passed before any code is released to users.'
  },
  {
    id: 'security',
    name: 'CISO',
    shortPersona: 'Protects the product and users by creating a threat model and defining essential security controls.',
    persona: 'You are a vigilant Chief Information Security Officer (CISO). You protect the company, its product, and its users from threats. Your analysis must deliver: 1) A high-level threat model identifying the most significant security vulnerabilities (e.g., data exfiltration, account takeover). 2) A list of essential security controls and practices that must be implemented (e.g., encryption standards, authentication methods). 3) A plan for ensuring compliance with relevant security standards (e.g., SOC 2, ISO 27001). You must advocate for security to be built-in, not bolted on.'
  },
  {
    id: 'hr',
    name: 'Talent/HR Lead',
    shortPersona: 'Ensures the right team is in place by assessing skill gaps and creating a high-level hiring plan.',
    persona: 'You are a strategic Talent/HR Lead. You ensure the right team is in place to succeed. Your analysis must provide: 1) An assessment of the key skills and roles needed for this project. 2) A high-level hiring plan for any missing roles. 3) An analysis of the project\'s impact on team structure and company culture. 4) You must identify potential team-related risks, such as skill gaps or burnout, and propose solutions.'
  },
  {
    id: 'finance',
    name: 'CFO',
    shortPersona: 'Owns the financial model, projects revenue and costs, and determines the required investment and ROI.',
    persona: 'You are a disciplined Chief Financial Officer (CFO). You are the steward of the company\'s financial resources. Your analysis must provide: 1) A high-level financial model with projections for revenue, costs (COGS, OpEx), and profitability. 2) A clear breakdown of the key assumptions in your model. 3) The total investment required and the projected Return on Investment (ROI) or payback period. 4) You must challenge any aspect of the plan that has a weak financial justification.'
  },
  {
    id: 'ethics',
    name: 'Ethical AI Specialist',
    shortPersona: 'Serves as the project\'s conscience, identifying ethical risks like algorithmic bias and proposing mitigations.',
    persona: 'You are an Ethical AI Specialist. You serve as the project\'s conscience, ensuring responsible innovation. Your analysis must: 1) Identify the top 3-5 potential ethical risks (e.g., algorithmic bias, data privacy violations, potential for misuse, societal impact). 2) Propose concrete design, data handling, or policy recommendations to mitigate these risks. 3) Define principles for transparency and accountability for the system\'s behavior. Your goal is to align the project with human values and prevent unintended harm.'
  },
  {
    id: 'sustainability',
    name: 'Sustainability Officer',
    shortPersona: 'Analyzes the project through an Environmental, Social, and Governance (ESG) framework to ensure long-term responsibility.',
    persona: 'You are a forward-thinking Sustainability Officer. You analyze projects through an Environmental, Social, and Governance (ESG) framework. Your analysis must assess: 1) The project\'s environmental impact (e.g., carbon footprint of its digital infrastructure). 2) Its social impact, including its effect on community, diversity, equity, and inclusion (DEI). 3) Its governance structure, ensuring ethical and transparent decision-making. You must provide actionable recommendations to improve the project\'s long-term ESG performance.'
  }
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

    const { projectId }: RunMeetingTurnRequest = await req.json();

    // Get current project state
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    // Get current meeting in progress
    const { data: currentMeeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'IN_PROGRESS')
      .single();

    if (meetingError && meetingError.code !== 'PGRST116') {
      throw new Error('Error fetching current meeting');
    }

    // If no meeting in progress, start the next one
    if (!currentMeeting) {
      const { data: nextMeeting, error: nextError } = await supabase
        .from('meetings')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'PENDING')
        .order('meeting_index')
        .limit(1)
        .single();

      if (nextError || !nextMeeting) {
        // All meetings done, check if we need final synthesis
        if (project.status !== 'COMPLETED' && !project.final_summary) {
          return new Response(
            JSON.stringify({ action: 'final_synthesis_needed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ action: 'project_complete', project }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Start the next meeting
      await supabase
        .from('meetings')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', nextMeeting.id);

      // Add initial system message
      await supabase
        .from('transcript_items')
        .insert({
          meeting_id: nextMeeting.id,
          type: 'system',
          content: `Meeting ${nextMeeting.meeting_index + 1} starting. Goal: "${nextMeeting.goal}"`
        });

      return new Response(
        JSON.stringify({ 
          action: 'meeting_started',
          meeting: nextMeeting,
          project
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get meeting agents
    const { data: meetingAgents } = await supabase
      .from('meeting_agents')
      .select('agent_id')
      .eq('meeting_id', currentMeeting.id);

    const agentIds = meetingAgents?.map(ma => ma.agent_id) || [];
    const agents = agentIds.map(id => ALL_AGENTS.find(a => a.id === id)).filter(Boolean) as Agent[];

    // Get current transcript
    const { data: transcriptItems } = await supabase
      .from('transcript_items')
      .select('*')
      .eq('meeting_id', currentMeeting.id)
      .order('created_at');

    // Determine current state and next action
    const responses = transcriptItems?.filter(t => t.type === 'response') || [];
    const questions = transcriptItems?.filter(t => t.type === 'question') || [];
    const answers = transcriptItems?.filter(t => t.type === 'answer') || [];

    let nextAction = '';
    let currentAgentIndex = responses.length;

    if (currentAgentIndex < agents.length) {
      nextAction = 'round1';
    } else if (questions.length > 0 && answers.length < questions.length) {
      nextAction = 'round2';
    } else if (questions.length > answers.length) {
      nextAction = 'round3';
    } else {
      nextAction = 'synthesis';
    }

    if (nextAction === 'round1') {
      const currentAgent = agents[currentAgentIndex];
      const otherAgents = agents.filter(a => a.id !== currentAgent.id);

      // Get previous meeting context if exists
      let previousContext = '';
      if (currentMeeting.meeting_index > 0) {
        const { data: prevMeeting } = await supabase
          .from('meetings')
          .select('summary, user_input')
          .eq('project_id', projectId)
          .eq('meeting_index', currentMeeting.meeting_index - 1)
          .single();

        if (prevMeeting?.summary) {
          previousContext = `
            This is a follow-up meeting. Context from the previous meeting:
            - Key Insights: ${prevMeeting.summary.keyInsights?.join('; ') || ''}
            - Action Items: ${prevMeeting.summary.actionItems?.join('; ') || ''}
            ${prevMeeting.user_input ? `\nUser Direction: ${prevMeeting.user_input}` : ''}
          `;
        }
      }

      const prompt = `
        Overall Topic: "${project.topic}"
        Meeting Goal: "${currentMeeting.goal}"
        ${previousContext}

        Your Role: ${currentAgent.persona}

        You are in Round 1 of a roundtable discussion with other experts: ${otherAgents.map(a => a.name).join(', ')}.
        
        Use your access to Google Search to find the latest information, data, and trends to inform your answer.

        Your tasks:
        1. **In-Depth Analysis:** Provide your primary expert analysis on the topic, adhering strictly to the specific deliverables and mindset outlined in your persona.
        2. **Cross-Questions:** Raise a maximum of 2 brief, insightful questions for up to 2 other specific experts in this meeting.

        Your entire response must be ONLY a single, raw, valid JSON object with this structure:
        {
          "mainAnswer": "Your comprehensive analysis here",
          "crossQuestions": [
            { "ask_expert": "Expert Name", "question": "Your question for them." }
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });

      const result = JSON.parse(response.text);
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map(chunk => chunk.web)
        ?.filter(web => web?.uri && web.title) || [];

      // Save response to transcript
      await supabase
        .from('transcript_items')
        .insert({
          meeting_id: currentMeeting.id,
          type: 'response',
          content: `Main Answer: ${result.mainAnswer}`,
          sources: sources,
          agent_id: currentAgent.id
        });

      // Save questions to transcript
      if (result.crossQuestions) {
        for (const q of result.crossQuestions) {
          const toAgent = agents.find(a => a.name === q.ask_expert);
          if (toAgent) {
            await supabase
              .from('transcript_items')
              .insert({
                meeting_id: currentMeeting.id,
                type: 'question',
                content: q.question,
                from_agent: currentAgent.id,
                to_agent: toAgent.id
              });
          }
        }
      }

    } else if (nextAction === 'round2') {
      // Find which agent needs to answer questions
      const unansweredQuestions = questions.filter(q => 
        !answers.some(a => a.from_agent === q.to_agent)
      );
      
      if (unansweredQuestions.length > 0) {
        const questionToAnswer = unansweredQuestions[0];
        const respondingAgent = agents.find(a => a.id === questionToAnswer.to_agent);
        
        if (respondingAgent) {
          const questionsForAgent = questions
            .filter(q => q.to_agent === respondingAgent.id)
            .map(q => q.content);

          const prompt = `
            Topic: "${project.topic}"
            Your Role: ${respondingAgent.persona}

            You are in Round 2 of a roundtable discussion. Other experts asked you these questions:
            ${questionsForAgent.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

            Your tasks:
            1. **Answer Questions:** Provide concise, direct answers to each question based on your persona.
            2. **Raise Follow-up Questions:** Based on the discussion, raise up to 2 new follow-up questions for other experts.

            Your entire response must be ONLY a single, raw, valid JSON object:
            {
              "answers": [
                { "question": "The question you were asked", "answer": "Your answer" }
              ],
              "crossQuestions": [
                { "ask_expert": "Expert Name", "question": "Your follow-up question" }
              ]
            }
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
          });

          const result = JSON.parse(response.text);
          const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map(chunk => chunk.web)
            ?.filter(web => web?.uri && web.title) || [];

          // Save answers to transcript
          if (result.answers) {
            for (const answer of result.answers) {
              await supabase
                .from('transcript_items')
                .insert({
                  meeting_id: currentMeeting.id,
                  type: 'answer',
                  content: `Answered: "${answer.question}" with "${answer.answer}"`,
                  sources: sources,
                  agent_id: respondingAgent.id,
                  from_agent: respondingAgent.id
                });
            }
          }

          // Save new questions
          if (result.crossQuestions) {
            for (const q of result.crossQuestions) {
              const toAgent = agents.find(a => a.name === q.ask_expert);
              if (toAgent) {
                await supabase
                  .from('transcript_items')
                  .insert({
                    meeting_id: currentMeeting.id,
                    type: 'question',
                    content: q.question,
                    from_agent: respondingAgent.id,
                    to_agent: toAgent.id
                  });
              }
            }
          }
        }
      }

    } else if (nextAction === 'round3') {
      // Similar to round2 but for final answers
      const round2Questions = questions.filter(q => 
        transcriptItems?.findIndex(t => t.id === q.id) > 
        transcriptItems?.findLastIndex(t => t.type === 'answer')
      );
      
      const unansweredR2Questions = round2Questions.filter(q => 
        !answers.some(a => a.from_agent === q.to_agent && a.created_at > q.created_at)
      );

      if (unansweredR2Questions.length > 0) {
        const questionToAnswer = unansweredR2Questions[0];
        const respondingAgent = agents.find(a => a.id === questionToAnswer.to_agent);
        
        if (respondingAgent) {
          const questionsForAgent = round2Questions
            .filter(q => q.to_agent === respondingAgent.id)
            .map(q => q.content);

          const prompt = `
            Topic: "${project.topic}"
            Your Role: ${respondingAgent.persona}

            You are in the FINAL round (Round 3) of a roundtable discussion. Other experts asked you these follow-up questions:
            ${questionsForAgent.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

            Provide concise, final answers to each question. Do NOT ask any new questions.

            Your entire response must be ONLY a single, raw, valid JSON object:
            {
              "answers": [
                { "question": "The question", "answer": "Your final answer" }
              ]
            }
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
          });

          const result = JSON.parse(response.text);

          // Save final answers to transcript
          if (result.answers) {
            for (const answer of result.answers) {
              await supabase
                .from('transcript_items')
                .insert({
                  meeting_id: currentMeeting.id,
                  type: 'answer',
                  content: `Final Answer: "${answer.question}" with "${answer.answer}"`,
                  agent_id: respondingAgent.id,
                  from_agent: respondingAgent.id
                });
            }
          }
        }
      }

    } else if (nextAction === 'synthesis') {
      // Generate meeting summary
      const transcriptText = transcriptItems
        ?.filter(item => item.type === 'response' || item.type === 'answer')
        ?.map(item => `[${item.agent_id}]: ${item.content}`)
        ?.join('\n\n') || '';

      const summaryPrompt = `
        You are an expert meeting facilitator. Analyze the following roundtable meeting transcript.
        Topic: "${project.topic}"
        Meeting Goal: "${currentMeeting.goal}"
        Participants: ${agents.map(a => a.name).join(', ')}

        Transcript:
        ${transcriptText}

        Generate a comprehensive summary as a JSON object with keys: "keyInsights", "actionItems", "potentialRisks", and "consensusPoints". Each key must have an array of strings.
      `;

      const summaryResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: summaryPrompt,
        config: { responseMimeType: "application/json" }
      });

      const summary = JSON.parse(summaryResponse.text);

      // Calculate duration (simplified)
      const startTime = transcriptItems?.[0]?.created_at;
      const endTime = new Date().toISOString();
      const duration = startTime ? 
        `${Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)}m` : 
        '0m';

      // Update meeting with summary and mark complete
      await supabase
        .from('meetings')
        .update({
          summary,
          duration,
          status: 'COMPLETED'
        })
        .eq('id', currentMeeting.id);

      // Add synthesis complete message
      await supabase
        .from('transcript_items')
        .insert({
          meeting_id: currentMeeting.id,
          type: 'system',
          content: 'Meeting summary complete.'
        });

      return new Response(
        JSON.stringify({ 
          action: 'meeting_completed',
          meeting: { ...currentMeeting, summary, duration, status: 'COMPLETED' },
          project
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return current state
    const updatedTranscript = await supabase
      .from('transcript_items')
      .select('*')
      .eq('meeting_id', currentMeeting.id)
      .order('created_at');

    return new Response(
      JSON.stringify({
        action: 'turn_completed',
        meeting: currentMeeting,
        transcript: updatedTranscript.data,
        agents,
        project
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in run-meeting-turn:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});