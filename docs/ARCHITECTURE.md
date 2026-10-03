# PAVO architecture: offline assessment, authoring, and transfer

This document covers the revamp that added paper and digital assessments, the
teacher web studio, export bundles, offline Nearby transfer, result QR codes,
adaptive lessons, external content providers, and AI guardrails. The README
covers the original MVP.

## Layout

| Path | Role |
| --- | --- |
| `mobile/src/domain` | Pure TypeScript schemas and logic. The web studio imports it as `@pavo/domain/*`, so mobile and web share one implementation. |
| `mobile/src/data` | SQLite migrations (schema v9) and repositories |
| `mobile/src/services` | Native bridges, package import, printing, scanning, transfer orchestration |
| `mobile/src/screens` | Assessment, lesson, scan, result-import, and transfer screens |
| `mobile/modules/pavo-omr` | Kotlin + OpenCV answer-sheet engine. `core/` is shared by Android and the desktop fixture tests. |
| `mobile/modules/pavo-nearby` | Native Nearby Connections transport and foreground transfer service |
| `mobile/omr-fixtures/v1` | Versioned OMR fixture suite (original PAVO sheets only) |
| `mobile/supabase/functions/pavo-companion` | The only place the OpenAI key exists |
| `web` | Teacher Studio (Vite + React) |

## Assessment model

A teacher picks the delivery mode before writing questions:

- `paper_omr`: printed question paper and bubble answer sheet, scanned offline
  on the teacher's phone.
- `digital_mini_quiz`: delivered as a student package, completed in the app,
  and returned as one result QR code.

Questions carry topic, competency, difficulty, points, rationale, likely
misconception, and a recommended intervention. Alternate forms (A to D) are
deterministic shuffles of question order and choice order.

### Assessment fingerprint

`assessmentFingerprint` is the first 32 hex characters of
`SHA-256("PAVO-FP-1|quizId|version|formCode|count|id:choiceOrder|…")`. Any
change to the quiz ID, version, form, question order, or choice order changes
the fingerprint. Paper sheets, student quizzes, result QRs, and
`assessment-guide.md` all carry it. The teacher client rejects input whose
fingerprint does not match the installed guide.

### Answer-key isolation

- Student packages never contain `assessment-guide.md` or a teacher answer key.
  Package validation fails if a student-audience manifest lists a teacher-only
  file.
- The student quiz stores `SHA-256("PAVO-KEY-1|fingerprint|questionId|answer")`
  digests so the phone can score offline.
- Result QRs carry failed and unanswered positions only, never answers or
  responses.

**Known limit:** digests stop casual inspection, not a determined student with
developer tools. A multiple-choice question has only a few choices to try
against its digest. Any offline self-scoring quiz has this limit. Use the paper
mode for high-stakes tests.

## `assessment-guide.md`

The guide is the teacher-side answer key and remediation guide. It is readable
Markdown with fixed `- Label: value` lines, so the teacher client can parse it
back without the original authoring data. It contains:

- Front matter: quiz ID, version, mode, grade, and subject.
- Every form, with its code, question order, choice orders, and fingerprint.
- Per question: type, question text, correct answer, rationale, topic,
  competency, difficulty, points, likely misconception, and recommended
  intervention.

`parseAssessmentGuide` round-trips it (see the `assessmentGuide` tests). Paper
grading, result QR import, and item, competency, and remediation analytics all
resolve form positions through this file.

## `adaptive-lesson.md`

The lesson file has front matter followed by fenced blocks:

```
::: concept {id="photosynthesis"}
Markdown body…
:::
```

The block types are `objective`, `concept`, `worked-example`, `visual`,
`read-aloud`, `guided-practice`, `hints`, `check`, `practice`, `reflection`,
`remediation`, `extension`, and `checkpoint`:

- `hints` is an ordered list that is revealed one rung at a time.
- `check` holds a prompt with `- [ ]` and `- [x]` choices, or an `answer="…"`
  attribute. Checks are formative and are never recorded as quiz scores.

`lessonAdaptation` reorders steps or inserts review steps from the learner's
evidence and records a plain-language "Why?" for each change.

## Export bundle (web studio and Android)

