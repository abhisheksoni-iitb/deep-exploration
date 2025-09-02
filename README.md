<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This Roundtable Meeting Agent now uses Supabase as a backend for secure, scalable operations.

## Architecture

- **Frontend**: React app that communicates with Supabase
- **Backend**: Supabase with PostgreSQL database and Edge Functions
- **AI**: Gemini API calls handled securely in Edge Functions

## Run Locally

**Prerequisites:**  Node.js

### Setup

1. **Supabase Setup:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the migration: `supabase/migrations/create_roundtable_schema.sql`
   - Deploy the Edge Functions in `supabase/functions/`
   - Add your `GEMINI_API_KEY` to Supabase Edge Function secrets

2. **Environment Variables:**
   - Copy `.env.example` to `.env`
   - Add your Supabase URL and anon key
   - The Gemini API key should be set in Supabase Edge Function secrets, not in the frontend

3. **Install and Run:**
   ```bash
   npm install
   npm run dev
   ```
## Key Changes

- All AI processing now happens securely on the server
- Project history is stored in PostgreSQL instead of localStorage  
- Meeting state is persisted and can be resumed
- Agent feedback is tracked in the database
- API keys and prompts are secure on the backend
