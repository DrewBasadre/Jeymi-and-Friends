# WAIS

WAIS is an Android-first, offline-first learning hub for Filipino classrooms.
The active application is the Expo React Native project in
[`mobile`](./mobile). It stores learning data in SQLite, ships a grade-specific
demo library with the app, and transfers teacher-authored modules directly
between Android devices without requiring internet access.

The bundled lessons are original demo material aligned to MATATAG Quarter 1
competencies. They are not official curriculum text.

## Highlights

- 180 detailed demo modules across Grades 1-10
- Science, Math, and English coverage for every grade
- 360 bundled WebP diagrams and teaching aids
- Grade-based library provisioning during student registration and sign-in
- Multiple-choice, fill-in-the-blank, and identification quizzes
- Offline Markdown lessons, text-to-speech, inline recall, and progress tracking
- Active recall, SM-2 spaced repetition, retrieval practice, interleaving, and
  Pomodoro study sessions
- Student dashboard charts, deterministic WAIS buddy feedback, deadlines, and
  due-review tracking
- Parent-PIN-protected learning-format edits and weekly progress digest
- Teacher sections, assignments, record book, report QR scanning, module
  authoring, and Android Nearby Connections transfer
- No runtime AI or required cloud service

See [APP_CAPABILITIES.md](./APP_CAPABILITIES.md) for the complete feature
inventory.

## Run The Android App

```bash
cd mobile
npm install
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run android
```

This app uses a custom Android Nearby Connections module and therefore requires
a development build rather than Expo Go.

## Validate

```bash
cd mobile
npm run seed:validate
npm run validate
npx expo-doctor
npx expo export --platform android
```

## Repository Layout

- `mobile/src` - active React Native application
- `mobile/seed` - static lesson sources, quizzes, manifests, images, and module
  archives
- `mobile/modules/wais-nearby/android` - native Android nearby-transfer module
- `APP_CAPABILITIES.md` - current product capability inventory
- `ANDROID_HARDWARE_ACCEPTANCE.md` - two-device transfer acceptance checklist
- `app` - earlier native Android prototype retained for reference

## GitHub

<https://github.com/DrewBasadre/Jeymi-and-Friends>