`buildExportBundle` produces one zip:

| File | Audience |
| --- | --- |
| `manifest.json` | Bundle manifest |
| `module.pdf` | Printable lesson |
| `adaptive-lesson.md` | Lesson source |
| `assessment-guide.md` | Teacher only |
| `packages/<id>-v<n>.pavo-module` | Student package to send by Nearby |
| `packages/<id>-teacher-v<n>.pavo-module` | Teacher bundle: guide and key, with the student package embedded |
| `answer-sheet-template.json` | Paper mode only |
| `paper/quiz-paper-form-X.pdf` and `paper/answer-sheet-form-X.pdf` | Paper mode, one pair per form |

### Package manifest (schema v2)

The manifest records:

- `packageId`, `version`, `packageType` (`lesson`, `quiz` or
  `teacher_bundle`), and `audience`.
- The assessment's quiz ID, version, mode, canonical order, and per-form
  fingerprints.
- A file list with path, MIME type, size, and SHA-256, plus the summed
  `contentBytes`.
- `attribution`: authors, license, source URL, and notice.
- `redistribution`: student-to-student, teacher-to-teacher, and expiry.
- `provenance`: whether AI assisted, the model, generation time, source IDs,
  approver, approval time, and whether the teacher edited the draft.
- An optional Ed25519 `signature`.

The runtime parser is loose, so newer fields survive and signatures still
verify. The TypeScript type is strict.

Published versions are immutable. Editing after publishing starts version
n + 1 with the same package ID.

## Paper answer sheet and OMR

### Template format

`buildAnswerSheetTemplate` produces JSON in PDF points, with the origin at the
top left. It contains:

- Four 24 pt corner markers inset 36 pt, plus an orientation mark.
- A `PVS1` sheet code (in a QR and printed text) carrying the quiz, version,
  form, and template.
- Class-number digit columns.
- Bubble centres in columns of 25 rows.

The standard layouts are 20×4, 30×5, 50×5, and 100×5. Version: template schema 1,
layout 1.

### Pipeline (Kotlin + OpenCV, on device, no network)

1. Live frames are checked against `FRAME_LIMITS`:

   | Check | Limit |
   | --- | --- |
   | Coverage | ≥ 0.30 |
   | Sharpness (Laplacian variance) | ≥ 60 |
   | Glare | ≤ 4% |
   | Perspective | ≥ 0.72 |
   | Grid drift | ≤ 3 pt |
   | Lighting evenness | ≥ 0.45 |

   The teacher sees a plain-language message for each failure. Auto-capture
   fires after 3 consecutive ready frames with markers stable within 1.2%.
2. Marker detection. Candidates smaller than 22% of the largest are dropped,
   which rejects QR finder patterns. The orientation mark fixes rotation.
3. The sheet is warped to the template with a perspective transform.
4. The sheet code is read and checked against the installed quiz version and
   form. A wrong form or version is rejected.
5. Ink is measured in each bubble's inner circle, then `classifyBubbles` runs.

### Confidence rules

Each fill is measured relative to the sheet's median blank bubble (capped at
0.25; a higher median flags the sheet as low contrast). Then:

| Condition | Result |
| --- | --- |
| Fill ≥ 0.62 | Marked |
| 0.20 ≤ fill < 0.62 | Faint: the question is ambiguous and needs review |
| Two or more marked bubbles | Multiple marks: needs review |
| One marked bubble plus faint residue, separation < 0.30 | Ambiguous (possible erasure) |
| Confidence < 0.60, or a low-contrast sheet | Needs review |

The engine never guesses silently.

### Review and correction

The scan screen overlays each detection. The teacher must resolve every flagged
question before grading. Each override is stored in `paper_corrections` with
the original and corrected values, the time, and the teacher ID, so it is
auditable.

Other paper workflow rules:

- Duplicate sheets are detected.
- Scan images are kept only when the quiz opts in (`retainScanImages`).
- A correctly completed master sheet can be scanned as an alternate way to
  enter the answer key.

### Fixture suite

`mobile/omr-fixtures/v1` holds the fixtures. TypeScript writes specs and
templates, Kotlin renders and photographs each sheet, then measures it, and
Jest classifies the measurements. The cases cover:

