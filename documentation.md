# PAVO Project Documentation

PAVO is an offline-first Android learning hub for elementary classrooms. It
started as LearningHub PH and has since been rebranded around QR-based classroom
sync, local learning modules, teacher analytics, and Gurobot-assisted lesson
support.

## Product Purpose

PAVO helps classrooms keep learning activity moving even when devices are not
always online. Students can read lessons, take quizzes, and generate QR payloads
for their work. Teachers can scan those payloads into a local record book,
review performance patterns, and create additional lessons with Gemini or an
offline fallback.

## Capability Summary

- Student and teacher role selection.
- Student sign-in with student number or last name plus PIN.
- Teacher sign-in for local demo and classroom evaluation.
- Seeded Grade 5 Science, Math, and English modules.
- Digital lesson reading with read tracking.
- Quizzes with multiple question types and a two-attempt limit.
- Best-score handling for final module results.
- Module completion tracking after quiz activity.
- Student profile, quiz result, teacher module, and progress QR payloads.
- QR scanning through camera preview and QR upload from photos.
- Teacher dashboard, leaderboard, record book, and individual performance pages.
- Gurobot lesson generation and teaching action suggestions.
- Offline fallback generation when Gemini is unavailable.
- Curriculum ingestion and retrieval services for grounded lesson and quiz
  generation experiments.

## Student Workflow

Students begin at role selection, sign in, and land on a dashboard showing
progress, completion, average score, attempts, weak topic, and strong topic.
From the bottom navigation they can open modules, QR tools, or their profile.

The module library is organized around Science, Math, English, and Added
Materials. A module can be opened as a digital lesson. After the lesson is read,
quiz access is enabled. Students may take up to two quiz attempts, and PAVO uses
the better attempt for score display and QR export.

Student QR tools support:

- Student information QR generation.
- Teacher module QR scanning.
- QR image upload and decoding.
- Best quiz result QR generation from a module card.
- Progress QR generation through the sync flow.

The profile tab stores student number, name, grade and section, birthday, PIN,
and optional profile image URI in the local Room database.

## Teacher Workflow

Teachers sign in to a dashboard with class average, top learners, low scorers,
and intervention candidates. The record book shows student names, section,
completion, average score, attempts, time, and weak topics.

Teachers can scan or upload QR codes for:

- Student enrollment/profile information.
- Quiz result transfer.
- Full progress export transfer.

Individual student performance pages show the learner's current data and scanned
attempt evidence. Gurobot can generate teaching actions for the next week using
Gemini when configured, or a local fallback when offline.

Teacher student-view mode lets a teacher inspect module content as students see
it. Gurobot-generated lessons can be saved into the local lesson library and
inserted into the module list as additional materials.

## Gurobot And AI Behavior

`GurobotRepository` uses `BuildConfig.GEMINI_API_KEY` and calls Gemini 2.5 Flash
through the Gemini REST API. If the key is blank or the request fails, PAVO
returns offline lesson drafts and offline teaching suggestions.

Gurobot can:

- Generate lesson packages with objectives, key ideas, materials, lesson flow,
  learner activity sheets, differentiation, assessment, remediation, and teacher
  notes.
- Save generated lessons as local teacher lesson plans.
- Save generated lessons as student-visible teacher modules.
- Generate individual teaching action suggestions from record book data and quiz
  attempt evidence.

The curriculum package contains a separate experimental path for curriculum
grounding:

- `CurriculumStore` ingests `.txt`, `.md`, `.csv`, `.json`, streams, or
  URI-backed text sources.
- Text is cleaned, chunked, embedded with Gemini embeddings, and retrieved with a
  local cosine index.
- `LessonPlanService` generates structured lesson plans from retrieved
  curriculum chunks.
- `QuizGenerationService` generates gated quizzes only after a lesson response
  is marked as unlocked.

## QR Data Exchange

QR exchange is handled by `SyncRepository` and the models in
`sync/ProgressExportModels.kt`. The repository normalizes direct JSON, nested
JSON strings, and common payload wrappers before importing.

Supported payload types:

