import { GoogleGenAI } from "npm:@google/genai@^1.16.0";
import { createClient } from "npm:@supabase/supabase-js@^2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SynthesizeFinalReportRequest {
  projectId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get API key from request headers or environment
    const authHeader = req.headers.get('authorization');
    const userApiKey = authHeader?.replace('Bearer ', '');
    const apiKey = userApiKey || Deno.env.get('GEMINI_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const ai = new GoogleGenAI({ apiKey });

    const { projectId }: SynthesizeFinalReportRequest = await req.json();

    // Get project and all completed meetings
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'COMPLETED')
      .order('meeting_index');

    if (meetingsError) {
      throw new Error('Error fetching meetings');
    }

    if (!meetings || meetings.length === 0) {
      throw new Error('No completed meetings found');
    }

    // Create synthesis prompt
    const meetingSummaries = meetings.map((meeting, index) => `
      ---
      Meeting ${index + 1} (Goal: ${meeting.goal})
      - Key Insights: ${meeting.summary?.keyInsights?.join('; ') || 'None'}
      - Action Items: ${meeting.summary?.actionItems?.join('; ') || 'None'}
      - Potential Risks: ${meeting.summary?.potentialRisks?.join('; ') || 'None'}
      - Consensus Points: ${meeting.summary?.consensusPoints?.join('; ') || 'None'}
      ${meeting.user_input ? `- User Feedback: ${meeting.user_input}` : ''}
      ---
    `).join('\n');

    const prompt = `
      You are a Chief of Staff responsible for creating a final executive report for a project. You have been given the summaries from a series of meetings.

      Project Topic: "${project.topic}"

      Here are the meeting summaries in chronological order:
      ${meetingSummaries}

      Your task is to synthesize all of the above information into a single, structured Final Project Report. Do not just repeat the inputs; analyze and consolidate them into a coherent final assessment.

      Your response must be a JSON object with the following structure:
      {
        "executiveSummary": "A concise, high-level paragraph (3-4 sentences) summarizing the project's journey from concept to conclusion, and the final recommendation.",
        "keyDecisionsAndPivots": [
          "A bulleted list of the most critical decisions made or strategic pivots that occurred during the meetings."
        ],
        "finalActionPlan": [
          "A consolidated, prioritized list of the most important, actionable next steps for the project to move forward."
        ],
        "outstandingRisks": [
          "A bulleted list of the most significant risks that remain unresolved or require ongoing monitoring."
        ],
        "projectConclusion": "A clear, one-sentence final recommendation for the project (e.g., 'Proceed with funding and begin MVP development.', 'Conduct further market research before committing resources.', 'Shelve the project due to significant market risks.')."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const finalSummary = JSON.parse(response.text);

    // Update project with final summary
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        final_summary: finalSummary,
        status: 'COMPLETED'
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      throw new Error('Failed to update project with final summary');
    }

    return new Response(
      JSON.stringify({
        project: updatedProject,
        finalSummary
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in synthesize-final-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});