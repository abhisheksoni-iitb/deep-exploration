/*
  # Initial Database Schema for Roundtable Meeting Agent

  1. New Tables
    - `projects` - Stores top-level project information and final summaries
    - `meetings` - Individual meetings within a project series
    - `meeting_agents` - Join table linking agents to meetings
    - `transcript_items` - All transcript events with chronological ordering
    - `agent_feedback` - User ratings for agent contributions

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access only their own data

  3. Features
    - Full project lifecycle tracking from planning to completion
    - Structured transcript storage with proper relationships
    - User feedback system for agent performance
*/

-- Projects table: Top-level project information
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'IN_PROGRESS', 'COMPLETED')),
  final_summary jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Meetings table: Individual meetings within a project
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
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

-- Meeting agents join table: Links agents to meetings
CREATE TABLE IF NOT EXISTS meeting_agents (
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  PRIMARY KEY (meeting_id, agent_id)
);

-- Transcript items: All events in a meeting's transcript
CREATE TABLE IF NOT EXISTS transcript_items (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('system', 'response', 'question', 'answer')),
  content text NOT NULL,
  sources jsonb DEFAULT '[]'::jsonb,
  agent_id text,
  from_agent text,
  to_agent text,
  created_at timestamptz DEFAULT now()
);

-- Agent feedback: User ratings for agent contributions
CREATE TABLE IF NOT EXISTS agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  agent_id text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, meeting_id, agent_id)
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can manage their own projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for meetings
CREATE POLICY "Users can manage meetings in their projects"
  ON meetings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = meetings.project_id 
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = meetings.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for meeting_agents
CREATE POLICY "Users can manage agents in their meetings"
  ON meeting_agents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      JOIN projects ON projects.id = meetings.project_id
      WHERE meetings.id = meeting_agents.meeting_id 
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      JOIN projects ON projects.id = meetings.project_id
      WHERE meetings.id = meeting_agents.meeting_id 
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for transcript_items
CREATE POLICY "Users can manage transcript items in their meetings"
  ON transcript_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      JOIN projects ON projects.id = meetings.project_id
      WHERE meetings.id = transcript_items.meeting_id 
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      JOIN projects ON projects.id = meetings.project_id
      WHERE meetings.id = transcript_items.meeting_id 
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for agent_feedback
CREATE POLICY "Users can manage their own agent feedback"
  ON agent_feedback
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_transcript_items_meeting_id ON transcript_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcript_items_created_at ON transcript_items(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_user_meeting ON agent_feedback(user_id, meeting_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();