- `student_profile`
- `quiz_result`
- `progress_export`
- `teacher_module`

Teacher imports update the local student roster, quiz attempts, progress, and
record book. Student imports add teacher-created modules and generated questions
to the local module library.

## Architecture

PAVO uses a single Android app module with a simple repository architecture.

- UI: Jetpack Compose screens in `ui/screens`.
- State: `LearningHubViewModel` exposes flows and calls repositories.
- Persistence: Room database entities, DAOs, migrations, and seed data in
  `data/local`.
- Repositories: student, teacher, module, quiz, and sync behavior in
  `data/repository`.
- AI: Gurobot generation in `ai/GurobotRepository.kt`.
- Curriculum services: ingestion, retrieval, lesson generation, and quiz
  generation in `curriculum`.
- Navigation: route definitions in `navigation/LearningHubNav.kt`.

## Data Model

Room tables:

- `students`
- `modules`
- `quiz_questions`
- `quiz_attempts`
- `progress`
- `lesson_plans`
- `teacher_materials`

Important domain models:

- `StudentDashboardSummary`
- `TeacherDashboardSummary`
- `RecordBookRow`
- `QuizResult`
- `GurobotInput`
- `GurobotResponse`

Room schema versions 1, 2, and 3 are exported under `app/schemas`.

## Build And Configuration

PAVO builds with:

- Android Gradle Plugin 8.7.3
- Kotlin 2.2.21
- JVM target 17
- compileSdk 35
- minSdk 23
- targetSdk 35

Local configuration is read from Gradle properties, environment variables, or
`local.properties`. Use `local.properties.example` as the template. Do not commit
real `local.properties` files.

Useful commands:

```sh
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

`assembleDebug` currently succeeds, but D8 may emit Kotlin metadata warnings with
the current Android Gradle Plugin/R8 and Kotlin 2.2.x pairing. These warnings do
not block the debug APK.

## Demo Data

Teacher demo login:

- Teacher Number: `T-1001`
- Password: `teacher123`

Seeded student PINs:

- Ana Reyes: `1111`
- Ben Santos: `2222`
- Carla Dizon: `3333`
- Dan Cruz: `4444`
- Ella Garcia: `5555`
- Felix Lim: `6666`

Students added through teacher-scanned profile QR payloads receive the default
PIN `1234` unless updated later.

## Commit History Analysis

The commit history shows a fast prototype-to-demo progression:

- `eded44d` established the offline-first Android MVP with Room, Compose,
  seeded data, dashboards, lessons, quizzes, and JSON progress export.
- `bc604a4` introduced student and teacher QR workflows, profile payloads,
  scanner support, and database migration version 2.
- A follow-up V2 implementation expanded profile data, completion rules, quiz
  attempt limits, record book behavior, and database migration version 3.
- `ca4149f` added the first project documentation.
- `0d09424` moved Gurobot generation to Gemini 2.5 Flash.
- `a8b4370` added curriculum ingestion, retrieval, grounded lesson generation,
  and quiz generation services.
- `b0699bb` and `e3538c2` added the UI/UX refresh, design tokens, Bluetooth text
  sharing, and Gurobot revamp work.
- `3d1ef0a` tightened the generated curriculum services.
- `041a1f0` polished the module library and dashboard UI.
- `5e5986d` rebranded the app to PAVO and added the splash animation and app
  icon assets.

For a public launch where commit history will be reviewed, publish from a
cleaned or squashed release branch. The current history includes local prototype
commit messages that are not as polished as the code and documentation. This
cleanup updates the working tree but intentionally does not rewrite git history.

## Known Limitations

- Authentication is local demo logic, not production-grade identity management.
- Seeded student records and demo passwords are for evaluation only.
- Gemini features require internet access and a configured API key.
- The current build can print D8 Kotlin metadata warnings even when packaging
  succeeds.
- Offline QR sync is local-device oriented and does not replace a server-backed
  synchronization model.
- Curriculum PDF ingestion is not built in; current curriculum ingestion supports
  text-like sources without adding a PDF parser dependency.
- QR payloads can contain student information. Use demo data unless privacy
  controls and consent processes are in place.
