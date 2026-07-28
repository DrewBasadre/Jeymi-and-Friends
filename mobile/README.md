# WAIS Android

WAIS is an Android-first Expo React Native application for offline classroom
learning. React Native renders the interface, Expo SQLite stores student and
teacher data, and a Kotlin Expo module provides Google Nearby Connections
module transfer.

Core learning, quizzes, review, reports, and the parent digest work without a
cloud service. Pavo's learner chat and the optional comprehensive parent
analysis use a secured Supabase Edge Function when internet access is available.

## Current Offline Flows

- Parent-guided student registration and PIN-based sign-in
- Automatic provisioning of 18 modules for the student's selected grade
- 180 total MATATAG-aligned Quarter 1 demo modules across Grades 1-10
- Six Science, six Math, and six English modules per grade
- Two bundled WebP teaching aids, a quiz, and review items in every module
- Native Markdown lesson rendering, offline text-to-speech, and inline recall
- Multiple-choice, fill-in-the-blank, and identification quizzes
- Per-question timing, result breakdowns, mastery, and unlimited attempts
- Home charts for module completion, deadlines, attempts, and score trends
- Deterministic WAIS buddy feedback after quizzes and on Home
- Active recall, SM-2 spaced repetition, retrieval practice, interleaving,
  custom review sets, and Pomodoro sessions
- Parent-PIN-protected default-format editing and weekly digest access
- Offline weekly lesson history, quiz results, scores, engagement, review, and
  concept insights
- Optional online Pavo analysis of anonymized weekly learning data
- Teacher sections, assignment QR codes, student profile scanning, report
  scanning, record book, and learner support flags
- Teacher Markdown module authoring with local WebP images and review items
- Automatic student receive mode from Profile with checksum-verified ingestion

## Module Packages

A `.wais-module` file is a bounded ZIP archive containing:

- `manifest.json`
- one local Markdown lesson
- one quiz JSON file for seed modules
- optional local MP3 audio
- local WebP teaching assets

Every content file has a SHA-256 checksum in the manifest. Archive paths,
expanded sizes, file counts, Markdown size, quiz size, audio size, and image
sizes are validated before installation. Teacher images are converted to WebP
and capped at 1080 pixels on the longest edge.

Supported manifest sources are `seed-bundle`, `teacher-bluetooth`, and the
reserved `supabase-ota` value. The current app provisions seed bundles and
installs teacher transfers locally; OTA delivery is not active.

## Run On Android

Requirements:

- Node.js and npm
- Android Studio SDK and an Android emulator or device
- Android Studio's bundled Java 21

```bash
npm install
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run android
```

For an already-built development client:

```bash
npm start
```

The custom Nearby module means Expo Go is not supported.

Pavo's Android configuration lives in `.env`. Only the Supabase function URL
and public publishable key belong there; `OPENAI_API_KEY` must remain in
Supabase Edge Function secrets.

## Validate

```bash
npm run seed:validate
npm run validate
npx expo-doctor
npx expo export --platform android
```

`npm run seed:generate` regenerates the static seed artifacts and registry.
Seed generation is a development-time authoring task and is never called by the
shipped app.

## Native Android Transport

`modules/wais-nearby/android` uses Google Nearby Connections with
`P2P_POINT_TO_POINT`. Connection verification exchanges a pairing code and
module metadata. Nearby selects Bluetooth, BLE, and local Wi-Fi as available.
The app validates source, manifest, archive limits, and SHA-256 checksums before
installing a received module.

Two physical Android devices remain the authoritative acceptance environment
for radio interruption and transfer resume behavior.
