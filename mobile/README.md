# WAIS Android

WAIS is an Android-first Expo React Native app for fully offline classroom
learning. React Native renders the interface, Expo SQLite stores shared student
and teacher data, and a Kotlin Expo module provides Android Nearby Connections
module transfer.

This build intentionally has no Supabase client, Edge Functions, cloud auth,
OTA module download, or callable AI service.

## Current offline flows

- Parent-guided student registration and learning-format assessment
- Persistent student profile and canonical Profile QR
- Local teacher profile with name, age, and faculty ID
- Teacher sections with one authoritative active section
- Profile QR scan into the active section roster, with update instead of
  duplicate behavior
- Assignment QR creation for module and quiz tasks
- Student Assignment QR scanning with merge-only local deadlines
- Empty first-run module library with a teacher-transfer waiting state
- Teacher Markdown module authoring with local WebP images
- Manual concept ID, importance, and review-item authoring
- Native Markdown rendering with raw HTML disabled
- Offline on-device text-to-speech
- Multiple-choice and enumeration quiz UI, per-question timing, results, and
  breakdown
- Multipart Quiz Report QR generation and teacher import
- Flashcards, SM-2 spaced repetition, retrieval practice, interleaving, custom
  review sets, blurting, and a Pomodoro wrapper
- Local student and class performance summaries and teacher-only leaderboard
- Android Nearby Connections package transfer with verification, cancel, and
  resume support
- Disabled `AI assist coming soon` and `AI approach plan coming soon` slots

## Module packages

The only implemented module source is `teacher-bluetooth`.

A `.wais-module` file is a bounded ZIP archive containing:

- `manifest.json`
- one local Markdown file
- optional local MP3 audio
- optional local WebP assets

Every content file has a SHA-256 checksum in the manifest. Archive paths,
expanded sizes, file counts, Markdown size, audio size, and image sizes are
validated before installation. Attached images are converted to WebP at 80%
quality and resized so their longest edge is at most 1080 pixels.

## Run on Android

Requirements:

- Node.js and npm
- Android Studio SDK and an Android emulator or device
- Android Studio's bundled Java 21

```bash
npm install
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run android
```

For an already-built development client, start Metro with:

```bash
npm start
```

## Validate

```bash
npm run validate
npx expo-doctor
```

The Jest suite covers adaptive learning, SM-2 review behavior, canonical QR
envelopes and multipart reports, manifest validation, and bounded module archive
extraction.

## Native Android transport

`modules/wais-nearby/android` uses Google Nearby Connections with
`P2P_POINT_TO_POINT`. Connection verification exchanges the small handshake and
metadata payloads. Nearby selects the available Bluetooth/BLE and local Wi-Fi
transport for the file payload. The app verifies the archive checksum before
installing it and preserves transfer state for offset-based retry.

Two physical Android devices remain the authoritative acceptance environment
for radio interruption and resume behavior.
