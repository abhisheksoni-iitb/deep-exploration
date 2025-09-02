import { createClient } from "npm:@supabase/supabase-js@^2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface AddUserInputRequest {
  meetingId: string;
  userInput: string;
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

    const { meetingId, userInput }: AddUserInputRequest = await req.json();

    if (!meetingId || userInput === undefined) {
      return new Response(
        JSON.stringify({ error: 'meetingId and userInput are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the meeting with user input
    const { data: meeting, error } = await supabase
      .from('meetings')
      .update({ user_input: userInput })
      .eq('id', meetingId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update meeting: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, meeting }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in add-user-input:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});