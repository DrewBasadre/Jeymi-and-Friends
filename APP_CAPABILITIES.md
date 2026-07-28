# PAVO App Capabilities

This document inventories the current Android application in
[`mobile`](./mobile). PAVO is offline-first: core student, parent, teacher,
reporting, authoring, and transfer workflows run without a server or runtime AI.

## Bundled Curriculum

- 180 original MATATAG Quarter 1-aligned demo modules
- Grades 1-10, with six modules per subject and grade
- Science, Math, and English coverage
- Grade 1 authored and validated first as the pipeline proof
- Grade-appropriate lesson length, vocabulary, examples, guided practice, and
  checks for understanding
- Two module-specific WebP diagrams or teaching aids per module
- 360 total bundled visual assets, each within the 1080-pixel cap
- Five-question quiz and five structured review items per module
- Static manifests, Markdown, quiz JSON, images, and `.pavo-module` archives
- Honest demo labeling rather than a claim of official curriculum text

## Student Setup And Profile

- Parent-guided profile registration
- Grade, section, birthday, student number, parent or guardian name, parent
  mobile number, and local sign-in PIN
- Learning-style assessment and adaptive format recommendation
- Text, audio, visual, and kinesthetic default formats
- Automatic installation of the selected grade's 18-module library
- Idempotent grade-bundle provisioning on later sign-ins
- Profile QR for teacher roster enrollment
- Visible default learning format on Profile
- Parent PIN required only to edit that format or open the weekly digest
- Parent PIN creation on first protected action
- Salted SHA-256 parent PIN storage with no plaintext PIN persistence
- Offline light and full device modes

## Student Home

- One contextual recommended action for the day
- Reviews due, quizzes completed today, and open deadlines
- Upcoming assignment deadlines with urgency progress
- Module-library completion progress
- Seven-day quiz-attempt chart
- Seven-day average-score trend chart
- Deterministic PAVO buddy encouragement based on local progress
- Dedicated Home, Modules, Study, Scan, Reports, and Profile tabs

## Lessons And Modules

- Subject filters for Science, Math, English, and teacher-added materials
- One full-width module per row for quick scanning on phones and tablets
- Downloaded lesson status and best quiz score
- Native Markdown rendering with raw HTML disabled
- Local WebP lesson-image rendering
- On-device text-to-speech
- Lesson read and completion tracking
- Format-specific study prompts
- Pre-tagged terms that open deterministic fill-in-the-blank recall
- Student-selected text spans that open the same offline recall activity
- No connectivity or model dependency for inline recall

## Pavo Online Companion

- Persistent bottom-right Pavo launcher throughout the student tabs
- Mascot growth phase derived from the same real completion and score data as
  the student dashboard
- Dedicated companion dashboard with module completion, average score, reviews
  due, deadlines, and a local to-do list
- Performance-report generation from aggregate learning data
- Review builder with subject, installed lesson, and activity selection
- Generated review lessons, flashcards, multiple-choice quizzes, and mixed
  practice
- Interactive card flipping and locally checked multiple-choice responses
- Guarded 500-character lesson question box
- Local unsafe-request checks plus server-side input and output moderation
- Privacy-minimized requests that omit the student's name, student number,
  section, teacher identity, PIN, birthday, and task IDs
- Visible preparation-status animation without exposing model chain-of-thought
- Explicit offline and unconfigured placeholders; downloaded core learning
  remains available
- Supabase Edge Function boundary so the OpenAI API key never enters the
  Android bundle
- Strict structured JSON responses from the OpenAI Responses API
- Server-side model selection, defaulting to GPT-5.6 Terra

## Quizzes And Reports

- Multiple-choice questions
- Fill-in-the-blank questions
- Identification questions
- Options restricted to multiple-choice questions
- Exact local answer grading with case and surrounding-space normalization
- Per-question and total attempt timing
- Unlimited attempts with attempt numbering
- Mastery, strong-topic, weak-topic, and full answer breakdown
- Deterministic PAVO buddy feedback after each quiz
- Offline quiz-report QR generation
- Automatic multipart report QRs for larger payloads
- Timing included for every question
- Answer details included only for missed questions
- Corrupted and incomplete multipart scans rejected

## Study

