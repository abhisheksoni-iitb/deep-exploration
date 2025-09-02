/*
  # Roundtable Meeting Agent Database Schema

  This migration creates the complete database schema for the Roundtable Meeting Agent application.
  It replaces client-side localStorage with proper database storage and enables server-side AI processing.

  ## New Tables
  1. **roundtable_sessions** - Main session/project container
     - `id` (uuid, primary key)
     - `user_id` (uuid, foreign key to users)
     - `topic` (text) - The discussion topic
     - `status` (text) - planning, in_progress, completed
     - `meeting_plan` (jsonb) - Array of planned meetings
     - `final_summary` (jsonb) - Final project summary
     - `created_at`, `updated_at` (timestamps)

  2. **roundtable_meetings** - Individual meetings within a session
     - `id` (uuid, primary key)
     - `session_id` (uuid, foreign key to roundtable_sessions)
     - `meeting_index` (integer) - Order in the series
     - `goal` (text) - Meeting objective
     - `agent_ids` (jsonb) - Array of participating agent IDs
     - `meeting_data` (jsonb) - Round 1, 2, 3 data
     - `transcript` (jsonb) - Meeting transcript
     - `summary` (jsonb) - Meeting summary
     - `duration` (text) - Meeting duration
     - `user_feedback` (text) - User input between meetings
     - `status` (text) - pending, in_progress, completed
     - `created_at`, `updated_at` (timestamps)

  3. **roundtable_responses** - Individual agent responses
     - `id` (uuid, primary key)
     - `meeting_id` (uuid, foreign key to roundtable_meetings)
     - `agent_id` (text) - Agent identifier
     - `round_number` (integer) - 1, 2, or 3
     - `response_data` (jsonb) - Agent's response
     - `sources` (jsonb) - Grounding sources from Gemini
     - `created_at` (timestamp)

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own data
  - Proper foreign key constraints and cascading deletes

  ## Indexes
  - Performance indexes on frequently queried columns
  - Composite indexes for common query patterns
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table if it doesn't exist (for Supabase auth integration)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own profile
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create roundtable_sessions table
CREATE TABLE IF NOT EXISTS roundtable_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed')),
  meeting_plan jsonb DEFAULT '[]',
  final_summary jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on roundtable_sessions
ALTER TABLE roundtable_sessions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sessions
CREATE POLICY "Users can manage own sessions"
  ON roundtable_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create roundtable_meetings table
CREATE TABLE IF NOT EXISTS roundtable_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES roundtable_sessions(id) ON DELETE CASCADE,
  meeting_index integer NOT NULL,
  goal text NOT NULL,
  agent_ids jsonb DEFAULT '[]',
  meeting_data jsonb DEFAULT '{}',
  transcript jsonb DEFAULT '[]',
  summary jsonb,
  duration text,
  user_feedback text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on roundtable_meetings
ALTER TABLE roundtable_meetings ENABLE ROW LEVEL SECURITY;

-- Users can manage meetings in their own sessions
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

-- Create roundtable_responses table
CREATE TABLE IF NOT EXISTS roundtable_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES roundtable_meetings(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  round_number integer NOT NULL CHECK (round_number IN (1, 2, 3)),
  response_data jsonb NOT NULL,
  sources jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on roundtable_responses
ALTER TABLE roundtable_responses ENABLE ROW LEVEL SECURITY;

-- Users can manage responses in their own meetings
CREATE POLICY "Users can manage responses in own meetings"
  ON roundtable_responses
  FOR ALL
  TO authenticated
  USING (meeting_id IN (
    SELECT rm.id 
    FROM roundtable_meetings rm 
    JOIN roundtable_sessions rs ON rm.session_id = rs.id 
    WHERE rs.user_id = auth.uid()
  ))
  WITH CHECK (meeting_id IN (
    SELECT rm.id 
    FROM roundtable_meetings rm 
    JOIN roundtable_sessions rs ON rm.session_id = rs.id 
    WHERE rs.user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roundtable_sessions_user_id ON roundtable_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_roundtable_sessions_status ON roundtable_sessions(status);
CREATE INDEX IF NOT EXISTS idx_roundtable_meetings_session_id ON roundtable_meetings(session_id);
CREATE INDEX IF NOT EXISTS idx_roundtable_meetings_status ON roundtable_meetings(status);
CREATE INDEX IF NOT EXISTS idx_roundtable_responses_meeting_id ON roundtable_responses(meeting_id);
CREATE INDEX IF NOT EXISTS idx_roundtable_responses_agent_round ON roundtable_responses(agent_id, round_number);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roundtable_sessions_updated_at
  BEFORE UPDATE ON roundtable_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roundtable_meetings_updated_at
  BEFORE UPDATE ON roundtable_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();