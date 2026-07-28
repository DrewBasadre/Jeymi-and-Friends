# WAIS App Capabilities

WAIS is an Android-first, offline-first learning application with shared-code
iOS compatibility. The current implementation is maintained in the
[`mobile`](./mobile) directory.

## Student Experience

- Student profile creation and PIN-based offline sign-in
- Parent or guardian-assisted initial setup
- Learning-style assessment
- Adaptive text, audio, visual, or kinesthetic format recommendation
- Recommendations recalculated from completion and quiz performance
- Manual learning-format overrides
- Personalized module ordering
- Dashboard showing completion, average score, attempts, due reviews,
  strengths, and suggested practice
- Grade 5 Science, Math, and English content bundled for offline use
- Subject filtering and teacher-added materials
- Native Markdown module reader with local WebP lesson images
- On-device text-to-speech
- Optional cloud-generated voice
- Offline progress and completion tracking
- Unlimited quiz attempts
- Learning-format selection for each attempt
- Per-question and total quiz timing
- Mastery, strong-topic, and weak-topic results
- Offline quiz-report QR generation
- Automatic multipart QR reports when payloads become too dense

## Study Tools

- SM-2 spaced-repetition scheduling with 0-5 ratings
- Active-recall flashcards with hidden answers
- Retrieval-practice quizzes that delay feedback until completion
- Interleaved practice across different concepts
- Self-explanation and blurting exercises
- Pomodoro sessions with configurable work and break lengths
- Pomodoro queue sizing based on the learner's historical response times
- Review events from Pomodoro sessions update the same SM-2 schedule
- Student-created and teacher-created review sets
- Selection of existing review items or creation of new prompt-and-answer items
- Concept, importance, type, author, and tag metadata
- Private or class-shared review-set visibility

## Reports And Privacy

- Zod validation before QR generation and after scanning
- Timing included for every question
- Answer details included only for missed questions
- No question text embedded in QR reports
- No correct-answer details included for correctly answered questions
- Corrupted or incomplete multipart scans are rejected
- Legacy WAIS QR payload compatibility
- Raw answers remain local
- AI requests exclude student names, IDs, birthdays, sections, and raw answers
- Recursive identifier and privacy checks in Edge Functions
- Content-safety checks before AI output is displayed

## Teacher Workspace

- Offline demo teacher sign-in and Supabase teacher authentication
- Local class dashboard based entirely on scanned reports
- Class average using the latest student attempt per module
- Teacher-only leaderboard
- Configurable struggling threshold at 50%, 60%, or 70%
- Support flags for low scores or three-attempt declining trends
- Searchable local record book
- Learner averages, attempts, completed modules, and practice priorities
- Recommended learning format with confidence percentage
- Camera-based QR scanning and multipart report assembly
- De-identified learner diagnostic suggestions
- Offline diagnostic fallback
- Editable suggestion drafts
- Protected Gurobot lesson-plan generation
- Lesson-plan requests grounded in class average and commonly missed topics
- Teacher review-set authoring
- Markdown module authoring and review-set distribution tools

## Offline Transfer

- Shared canonical manifest for Supabase and teacher-transferred content
- Manifest version, source, content paths, assets, checksums, quiz ID, and
  review items
- Android and iOS Google Nearby Connections modules
- Bluetooth and local Wi-Fi transport negotiation
- Pairing-code confirmation
- App-private received-file storage
- SHA-256 integrity verification
- Transfer progress and cancellation
- In-process interrupted-transfer resume using Google Nearby payload offsets
- Point-to-point Android strategy for the highest available one-to-one bandwidth
- `.wais-module` archives containing Markdown, WebP assets, and manifests
- Teacher and cloud-prepared photos capped at 1080 pixels on the longest edge
- Provider-independent OTA module preparation with exact manifests and
  upload-ready database records
- ZIP expansion, file-count, and per-file limits for low-memory Android devices
- Imported review items immediately join the normal study scheduler

## Parent And Cloud Features

- Template-based weekly parent digest
- Completed modules, study-time trend, current format preference, and home
  suggestion
- Android notification delivery with offline in-app fallback
- Consent-controlled Supabase profile and attempt synchronization
- Retry queue for interrupted synchronization
- One-time curriculum dataset download
- Supabase migrations for manifests, attempts, formats, and review data
- Authenticated lesson-plan, diagnostic, and cloud-voice Edge Functions
- Lightweight offline mode and full online-enhancement mode

## Platform And Architecture

- React Native and Expo prebuild application with Android as the primary target
- Offline-first SQLite persistence
- Additive database migrations that preserve existing student data
- App-private module and transfer storage
- Native Android and iOS Nearby Connections integrations
- Local deterministic review, dashboard, and digest logic
- Supabase authentication, synchronization, storage, and Edge Functions for
  optional online features
- Hermes production bundles for Android and iOS

## Current Constraints

- Android resume state is retained for the current sender process. Reopening
  the sender app starts a new transfer.
- Sending digests to a separate parent phone requires parent-device
  registration and configured push credentials.
- Physical Android-to-Android interruption and resume still needs testing on
  two real devices.
- Cloud AI, synchronization, and voice require Supabase configuration and
  deployed Edge Functions.
- The custom native modules mean the application cannot run in Expo Go.

## Validation Status

- TypeScript validation passes.
- All 30 Jest tests and both cloud-preparation tests pass.
- All three privacy tests and all three provider-gating tests pass.
- Supabase Edge Functions pass Deno type checking.
- The Android debug build succeeds and has been smoke-tested in an emulator.
- The Android native module starts BLE and Wi-Fi LAN discovery on API 36.

## Repository

- GitHub: <https://github.com/DrewBasadre/Jeymi-and-Friends>
- Latest published MVP commit:
  [`e6e0694`](https://github.com/DrewBasadre/Jeymi-and-Friends/commit/e6e06946970a36290992c921a1581d527eb3dfb4)