- Rotation and perspective
- Uneven light, shadow, glare, and blur
- Faint marks, erasures, and multiple marks
- Partially covered markers

Regenerate with `npm run omr:fixtures`.

## Digital mini-quiz workflow

1. The teacher authors the quiz in the app or the web studio, then publishes
   and exports it.
2. The teacher installs the teacher bundle, then sends the student package with
   **Send nearby**.
3. The student completes the quiz offline. Progress resumes after the app
   closes.
4. On finish, the phone scores locally and shows one result QR.
5. The teacher scans it on **Import result**. The QR is decoded, checked for
   checksum, version, and fingerprint, mapped through the local guide, and
   turned into item and competency analytics plus a remediation plan.

No result file and no cloud sync are needed.

## Result QR: `PAVO_RESULT_V1`

- Wire format: `PVR1:` + Base45(CBOR map), or `PVR1Z:` + Base45(DEFLATE(CBOR))
  when that is shorter. A result that is still too large is split into
  `PVR1M:` parts carrying a group ID and an aggregate checksum.
- CBOR keys:

  | Key | Field |
  | --- | --- |
  | 0 | Schema |
  | 1 | Student ID |
  | 2 | Quiz ID |
  | 3 | Quiz version |
  | 4 | Package ID |
  | 5 | Fingerprint |
  | 6 | Attempt |
  | 7 | Question count |
  | 8 | Score |
  | 9 | Total points |
  | 10 | Incorrect bitset |
  | 11 | Unanswered bitset |
  | 12 | Completed at |
  | 13 | Result ID |
  | 14 | Key ID |
  | 30 | Checksum |
  | 31 | Signature |

- Bitsets are LSB-first over 1-based form positions: position p is bit
  `(p-1) % 8` of byte `floor((p-1) / 8)`. The teacher maps positions to
  canonical questions through the form's order in `assessment-guide.md`.
- Validation runs in this order: prefix, schema version, then checksum, then
  installed quiz and version, then fingerprint, then duplicate result ID.

**Integrity is not authenticity.** The checksum only catches damaged or
mistyped QRs; anyone can craft a QR with a valid checksum. The result is
marked **Signed by enrolled device** only when the optional Ed25519 signature
matches a key the teacher enrolled from the learner's profile QR. Otherwise it
is shown as **Unverified** or **Unknown device**.

## Offline Nearby package transfer

The protocol is `PAVO-XFER/1` over an authenticated Nearby Connections link:

1. The receiver scans the sender's pairing QR, so only that phone connects.
2. The sender sends an `offer`: package type and audience, size, SHA-256,
   manifest digest, and whether the transfer can resume.
3. The receiver checks:
   - its role and redistribution rights
   - free storage
   - duplicates
   - whether a partial file exists to resume
   Then the person on the receiving phone approves.
4. The receiver sends a `response`, which can include a resume offset.
5. The sender sends one FILE payload. Native code cancels any file the
   receiver did not approve.
6. The receiver verifies the SHA-256 and manifest, imports, and sends a
   `receipt`.

Other transfer rules:

- Long transfers run in a `connectedDevice` foreground service with progress.
- Discovery stops once connected.
- Partial files and sessions are kept for 7 days to allow resuming.
- Cancelling deletes incomplete data.
- **Redistribution:** student-to-student sharing is refused unless the
  manifest allows it. Students never receive teacher bundles.