- Dedicated Study tab
- Active-recall cards with hidden answers
- SM-2 spaced-repetition scheduling and 0-5 quality ratings
- Retrieval-practice mode with delayed full-set feedback
- Interleaved concept queues
- Inline recall from lesson terms or selected text
- Custom student and teacher review sets
- Core, supplementary, and stretch importance
- Private and class-shared set visibility
- Pomodoro wrapper with configurable work, break, and cycle values
- Queue sizing from historical review timing
- Pomodoro review results updating the same SM-2 schedule

## Parent Weekly Digest

- Parent-PIN-protected access
- Locally generated week-of report
- Modules completed
- Quizzes taken
- Average score and improving, stable, or declining trend
- Review items completed
- Engagement days active
- Top repeatedly missed concepts
- Seven-day score chart
- Seven-day engagement display
- Threshold-driven deterministic insight note
- Same-device Android notification when permission and native support are
  available
- In-app fallback with no network requirement

## Teacher Workspace

- Offline teacher profile and sign-in
- Multiple sections with one active section
- Student profile QR enrollment into the active roster
- Duplicate-safe roster updates
- Module and quiz assignment QR creation
- Searchable local record book
- Class average and teacher-only leaderboard
- Configurable struggling threshold
- Learner support flags for low latest score or declining trend
- Learner quiz history, completed modules, weak topics, and format recommendation
- Parent or guardian contact details visible on each learner profile
- Teacher-to-parent message composer below the learner's AI approach plan
- SMS recipient confirmation, 320-character limit, validation, disabled and
  sending states, and an in-page completion receipt
- Explicit demo SMS transport that performs no network request or real delivery
- Camera-based profile and quiz-report scanning
- Multipart report assembly
- Offline diagnostic suggestions
- Teacher Markdown module authoring
- Local image selection, WebP conversion, and size limiting
- Review-item authoring with concept and importance metadata
- Custom review-set sharing
- Privacy-minimized AI generation for learner intervention approaches, class
  summaries, lesson plans, modules, reviewers, and quizzes when online

## Android Nearby Transfer

- Receive action in the student Profile
- Automatic advertising and waiting state when the receive screen opens
- Pairing-code confirmation
- Automatic module ingestion after the trusted classroom connection
- `Received: <module title>` success confirmation
- Bluetooth, BLE, and local Wi-Fi transport negotiation
- Point-to-point Android strategy
- App-private received-file storage
- Transfer progress, cancellation, retry, and in-process resume
- Archive SHA-256 verification
- Manifest source and version validation
- Per-file, total expansion, image, audio, Markdown, and quiz limits
- Imported review items joining the standard study scheduler
- Seed modules remaining installed when teacher modules are added

## Data And Architecture

- Expo React Native application focused on Android
- Expo SQLite local persistence
- Expo Network connectivity monitoring for the optional online companion
- Additive database migrations
- App-private module and transfer storage
- Static `seed-bundle` registry included by Metro
- Canonical module manifests with source, version, content paths, assets,
  checksums, quiz ID, and review items
- Supported source values: `seed-bundle`, `teacher-bluetooth`, and reserved
  `supabase-ota`
- Zod validation for manifests, quiz JSON, and QR payloads
- No runtime image generation
- No backend is required for core learning, teacher, transfer, or reporting
  flows
- Only privacy-minimized learning context leaves the device when the student
  deliberately runs an online Pavo request

## Current Constraints

- Expo Go cannot load the custom native Nearby module; use a development build.
- Nearby interruption and resume must be accepted on two physical Android
  devices because an emulator cannot validate real radio behavior.
- Resume state belongs to the current sender process; reopening the sender starts
  a new transfer.
- Separate-parent-device delivery is not implemented; the digest is local with a
  same-device notification fallback.
- Teacher-to-parent SMS delivery is simulated in the MVP; the complete
  interaction is present, but no telecom provider is connected.
- `supabase-ota` is reserved in the manifest schema but OTA delivery is not
  active.
- Pavo generation requires a deployed `pavo-companion` Edge Function,
  `OPENAI_API_KEY`, and the two public Expo endpoint variables documented in
  [`mobile/supabase/functions/pavo-companion`](./mobile/supabase/functions/pavo-companion).
- Live model responses cannot run in an unconfigured or offline build; the app
  displays an unavailable state instead.

## Validation Commands

```bash
cd mobile
npm run seed:validate
npm run validate
npx expo-doctor
npx expo export --platform android
```

## Repository

<https://github.com/DrewBasadre/Jeymi-and-Friends>
