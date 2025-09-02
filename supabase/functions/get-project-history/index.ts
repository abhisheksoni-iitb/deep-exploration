import { createClient } from "npm:@supabase/supabase-js@^2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Check for required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    );

    // Get all projects with their meetings
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        *,
        meetings (
          *,
          meeting_agents (agent_id),
          transcript_items (*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    // Transform data to match frontend HistoryItem interface
    const historyItems = projects?.map(project => {
      const completedMeetings = project.meetings?.filter(m => m.status === 'COMPLETED') || [];
      const inProgressMeeting = project.meetings?.find(m => m.status === 'IN_PROGRESS');
      
      let status: 'In Progress' | 'Completed' = 'Completed';
      if (project.status !== 'COMPLETED' || inProgressMeeting) {
        status = 'In Progress';
      }

      // Convert meetings to MeetingResult format
      const meetingResults = completedMeetings.map(meeting => ({
        goal: meeting.goal,
        agents: meeting.meeting_agents?.map(ma => ({ id: ma.agent_id })) || [],
        transcript: meeting.transcript_items || [],
        summary: meeting.summary || { keyInsights: [], actionItems: [], potentialRisks: [], consensusPoints: [] },
        duration: meeting.duration || '0m',
        userFeedback: meeting.user_input
      }));

      return {
        id: project.id,
        topic: project.topic,
        date: project.created_at,
        status,
        meetingPlan: project.meeting_plan,
        meetingResults,
        finalSummary: project.final_summary
      };
    }) || [];

    return new Response(
      JSON.stringify({ history: historyItems }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-project-history:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});