## Teacher web studio

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```

- **Demo mode** is used when no Supabase variables are set. Drafts live in
  IndexedDB, and nothing leaves the browser.
- **Optional sign-in.** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  in `web/.env.local`. Teachers can then sign in with email and password and
  upload exports to Supabase Storage. Uploads go to the bucket named in
  `VITE_SUPABASE_PACKAGE_BUCKET` (default `pavo-packages`).
- To enable AI drafting, set `VITE_PAVO_API_URL` to the `pavo-companion`
  function URL.
- **AI drafting** goes through `pavo-companion`. Drafts are labelled "AI
  draft", every one must be approved before publishing, and approval and
  editing are recorded in the manifest's provenance.
- **Import:** Markdown or text lessons, quiz JSON, and `.pavo-module` teacher
  bundles. A bundle opens as the next version.

## Supabase setup

See `mobile/supabase/functions/pavo-companion/README.md`. The function needs
the `OPENAI_API_KEY` secret and an optional `OPENAI_MODEL`. Clients only ever
hold the public anon key.

## AI security boundary

- The OpenAI key exists only in the edge function.
- **Input:**
  - Requests are validated and bounded: 34 KB body, at most 4 modules, 6
    conversation turns, and capped field lengths.
  - Free text is redacted for emails, phone numbers, and ID numbers.
  - Input is moderated.
- **Output:** the model must return strict JSON-schema output, which is
  validated again on the client and moderated.
- **Limits:** model and moderation calls time out after 40 s and 10 s. The rate
  limit is held per isolate and is best-effort.
- **Errors** are student-friendly and never expose infrastructure details.
- **Offline:** all learning, assessment, scanning, transfer, and QR flows work
  without AI.
- **What AI may not do:** publish without teacher approval, see answer keys
  during a student assessment, or receive names, contacts, or authentication
  data.

## External content and licensing

`mobile/src/domain/contentProvider.ts` defines a `ContentProvider` interface:

- **Mock provider:** serves original PAVO demo content under CC BY 4.0, so
  development needs no third party.
- **Khan Academy adapter:** link only. It returns outbound links to
  `khanacademy.org`, with Khan Academy attribution, from a catalog the school
  is authorized to use. It stays disabled until one is supplied. It never
  scrapes and never stores a lesson body.
- Bodies are cached only under an explicit Creative Commons or CC0 license
  (`canCache`); `forStorage` strips everything else.
- Third-party items keep their canonical URL, authors, license, and update
  date, and are never labelled as PAVO content.

**PAVO has no Khan Academy partnership.**

## Data migrations

Migrations are pure SQL in `mobile/src/data/migrations.ts`. Each runs in a
transaction and advances `PRAGMA user_version`.

- **v8:** adds these tables:
  - `pavo_packages`, `assessments`, `question_bank`
  - `student_quizzes`, `quiz_sessions`, `imported_results`
  - `device_identities`, `enrolled_device_keys`
  - `paper_scans`, `paper_corrections`
  - `lesson_progress`, `learning_recommendations`, `ai_provenance`
- **v9:** adds the transfer session and receipt columns.

Existing v7 learner data is preserved. The migration tests run under
`node:sqlite`.

## Validation

```bash
cd mobile && npm run validate          # tsc + Jest
cd mobile && npm run seed:validate
cd mobile && npx expo-doctor
cd mobile && npm run omr:fixtures      # needs a JDK
cd mobile/android && ./gradlew :app:assembleDebug
cd web && npm test && npm run build
deno check mobile/supabase/functions/pavo-companion/index.ts
```

## Physical-device test boundary

**Not yet performed.** The emulator was used only for the UI flows:

- Demo classroom
- Package install
- Adaptive lesson
- Mini-quiz resume

Before claiming either acceptance list in the implementation goal (paper
scanner §14, and the two-phone offline Nearby test), run them on real devices
and record the results here.

Emulators cannot validate:

- Bluetooth or Wi-Fi transfer
- Transfer throughput, which depends on the hardware and the transport Nearby
  selects
- Camera focus
- Real paper scanning

## Paper, print, camera, and pen limits

- Print at 100% scale on A4 or Letter. "Fit to page" moves the markers.
- **Pens and pencils:** dark pencil (2B or softer) and black or blue pen give
  the best contrast. Light pencil may read as faint, which sends the question
  to review rather than marking it wrong.
- Folded, curled, or glossy paper and strong single-source light trigger the
  framing checks.
- Bubble thresholds were tuned on synthetic fixtures only. Expect to adjust
  them after testing with real paper and cameras.

## Claims PAVO does not make

- No Khan Academy partnership.
- No measured improvement in academic outcomes; there are no field studies yet.
- SMS delivery is simulated.
- Physical-device transfer and scanning acceptance has not been performed.
- Checksum-only result QRs are not cryptographically authentic.
