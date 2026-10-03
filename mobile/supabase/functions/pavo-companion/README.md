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

## Guardrails

- Every free-text field passes through `redact.ts`, which replaces emails,
  Philippine mobile numbers, and 10+ digit ID numbers (such as LRNs) before
  anything reaches OpenAI. It is pattern-based and does not catch names in prose,
  so clients still must not send names.
- Model and moderation calls time out after 40 s and 10 s. A timeout returns a
  friendly 504; clients keep the teacher's work and continue offline.
- Successful responses carry `x-pavo-model` and `x-pavo-generated-at` headers.
  The web studio stores them as draft provenance. Teachers must approve each
  draft before publishing, and published packages record the model, time,
  source IDs, approver, and whether the teacher edited the draft.
- Rate limiting is 12 requests per 10 minutes per client IP, held in function
  memory. It resets on cold start and is not shared across instances. Move it
  to a Postgres counter if usage logs show abuse.

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
