# WAIS Supabase backend

The migration creates private module storage, role-linked student and
teacher records, consent-gated cloud quiz sync, and row-level security.
All three Edge Functions require an authenticated Supabase user. Lesson-plan
and diagnostic generation additionally require a teacher or admin role and
reject direct student identifiers before calling Gemini. Cloud voice accepts
only a short text sample and returns WAV audio; the app exposes it only when a
guardian has enabled online AI processing.

## Local setup

1. Install the Supabase CLI and run `supabase start` from `mobile/`.
2. Copy `.env.example` to `functions/.env` and set `GEMINI_API_KEY`.
3. Serve the functions in separate terminals:

   ```sh
   supabase functions serve lesson-plan
   supabase functions serve student-diagnostic
   supabase functions serve cloud-voice
   ```

## Deploy

Link the intended Supabase project, run `supabase db push`, set
`GEMINI_API_KEY` and optionally `GEMINI_MODEL` and `GEMINI_TTS_MODEL` with
`supabase secrets set`, then deploy `lesson-plan`, `student-diagnostic`, and
`cloud-voice`. Leave JWT verification enabled.

The mobile build receives only the public project URL and publishable/anon
key. The Gemini key must never be placed in `EXPO_PUBLIC_*` variables.
