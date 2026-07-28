# WAIS Android Discovery Audit

Date: 2026-07-28

This audit maps the existing repository before the Android-only offline build
described in the unified student and teacher specification.

## App shape

- The app is an Expo React Native application rendered with native React Native
  components. It is not a WebView application.
- Navigation and screens live in `mobile/src/navigation` and
  `mobile/src/screens`.
- Shared TypeScript domain logic lives in `mobile/src/domain`.
- Local persistence lives in an Expo SQLite database implemented by
  `mobile/src/data/database.ts`, `repository.ts`, and `mvpRepository.ts`.
- Android proximity transport is a native Expo module written in Kotlin at
  `mobile/modules/wais-nearby/android`. TypeScript calls it through
  `mobile/src/services/nearby.ts`.
- Native Markdown rendering uses `react-native-markdown-display`; raw HTML is
  disabled and package images resolve from local files.

## Existing proximity transfer

- The Android implementation uses Google Nearby Connections, not classic
  RFCOMM/SPP.
- Nearby Connections advertises and discovers with the point-to-point strategy.
  Its Android transport can negotiate Bluetooth/BLE for discovery and local
  Wi-Fi for bulk payload delivery.
- Connection verification, file metadata, progress events, SHA-256 package
  verification, cancellation, and offset-based retry state are present.
- The transfer artifact is a `.wais-module` ZIP containing `manifest.json`,
  Markdown, and local assets.
- Two-device discovery, interrupted transfer, and resume still require an
  Android device or emulator acceptance run.

## Existing QR system

- Camera scanning uses `expo-camera`; QR display uses
  `react-native-qrcode-svg`.
- The current decoder supports several legacy `payloadType` envelopes plus a
  partial quiz-report schema.
- The required canonical `qrType` router and assignment envelope are not yet
  consistently implemented.
- The teacher has a scanner tab. The student does not yet have the required
  dedicated Scan tab.

## Existing local storage

- Expo SQLite with WAL and foreign keys stores students, learning profiles,
  adaptive-format history, modules, quiz questions and attempts, progress,
  flashcards, SM-2 review state, custom review sets, Pomodoro sessions, module
  manifests, scanned reports, and transfer sessions.
- Section, roster, assignment, student-task, and local teacher-profile tables
  are missing.
- Seeded bundled modules currently make a new student's library non-empty,
  conflicting with the required teacher-transfer-first empty state.
- Cloud sync queue and privacy/cloud fields remain from an earlier scope and
  are not part of this Android-only offline pass.

## Existing data shapes

- `Student`, `LearningModule`, `QuizQuestion`, `QuizAttempt`, `ReviewItem`,
  `ReviewState`, and adaptive learning-format types are shared in
  `mobile/src/domain/types.ts`.
- SM-2 and adaptive-format computations are shared pure functions in
  `mobile/src/domain/review.ts`.
- Quiz questions currently include legacy true/false and identification
  values. The unified spec permits only multiple-choice and enumeration for
  graded quizzes.
- Module manifests currently admit legacy `bundled` and `supabase-ota` sources.
  Runtime support must be restricted to `teacher-bluetooth` in this pass.

## Required corrections

1. Replace legacy QR routing with the canonical `profile`, `assignment`, and
   `quizReport` envelopes and validate every encode/decode boundary.
2. Add SQLite-backed teacher profiles, sections, active-section state, roster
   placement, assignments, and merge-only student tasks.
3. Add the student Scan tab and persistent Profile QR; add teacher Assignment
   QR generation for the active section.
4. Remove cloud, AI, OTA, and seeded-content runtime paths. Keep only visibly
   disabled UI entry points for future AI assist and diagnostic plans.
5. Restrict graded quiz types and module runtime sources to the unified
   offline schema.
6. Complete Android runtime acceptance for authoring, scanning, transfer,
   checksum verification, cancellation, and resume.
