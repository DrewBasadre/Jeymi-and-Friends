# PAVO Backend Setup Decisions

Online-mode infrastructure is intentionally not finalized until the project
owner confirms the decisions below. The app continues to use bundled content
and offline features when these values are absent.

## Supabase

- [ ] Confirm whether a Supabase project already exists or must be created.
- [ ] Choose one storage bucket for all modules or separate buckets by
  grade/subject.
- [ ] Choose teacher authentication: email/password, magic link, or device
  identity.
- [ ] Confirm whether students need cloud accounts or remain local-only.
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` through environment configuration.
- [ ] Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` through environment configuration.
- [ ] Set `EXPO_PUBLIC_SUPABASE_MODULE_BUCKET` after the bucket decision.

Until the bucket variable is configured, OTA module setup deliberately falls
back to the bundled dataset. No project ID or credential is hardcoded.

## AI Provider

- [ ] Select OpenAI, Anthropic, Google Gemini, or another provider.
- [ ] Confirm API access and billing status.
- [ ] Confirm that the provider's data-handling terms have been reviewed for
  de-identified student-performance patterns.

The existing client contract continues to call protected Supabase Edge
Functions. The functions remain inactive until `PAVO_AI_PROVIDER` is explicitly
set, and provider credentials and model names belong only in Edge Function
secrets.

## Push Notifications

- [ ] Confirm an Expo/EAS account for parent digests and review reminders.
- [ ] Configure parent-device registration before enabling remote delivery.

The local digest and same-device OS notification remain available without this
configuration.

## SMS Fast-Follow

- [ ] If SMS enters scope, select Twilio or a Philippines-focused provider such
  as Semaphore or Movider.

No SMS integration is included in the MVP.

## Error Monitoring

- [ ] Confirm whether Sentry or another monitoring provider will be used.
- [ ] Create the project and configure its DSN through EAS/environment secrets.

## Distribution

- [ ] Confirm Apple Developer Program membership status.
- [ ] Confirm Google Play Console account status.
- [ ] Confirm the Expo/EAS organization that will own production builds.

Simulator and local development builds do not require production distribution
accounts.
