/*
  # Roundtable Meeting Agent Database Schema

  1. New Tables
    - `roundtable_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `topic` (text)
      - `status` (text: 'planning', 'in_progress', 'completed')
      - `meeting_plan` (jsonb)
      - `final_summary` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `roundtable_meetings`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to roundtable_sessions)
      - `meeting_index` (integer)
      - `goal` (text)
      - `agent_ids` (jsonb array)
      - `meeting_data` (jsonb)
      - `transcript` (jsonb)
      - `summary` (jsonb)
      - `duration` (text)
      - `user_feedback` (text)
      - `status` (text: 'pending', 'in_progress', 'completed')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `roundtable_responses`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, foreign key to roundtable_meetings)
      - `agent_id` (text)
      - `round_number` (integer: 1, 2, or 3)
      - `response_data` (jsonb)
      - `sources` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add indexes for performance

  3. Functions
    - Add trigger function for updating timestamps
*/

-- Create roundtable_sessions table
CREATE TABLE IF NOT EXISTS roundtable_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed')),
  meeting_plan jsonb DEFAULT '[]'::jsonb,
  final_summary jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create roundtable_meetings table
CREATE TABLE IF NOT EXISTS roundtable_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES roundtable_sessions(id) ON DELETE CASCADE,
  meeting_index integer NOT NULL,
  goal text NOT NULL,
  agent_ids jsonb DEFAULT '[]'::jsonb,
  meeting_data jsonb DEFAULT '{}'::jsonb,
  transcript jsonb DEFAULT '[]'::jsonb,
  summary jsonb,
  duration text,
  user_feedback text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create roundtable_responses table
CREATE TABLE IF NOT EXISTS roundtable_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES roundtable_meetings(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  round_number integer NOT NULL CHECK (round_number IN (1, 2, 3)),
  response_data jsonb NOT NULL,
  sources jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE roundtable_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roundtable_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE roundtable_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roundtable_sessions
CREATE POLICY "Users can manage own sessions"
  ON roundtable_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for roundtable_meetings
CREATE POLICY "Users can manage meetings in own sessions"
  ON roundtable_meetings
  FOR ALL
  TO authenticated
  USING (session_id IN (
    SELECT id FROM roundtable_sessions WHERE user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT id FROM roundtable_sessions WHERE user_id = auth.uid()
  ));

-- RLS Policies for roundtable_responses
CREATE POLICY "Users can manage responses in own meetings"
  ON roundtable_responses
  FOR ALL
  TO authenticated
  USING (meeting_id IN (
    SELECT rm.id FROM roundtable_meetings rm
    JOIN roundtable_sessions rs ON rm.session_id = rs.id
    WHERE rs.user_id = auth.uid()
  ))
  WITH CHECK (meeting_id IN (
    SELECT rm.id FROM roundtable_meetings rm
    JOIN roundtable_sessions rs ON rm.session_id = rs.id
    WHERE rs.user_id = auth.uid()
  ));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_roundtable_sessions_user_id ON roundtable_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_roundtable_sessions_status ON roundtable_sessions(status);
CREATE INDEX IF NOT EXISTS idx_roundtable_meetings_session_id ON roundtable_meetings(session_id);
CREATE INDEX IF NOT EXISTS idx_roundtable_meetings_status ON roundtable_meetings(status);
CREATE INDEX IF NOT EXISTS idx_roundtable_responses_meeting_id ON roundtable_responses(meeting_id);
CREATE INDEX IF NOT EXISTS idx_roundtable_responses_agent_round ON roundtable_responses(agent_id, round_number);

-- Add triggers for updated_at
CREATE TRIGGER update_roundtable_sessions_updated_at
  BEFORE UPDATE ON roundtable_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roundtable_meetings_updated_at
  BEFORE UPDATE ON roundtable_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();