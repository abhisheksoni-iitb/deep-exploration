/*
  # Roundtable Meeting Agent Database Schema

  1. New Tables
    - `projects` - Main project container with topic and final summary
    - `meetings` - Individual meetings within a project
    - `meeting_agents` - Junction table for meeting participants
    - `transcript_items` - Individual conversation items in meetings
    - `agent_feedback` - User ratings for agent contributions

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (single-user app for now)

  3. Features
    - Auto-generated UUIDs for primary keys
    - Timestamps for audit trail
    - JSONB for flexible data storage
    - Foreign key constraints for data integrity
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'IN_PROGRESS', 'COMPLETED')),
  final_summary jsonb,
  meeting_plan jsonb,
  user_id uuid -- For future auth implementation
);

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_index integer NOT NULL DEFAULT 0,
  goal text NOT NULL,
  summary jsonb,
  user_input text,
  duration text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, meeting_index)
);

-- Create meeting_agents junction table
CREATE TABLE IF NOT EXISTS meeting_agents (
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  PRIMARY KEY (meeting_id, agent_id)
);

-- Create transcript_items table
CREATE TABLE IF NOT EXISTS transcript_items (
  id bigserial PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('system', 'response', 'question', 'answer')),
  content text NOT NULL,
  sources jsonb DEFAULT '[]'::jsonb,
  agent_id text,
  from_agent text,
  to_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create agent_feedback table
CREATE TABLE IF NOT EXISTS agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- For future auth
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, meeting_id, agent_id)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_transcript_items_meeting_id ON transcript_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcript_items_created_at ON transcript_items(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_user_meeting ON agent_feedback(user_id, meeting_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (single-user app)
-- Note: In production with auth, these would be restricted to authenticated users

CREATE POLICY "Public access to projects"
  ON projects
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to meetings"
  ON meetings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to meeting_agents"
  ON meeting_agents
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to transcript_items"
  ON transcript_items
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to agent_feedback"
  ON agent_feedback
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);