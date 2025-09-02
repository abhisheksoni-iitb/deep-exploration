import { createClient } from "npm:@supabase/supabase-js@^2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SaveAgentFeedbackRequest {
  meetingId: string;
  agentId: string;
  rating: 'up' | 'down';
  userId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { meetingId, agentId, rating, userId }: SaveAgentFeedbackRequest = await req.json();

    if (!meetingId || !agentId || !rating || !userId) {
      return new Response(
        JSON.stringify({ error: 'meetingId, agentId, rating, and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert feedback (insert or update if exists)
    const { data: feedback, error } = await supabase
      .from('agent_feedback')
      .upsert({
        user_id: userId,
        meeting_id: meetingId,
        agent_id: agentId,
        rating
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save feedback: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, feedback }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-agent-feedback:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});