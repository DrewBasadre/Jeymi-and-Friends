# WAIS App Capabilities

This document inventories the current Android application in
[`mobile`](./mobile). WAIS is offline-first: core student, parent, teacher,
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
- Static manifests, Markdown, quiz JSON, images, and `.wais-module` archives
- Honest demo labeling rather than a claim of official curriculum text

## Student Setup And Profile

- Parent-guided profile registration
- Grade, section, birthday, student number, and local sign-in PIN
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
- Deterministic WAIS buddy encouragement based on local progress
- Dedicated Home, Modules, Study, Scan, Reports, and Profile tabs

## Lessons And Modules

- Subject filters for Science, Math, English, and teacher-added materials
- Downloaded lesson status and best quiz score
- Native Markdown rendering with raw HTML disabled
- Local WebP lesson-image rendering
- On-device text-to-speech
- Lesson read and completion tracking
- Format-specific study prompts
- Pre-tagged terms that open deterministic fill-in-the-blank recall
- Student-selected text spans that open the same offline recall activity
- No connectivity or model dependency for inline recall

## Quizzes And Reports

- Multiple-choice questions
- Fill-in-the-blank questions
- Identification questions
- Options restricted to multiple-choice questions
- Exact local answer grading with case and surrounding-space normalization
- Per-question and total attempt timing
- Unlimited attempts with attempt numbering
- Mastery, strong-topic, weak-topic, and full answer breakdown
- Deterministic WAIS buddy feedback after each quiz
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
- Camera-based profile and quiz-report scanning
- Multipart report assembly
- Offline diagnostic suggestions
- Teacher Markdown module authoring
- Local image selection, WebP conversion, and size limiting
- Review-item authoring with concept and importance metadata
- Custom review-set sharing
- No active AI generation path

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
- Additive database migrations
- App-private module and transfer storage
- Static `seed-bundle` registry included by Metro
- Canonical module manifests with source, version, content paths, assets,
  checksums, quiz ID, and review items
- Supported source values: `seed-bundle`, `teacher-bluetooth`, and reserved
  `supabase-ota`
- Zod validation for manifests, quiz JSON, and QR payloads
- No runtime LLM, image generation, or required backend
- No student data leaves the device in the implemented core flows

## Current Constraints

- Expo Go cannot load the custom native Nearby module; use a development build.
- Nearby interruption and resume must be accepted on two physical Android
  devices because an emulator cannot validate real radio behavior.
- Resume state belongs to the current sender process; reopening the sender starts
  a new transfer.
- Separate-parent-device delivery is not implemented; the digest is local with a
  same-device notification fallback.
- `supabase-ota` is reserved in the manifest schema but OTA delivery is not
  active.

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
