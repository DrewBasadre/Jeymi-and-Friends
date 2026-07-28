# WAIS React Native Migration Audit

Audit date: 2026-07-28

This report satisfies Phase 0 of the React Native migration brief. It records
the current Android app shape, transfer behavior, QR contracts, persistence
model, and the decisions that must be closed before migration code starts.

## Executive Summary

The current WAIS application is a native Android app written in Kotlin and
Jetpack Compose. It is not a WebView hybrid and contains no JavaScript business
logic to port. The migration will therefore translate Kotlin domain and
repository behavior into TypeScript while preserving the existing Room and QR
data contracts.

The current app has:

- Local student and teacher workflows backed by Room database version 3.
- Seeded Grade 5 Science, Math, and English modules stored as text.
- Aggregate quiz attempts, module progress, dashboards, and QR exchange.
- Android camera scanning through CameraX and ML Kit, image decoding through
  ML Kit with a ZXing fallback, and QR generation through ZXing.
- Direct client-to-Gemini requests with an API key embedded in `BuildConfig`.
- An Android share-sheet action labeled as Bluetooth sharing that sends a
  generated text file.

The current app does not have:

- A WebView, embedded JavaScript, or reusable JavaScript business logic.
- A Bluetooth protocol implementation (neither RFCOMM/SPP nor BLE/GATT).
- PDF module packages, PDF viewing, or PDF transfer.
- Per-question response persistence or per-question timing.
- Learning-style profiles or assessments.
- Flashcards or spaced-repetition scheduling.
- Supabase, cloud sync, Edge Functions, or server-side AI proxying.
- iOS code or cross-platform tests.

## Baseline Verification

The existing Android baseline was checked before any migration work:

- `ANDROID_HOME=/Users/drewbasadre/Library/Android/sdk ./gradlew testDebugUnitTest`
  passes.
- `ANDROID_HOME=/Users/drewbasadre/Library/Android/sdk ./gradlew assembleDebug`
  passes.
- The build emits the already-documented D8/Kotlin metadata warnings caused by
  the Android Gradle Plugin 8.7.3 and Kotlin 2.2.21 pairing.
- Only one unit-test source exists:
  `LearningCalculationsTest.kt`.

## 1. App Shape

### Architecture

WAIS is a single Android application module:

- UI: Jetpack Compose screens and shared components.
- Navigation: Navigation Compose routes in `LearningHubNav.kt`.
- State: one `LearningHubViewModel` exposing Room-backed flows.
- Domain logic: calculation helpers and domain models.
- Persistence: Room database and repositories.
- QR exchange: Kotlin serialization models and `SyncRepository`.
- AI: direct Gemini REST calls plus local fallback generation.
- Curriculum experiments: text ingestion, chunking, Gemini embeddings,
  retrieval, lesson generation, and quiz generation.

There are no `.js`, `.ts`, `.tsx`, or HTML application sources under
`app/src/main`, and no use of `WebView`, `JavascriptInterface`, or
`addJavascriptInterface`.

### Screen Map

Student routes and responsibilities:

| Current screen | Current responsibility | React Native destination |
| --- | --- | --- |
| Role selection | Choose student or teacher flow | Root role screen |
| Student login | Local identifier and PIN login | Student auth/onboarding |
| Student info QR | Create or update a local profile and profile QR | Student setup/profile |
| Student dashboard | Progress, average, strengths, weak topic | Student home |
| Module library | Filter modules and launch lessons/quizzes | Modules tab |
| Digital lesson / lesson | Read text content and mark progress | Module reader/PDF reader |
| Quiz | Answer questions and submit an aggregate attempt | Timed quiz |
| Quiz result | Show best result and QR payload | Result and report |
| Student QR | Profile/result/progress QR workflows | Reports tab |
| Student scanner | Import teacher-created module QR | Module import |
| Student profile | Local student details and image URI | Profile tab |

Teacher routes and responsibilities:

