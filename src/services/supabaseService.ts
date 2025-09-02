import { supabase } from '../lib/supabase';
import { PlannedMeeting, HistoryItem, FeedbackState } from '../types';

export interface ProjectResponse {
  project_id: string;
  meeting_plan: PlannedMeeting[];
  meetings: any[];
}

export interface MeetingTurnResponse {
  action: 'meeting_started' | 'turn_completed' | 'meeting_completed' | 'final_synthesis_needed' | 'project_complete';
  meeting?: any;
  transcript?: any[];
  agents?: any[];
  project?: any;
}

export interface FinalReportResponse {
  project: any;
  finalSummary: any;
}

export const planMeetings = async (topic: string): Promise<ProjectResponse> => {
  // Get user's API key if available
  const userApiKey = localStorage.getItem('gemini_api_key');
  const headers: Record<string, string> = {};
  
  if (userApiKey) {
    headers['Authorization'] = `Bearer ${userApiKey}`;
  }

  const { data, error } = await supabase.functions.invoke('plan-meetings', {
    body: { topic },
    headers
  });

  if (error) {
    throw new Error(error.message || 'Failed to plan meetings');
  }

  return data;
};

export const runMeetingTurn = async (projectId: string): Promise<MeetingTurnResponse> => {
  // Get user's API key if available
  const userApiKey = localStorage.getItem('gemini_api_key');
  const headers: Record<string, string> = {};
  
  if (userApiKey) {
    headers['Authorization'] = `Bearer ${userApiKey}`;
  }

  const { data, error } = await supabase.functions.invoke('run-meeting-turn', {
    body: { projectId },
    headers
  });

  if (error) {
    throw new Error(error.message || 'Failed to run meeting turn');
  }

  return data;
};

export const synthesizeFinalReport = async (projectId: string): Promise<FinalReportResponse> => {
  // Get user's API key if available
  const userApiKey = localStorage.getItem('gemini_api_key');
  const headers: Record<string, string> = {};
  
  if (userApiKey) {
    headers['Authorization'] = `Bearer ${userApiKey}`;
  }

  const { data, error } = await supabase.functions.invoke('synthesize-final-report', {
    body: { projectId },
    headers
  });

  if (error) {
    throw new Error(error.message || 'Failed to synthesize final report');
  }

  return data;
};

export const addUserInput = async (meetingId: string, userInput: string): Promise<{ success: boolean }> => {
  const { data, error } = await supabase.functions.invoke('add-user-input', {
    body: { meetingId, userInput }
  });

  if (error) {
    throw new Error(error.message || 'Failed to add user input');
  }

  return data;
};

export const getProjectHistory = async () => {
  try {
    // First check if we have the required environment variables
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration. Please check your .env file.');
    }

    const { data, error } = await supabase.functions.invoke('get-project-history', {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (error) {
      console.error('Supabase function error:', error);
      throw new Error(`Failed to get project history: ${error.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error in getProjectHistory:', error);
    throw error;
  }
};

export const saveAgentFeedback = async (
  meetingId: string, 
  agentId: string, 
  rating: 'up' | 'down',
  userId: string = 'anonymous'
): Promise<{ success: boolean }> => {
  const { data, error } = await supabase.functions.invoke('save-agent-feedback', {
    body: { meetingId, agentId, rating, userId }
  });

  if (error) {
    throw new Error(error.message || 'Failed to save agent feedback');
  }

  return data;
};

// Helper function to get current project state
export const getCurrentProject = async (projectId: string) => {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(`
      *,
      meetings (
        *,
        meeting_agents (agent_id),
        transcript_items (*)
      )
    `)
    .eq('id', projectId)
    .single();

  if (projectError) {
    throw new Error('Failed to fetch project');
  }

  return project;
};