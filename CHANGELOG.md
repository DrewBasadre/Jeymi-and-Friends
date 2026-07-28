# Changelog

All notable changes to WAIS are summarized here in a public-facing format.

## Unreleased

- Added a repository README with the app overview, capabilities, setup steps,
  demo access, and public release notes.
- Reworked project documentation so it describes WAIS as a product and codebase
  rather than only as internal revision notes.
- Cleaned the design system document to remove stale internal generator
  references and align terminology with the WAIS rebrand.
- Removed tracked local Kotlin compiler error output and local VS Code settings.
- Expanded `.gitignore` to keep local IDE, emulator, package, and Kotlin build
  artifacts out of the public tree.
- Added `local.properties.example` for local SDK and Gemini API key setup.
- Renamed the Gradle root project from `LearningHubPH` to `WAIS`.
- Updated user-facing QR error text from LearningHub wording to WAIS wording.
- Stopped pre-filling the teacher password field and applied password masking.

## 1.0.0 - 2026-04-26

- Rebranded the app to WAIS.
- Added the animated splash screen and updated app icon assets.
- Added reusable Compose design atoms for branded headers, profile rows,
  attempts, analysis cards, assessment cards, and subject navigation.
- Updated student performance and profile surfaces to use the shared design
  system components.
- Polished module library and dashboard UI behavior.

## 0.4.0 - 2026-04-26

- Added curriculum ingestion, chunking, embedding, and retrieval services.
- Added Gemini-backed lesson plan generation grounded in retrieved curriculum
  context.
- Added gated quiz generation that only runs after lesson completion is
  unlocked.
- Added append-only changelog utilities for generation, quiz, config, and error
  events.
- Switched Gurobot generation to Gemini 2.5 Flash.

## 0.3.0 - 2026-04-26

- Added the Scholar Indigo visual system and Compose implementation.
- Revamped student and teacher UI flows.
- Added Bluetooth text sharing for generated lesson plans.
- Expanded Gurobot with generated teacher materials and teacher action support.

## 0.2.0 - 2026-04-25

- Added QR-centered student and teacher workflows.
- Added student profile QR creation and teacher QR importing.
- Added quiz result and progress transfer payloads.
- Added QR scanner support through CameraX, ML Kit, and ZXing.
- Added Room migrations from version 1 to version 3 with exported schemas.
- Added profile images, birthday, middle initial, read lesson tracking, attempt
  counting, and module completion.
- Added teacher record book filtering, individual student performance views, and
  generated teaching suggestions.

## 0.1.0 - 2026-04-25

- Created the offline-first Android MVP.
- Added student and teacher roles.
- Added seeded Grade 5 students, modules, quiz questions, attempts, progress,
  and a sample lesson plan.
- Added local Room persistence, Jetpack Compose screens, dashboards, module
  library, lesson reader, quizzes, quiz results, and JSON progress export.
