# WAIS Mobile

Cross-platform, offline-first WAIS client for Android and iOS. The app uses
Expo prebuild/CNG because PDF rendering and Google Nearby Connections require
custom native code; it does not run in Expo Go.

## Capabilities

- Student learning-style assessment and personalized module ordering
- Bundled offline Grade 5 dataset plus one-time Supabase dataset download
- Offline SQLite progress, unlimited quiz attempts, per-question timing, and
  validated multipart QR reports
- Adaptive learning-format recommendations with student/parent overrides
- Offline SM-2 review with active recall, retrieval quizzes, interleaving,
  Pomodoro sessions, blurting, and custom review sets
- Weekly parent digests with notification and in-app delivery
- Offline OS text-to-speech and local PDF reading
- Offline teacher QR scanning, record book, leaderboard, and support flags
- Consent-gated Supabase profile/attempt sync with retry queue
- Authenticated lesson-plan and de-identified diagnostic Edge Functions
- Canonical manifests and checksum-verified PDF/custom-set transfer through
  Google Nearby Connections on Android and iOS
- Legacy WAIS QR/data import compatibility documented in `../MIGRATION_AUDIT.md`

## Setup

```sh
npm install
cp .env.example .env.local
npx expo prebuild --clean
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for cloud
features. Apply `supabase/migrations/202607280001_initial_wais.sql`, deploy the
three Edge Functions, and set `GEMINI_API_KEY` as an Edge Function secret. Promote
teacher accounts to the `teacher` role through trusted administration; new auth
accounts default to `student`. Apply both migrations in filename order.

## Run And Build

```sh
npm run typecheck
npm test
npx --yes deno-bin test supabase/functions/_shared/privacy_test.ts
npx --yes deno-bin check supabase/functions/lesson-plan/index.ts \
  supabase/functions/student-diagnostic/index.ts \
  supabase/functions/cloud-voice/index.ts
npx expo-doctor
```

Android local build:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo prebuild --clean --no-install
cd android && ./gradlew :app:assembleDebug
```

iOS requires full Xcode and CocoaPods. Open the generated workspace only after:

```sh
npx expo prebuild --clean --no-install
cd ios && pod install
```

EAS development, preview, and production profiles are in `eas.json`.

## Native Transfer

The Android module lives in `modules/wais-nearby`; the iOS Expo inline module
lives in `src/native/WaisNearby.swift`. The config plugin pins Google's Swift
package and configures iOS Bonjour/local-network declarations. Transfer uses an
explicit code confirmation, app-private storage, SHA-256 verification, progress,
cancellation, and metadata/PDF payload separation.

Google Nearby Connections negotiates Bluetooth and local Wi-Fi transports
internally. Its file-payload API reports progress but does not expose verified
chunk offsets, so an interrupted file currently retries from the beginning.
True chunk-level resume requires an application-level chunk protocol and remains
the one transport constraint against the locked MVP specification.

Weekly digests schedule an OS notification on the device holding the student
profile when it is online and remain available in-app otherwise. Delivery to a
separate parent phone requires parent-device token registration and configured
push credentials, which are not present in this repository.

Physical acceptance requires one Android and one iOS development build:

1. Open **Offline module transfer** on the teacher device and choose a PDF.
2. Open **Receive a module** on the student device.
3. Discover/connect and confirm that the same code appears on both devices.
4. Send the PDF, cancel/retry once, then verify it opens offline after airplane mode.
5. Generate a quiz QR on the student device, scan it on the teacher device, and
   verify student association, score, total duration, and per-question timing.

Bluetooth and camera acceptance cannot be certified with simulators.

## Modes And Privacy

Lightweight mode disables cloud controls while preserving every core learning
workflow. Full mode adds downloads, cloud backup, AI, and a short cloud voice
sample while on-device speech remains the baseline. AI requests require a
Supabase session and reject direct identifier keys recursively. Student
diagnostics send only module ID, missed-topic tags, a timing pattern, and the
learning format used; the online call also requires guardian consent. Raw
answers, student names, and student IDs remain local.
