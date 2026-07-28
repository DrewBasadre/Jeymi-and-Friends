# Pavo companion Edge Function

This server boundary keeps the OpenAI key out of the Android bundle. It validates
and limits requests, removes identity fields from the mobile contract, moderates
input and output, and asks the Responses API for strict structured JSON.

The same endpoint supports two deliberately separate experiences:

- Learner `review_lessons` and `ask` conversations
- Parent `weekly_digest` analysis built from anonymized local lesson and quiz
  activity

The Android app never sends a learner's name, student number, section, digest
ID, quiz-attempt ID, or module ID for parent analysis. Offline digest generation
does not call this function.

## Deploy

1. Link the Supabase project:

   ```sh
   npx supabase login
   npx supabase link --project-ref lehlstcntamlxatgkrgv
   ```

2. Set server-only secrets:

   ```sh
   npx supabase secrets set OPENAI_API_KEY=YOUR_KEY OPENAI_MODEL=gpt-5.6-terra
   ```

3. Deploy with JWT verification enabled:

   ```sh
   npx supabase functions deploy pavo-companion
   ```

4. Copy `mobile/.env.example` to `mobile/.env`. The example already contains
   this project's function URL and public publishable key. Restart Expo after
   changing environment variables.

`OPENAI_MODEL` may be changed server-side without rebuilding Android. The default
uses GPT-5.6 Terra for a strong quality, latency, and cost balance. Use
`gpt-5.6-sol` when maximum answer quality matters more than latency and cost.