| Current screen | Current responsibility | React Native destination |
| --- | --- | --- |
| Teacher login | Hard-coded local demo credentials | Teacher auth |
| Teacher dashboard | Local aggregate metrics and learner flags | Teacher home |
| Record book | Local per-student aggregate rows | Record book |
| Teacher scanner | Import student/profile/progress QR payloads | Report scanner |
| Student performance | Attempts and generated teaching suggestions | Learner detail |
| Gurobot | Generate and save lesson content | Online AI lesson planner |
| Lesson plan library | View and share generated text lessons | Curated modules |
| Student view | Preview modules as a learner | Module preview |
| Sync | Legacy progress JSON import/export | Compatibility/import tools |

### Porting Consequence

The migration is a behavior port, not a JavaScript reuse exercise. Kotlin logic
worth translating directly includes:

- `LearningCalculations`
- quiz attempt limit and best-attempt selection
- module completion rules
- dashboard aggregation
- QR normalization, decoding, and import identity matching
- offline Gurobot fallback templates

## 2. Bluetooth and PDF Transfer

### Current Implementation

The current app has no Bluetooth stack. `shareGurobotLessonText` writes a
temporary UTF-8 `.txt` file and opens Android's `ACTION_SEND` chooser with the
title "Share lesson text via Bluetooth." The receiving transport is selected by
the user or operating system.

Evidence:

- No Bluetooth permissions exist in `AndroidManifest.xml`.
- No RFCOMM sockets, SPP UUIDs, BLE scans, GATT services, or characteristics
  exist in the source.
- No Bluetooth dependency exists in Gradle.
- No iOS implementation exists.

The correct audit answer is therefore "neither classic nor BLE"; the current
feature is a generic Android share sheet.

### PDF Size Check

There are zero PDF files in this repository. The existing modules are text
records seeded into Room. No WAIS/Grade 5 PDF package was found in the common
project and download locations, so an actual target-package throughput test
cannot yet be performed.

Representative production PDF packages are required before the transfer
transport can be signed off. Record at least:

- minimum, median, p90, and maximum package size;
- whether packages contain mostly text, raster scans, or embedded media;
- expected number of modules transferred in one classroom session;
- oldest target Android and iOS physical devices.

### Transport Options

| Option | Strengths | Constraints | Audit recommendation |
| --- | --- | --- | --- |
| BLE/GATT only | Direct, offline, available through iOS Core Bluetooth | Low practical throughput, chunking/retry complexity, poor fit for large PDFs | Reserve for pairing and small report payloads |
| App-managed local Wi-Fi | High throughput and no internet requirement | Discovery, hotspot, permissions, TLS/auth, and lifecycle must be built | Viable fallback if Nearby is rejected |
| Google Nearby Connections | Offline peer-to-peer, encrypted, uses Bluetooth/BLE/Wi-Fi, supports file payloads on Android and iOS | Requires native SDK integration and Bluetooth/local-network permissions; validate target device support | Preferred for PDF package transfer |

Preferred direction: use Google Nearby Connections for discovery, authenticated
pairing, and file payload transfer, wrapped in local Expo native modules for
Android and iOS. Keep QR for small reports and compatibility. Do not build a
BLE-only PDF path.

This is not final until representative WAIS PDF sizes are supplied and transfer
time is measured on physical low-end Android and iOS devices.

Primary references:

- Google Nearby Connections overview:
  https://developers.google.com/nearby/connections/overview
- Google Nearby Connections Swift setup:
  https://developers.google.com/nearby/connections/swift/get-started
- Apple Bluetooth development:
  https://developer.apple.com/bluetooth/

## 3. QR System

### Libraries

- Generation: ZXing `QRCodeWriter`.
- Live camera scan: CameraX preview plus ML Kit Barcode Scanning.
- Uploaded image scan: ML Kit first, ZXing `QRCodeReader` fallback.
- Serialization: Kotlin serialization with lenient parsing and unknown-key
  tolerance.

### Existing Payload Contracts

`student_profile`:

```text
payloadType, studentId, studentNumber, firstName, lastName, middleInitial,
gradeLevel, section, birthday
```

`quiz_result`:

```text
payloadType, attemptId, studentId, studentNumber, firstName, lastName,
middleInitial, displayName, gradeLevel, section, moduleId, moduleTitle, subject,
competencyCode, score, totalItems, weakTopic, strongTopic, masteryLevel,
durationSeconds, attemptNumber, submittedAt
```

