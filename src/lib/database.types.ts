export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';
          final_summary: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          status?: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';
          final_summary?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic?: string;
          status?: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';
          final_summary?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      meetings: {
        Row: {
          id: string;
          project_id: string;
          meeting_index: number;
          goal: string;
          summary: any | null;
          user_input: string | null;
          duration: string | null;
          status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          meeting_index?: number;
          goal: string;
          summary?: any | null;
          user_input?: string | null;
          duration?: string | null;
          status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          meeting_index?: number;
          goal?: string;
          summary?: any | null;
          user_input?: string | null;
          duration?: string | null;
          status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
          created_at?: string;
          updated_at?: string;
        };
      };
      meeting_agents: {
        Row: {
          meeting_id: string;
          agent_id: string;
        };
        Insert: {
          meeting_id: string;
          agent_id: string;
        };
        Update: {
          meeting_id?: string;
          agent_id?: string;
        };
      };
      transcript_items: {
        Row: {
          id: number;
          meeting_id: string;
          type: 'system' | 'response' | 'question' | 'answer';
          content: string;
          sources: any;
          agent_id: string | null;
          from_agent: string | null;
          to_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          meeting_id: string;
          type: 'system' | 'response' | 'question' | 'answer';
          content: string;
          sources?: any;
          agent_id?: string | null;
          from_agent?: string | null;
          to_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          meeting_id?: string;
          type?: 'system' | 'response' | 'question' | 'answer';
          content?: string;
          sources?: any;
          agent_id?: string | null;
          from_agent?: string | null;
          to_agent?: string | null;
          created_at?: string;
        };
      };
      agent_feedback: {
        Row: {
          id: string;
          user_id: string;
          meeting_id: string;
          agent_id: string;
          rating: 'up' | 'down';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          meeting_id: string;
          agent_id: string;
          rating: 'up' | 'down';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          meeting_id?: string;
          agent_id?: string;
          rating?: 'up' | 'down';
          created_at?: string;
        };
      };
    };
  };
}