`progress_export`:

```text
payloadType, studentId, displayName, gradeLevel, section, schoolYear,
quizAttempts[], completedModules[], weakTopics[], gradeCompletionPercent
```

Each `quizAttempts[]` item contains:

```text
attemptId, moduleId, score, totalItems, weakTopic, strongTopic, masteryLevel,
durationSeconds, attemptNumber, submittedAt
```

`teacher_module`:

```text
payloadType, moduleId, title, subject, gradeLevel, quarter, moduleNumber,
competencyCode, content, questions[]
```

Each `questions[]` item contains:

```text
id, type, questionText, choices[], correctAnswer, topicTag
```

### Compatibility Rules to Preserve

- Unknown JSON keys are ignored.
- Missing newer fields use model defaults where defined.
- Input may be direct JSON, a nested JSON string, or a common wrapper object.
- A missing/blank `payloadType` is treated as a legacy `progress_export`.
- Imported attempts use conflict-ignore by `attemptId`.
- Student matching prioritizes student ID, then student number, then name.
- Teacher module imports create local module and question records.

### Required Version 2 Extension

Do not mutate the legacy shapes in place. Introduce a versioned envelope while
continuing to decode all four legacy payloads:

```json
{
  "schemaVersion": 2,
  "payloadType": "quiz_result",
  "report": {
    "legacyFields": "preserved",
    "timePerQuestionMs": {},
    "learningStyleTag": "visual"
  }
}
```

The exact v2 schema should be fixture-tested in both TypeScript and Kotlin
before replacing the Android app.

## 4. Storage and Data Schemas

### Current Persistence

Room database `learning_hub.db`, schema version 3, is the sole application
store. Modules and questions are seeded on first launch when the student table
is empty. Profile images are represented by a local URI string. There is no
filesystem-managed module package store.

Tables:

- `students`
- `modules`
- `quiz_questions`
- `quiz_attempts`
- `progress`
- `lesson_plans`
- `teacher_materials`

### Exact Entity Shapes

`StudentEntity`:

```text
id, studentNumber, firstName, lastName, middleInitial, name, gradeLevel,
section, birthday, profileImageUri, pin, avatarColor, isArchived
```

`ModuleEntity`:

```text
id, title, subject, gradeLevel, quarter, competencyCode, content,
isTeacherCreated
```

`QuizQuestionEntity`:

```text
id, moduleId, type, questionText, choicesJson, correctAnswer, topicTag
```

`QuizAttemptEntity`:

```text
id, studentId, moduleId, score, totalItems, weakTopic, strongTopic,
masteryLevel, durationSeconds, attemptNumber, submittedAt
```

`ProgressEntity`:

```text
id, studentId, moduleId, status, masteryLevel, updatedAt
```

`LessonPlanEntity`:

```text
id, title, subject, gradeLevel, competencyCode, topic, generatedContent,
createdAt
```

`TeacherMaterialEntity`:

```text
id, title, subject, gradeLevel, content
```

### Missing Schemas Required by the New Product

The React Native local database must add versioned tables for:

- module package metadata and local PDF/text asset paths;
- individual question responses and per-question timing;
- learning-style assessment answers, result, version, and consent metadata;
- content tags and recommendation decisions;
- flashcards;
- spaced-repetition review state;
- transfer sessions, file checksums, and import status;
- cloud-sync queue, tombstones, and conflict metadata;
- privacy/guardian acknowledgement state.

The current app does not store a student response entity. Quiz answer maps live
only in Compose memory and are discarded after the aggregate attempt is saved.

### Migration Path

Use a TypeScript legacy importer rather than trying to read the Android Room
file directly on both platforms:

1. Preserve the existing QR/JSON importers as legacy schema v1.
2. Add a one-time export option to the old Android app if full local migration
   is required.
3. Import legacy students, modules, attempts, and progress into the new local
   SQLite schema.
4. Generate stable compatibility IDs and retain original IDs for deduplication.
5. Cover all committed Room schema versions and QR fixtures with migration
   tests.

## 5. AI Data Handling Decision

### Current Risk

The current Android app embeds `GEMINI_API_KEY` in `BuildConfig` and calls
Gemini directly. Diagnostic prompts include a named student's record-book row
and attempt evidence. This must not be carried forward.

### Required Architecture

- All AI calls go through authenticated Supabase Edge Functions.
- No provider API key is stored in the client bundle.
- The mobile client sends a minimized diagnostic object, not a student record.
- The Edge Function validates the schema, strips unexpected fields, applies
  rate limits, calls the provider, and returns suggestions.
- Provider requests must not include student name, student number, birthday,
  section, profile image, raw answer text, or stable local/cloud student ID.
- The teacher maps the returned suggestion back to the learner locally.

Proposed minimized diagnostic input:

```text
gradeLevel, subject, competencyCode, scoreBand, durationBand,
topicOutcomeCounts, attemptTrend, learningStyleTag
```

Use coarse bands where exact values are not necessary. Do not retain provider
request bodies or model outputs in Edge Function logs. Set an explicit short
retention policy for application records and contractually prohibit provider
training on submitted data.

### Philippines Data Privacy Gate

Educational information is sensitive personal information under the Data
Privacy Act. Before AI diagnostics launch:

- identify the school/operator as the personal information controller and
  document each processor/subprocessor;
- complete a child privacy impact assessment before launch and review it as the
  system changes;
- establish and document an appropriate lawful basis, including verified
  parent/guardian involvement where required by the risk assessment;
- provide standard, child-friendly, and just-in-time privacy notices;
- document purpose, fields, recipients, processing location, retention,
  deletion, security, and data-subject rights;
- execute processor/outsourcing terms with Supabase and the model provider;
- implement access control, encryption, incident response, deletion, and
  auditability;
- keep AI output advisory and teacher-reviewed, never an automated decision
  that determines a learner's rights or access.

This is an engineering decision record, not legal advice. The production data
flow and notices require review by the deploying institution's Data Protection
Officer or qualified Philippine privacy counsel.

Primary references:

- Data Privacy Act:
  https://privacy.gov.ph/data-privacy-act/
- DPA implementing rules:
  https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/
- Education Sector Advisory No. 2020-1:
  https://privacy.gov.ph/wp-content/uploads/2020/10/DP-Council-Education-Sector-Advisory-No.-2020-1.pdf
- Guidelines on Child-Oriented Transparency:
  https://privacy.gov.ph/wp-content/uploads/2024/12/Advisory-2024.12.17-Guidelines-on-Child-Oriented-Transparency-w-SGD.pdf

## 6. Google Stitch Export Decision

No Google Stitch, Figma, HTML/CSS, design export, or Stitch share link is
present in the repository or common project folders.

Google's official descriptions confirm that Stitch exports front-end code and
can hand designs to Figma. Google's current 2026 workflow also supports export
to Google Antigravity and web publishing. None of these is a direct React
Native component contract.

Decision: treat the Stitch artifact as a visual and token source. Manually map
its typography, color, spacing, components, responsive behavior, and assets to
React Native styles and components. Do not paste generated web markup into the
mobile app or place it in a WebView.

The actual artifact format still must be confirmed by receiving one of:

- a Stitch export archive;
- exported HTML/CSS plus assets;
- a Figma file/link;
- a Stitch share link and screen images.

If no Stitch artifact will be supplied, the existing Scholar Indigo Compose
design system becomes the migration source of truth.

Primary references:

- Google Stitch introduction:
  https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/
- 2026 Stitch update:
  https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/

## 7. Pre-Implementation Decision Gate

Migration implementation is intentionally paused until these inputs are
acknowledged:

1. Supply representative WAIS PDF module packages for size measurement and
   approve Google Nearby Connections as the preferred transfer layer, or select
   the app-managed local Wi-Fi alternative.
2. Approve the minimized, Edge-Function-only AI data boundary and assign the
   deploying institution's privacy/DPO review before production use.
3. Supply the actual Stitch export/share artifact, or explicitly approve the
   existing Scholar Indigo design system as the React Native visual source.

After this gate, implementation can begin with the local TypeScript data
contracts, legacy import fixtures, offline database, and navigation shell
before adding online Supabase capabilities.
