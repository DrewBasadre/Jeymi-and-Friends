import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  analyzeResponses,
  averagePercent,
  masteryFor,
  nextReview,
} from '@/domain/learning';
import {
  decodeQrPayload,
  mergeQuizReportParts,
  type DecodedQrPayload,
  type LegacyQuizResult,
  type QuizReport,
  type QuizReportPart,
} from '@/domain/qr';
import type {
  DueFlashcard,
  FlashcardRating,
  CurriculumModuleManifest,
  LearningFormat,
  LearningModule,
  LearningProfile,
  MasteryLevel,
  QuestionResponse,
  QuizAttempt,
  QuizQuestion,
  Student,
  StudentDashboard,
  TeacherDashboard,
  TeacherLearnerRow,
} from '@/domain/types';
import { getDatabase } from './database';
import {
  getAdaptiveFormatProfile,
  getStrugglingThreshold,
  initializeAdaptiveFormatProfile,
  recordFormatOutcome,
  saveModuleManifest,
} from './mvpRepository';

type Db = SQLiteDatabase;

interface StudentRow {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  middle_initial: string;
  display_name: string;
  grade_level: number;
  section: string;
  birthday: string;
  pin: string;
  is_archived: number;
}

interface ModuleRow {
  id: string;
  title: string;
  subject: LearningModule['subject'];
  grade_level: number;
  quarter: number;
  competency_code: string;
  summary: string;
  content: string;
  content_style_tags_json: string;
  local_asset_uri: string | null;
  remote_asset_path: string | null;
  package_sha256: string | null;
  package_size_bytes: number | null;
  is_teacher_created: number;
  updated_at: number;
}

interface QuestionRow {
  id: string;
  module_id: string;
  type: QuizQuestion['type'];
  question_text: string;
  choices_json: string;
  correct_answer: string;
  topic_tag: string;
}

interface AttemptRow {
  id: string;
  student_id: string;
  module_id: string;
  score: number;
  total_items: number;
  weak_topic: string;
  strong_topic: string;
  mastery_level: MasteryLevel;
  duration_seconds: number;
  attempt_number: number;
  submitted_at: number;
  learning_format_used: LearningFormat;
}

interface ResponseRow {
  question_id: string;
  answer: string;
  is_correct: number;
  elapsed_ms: number;
}

interface ProfileRow {
  student_id: string;
  primary_style: LearningProfile['primaryStyle'];
  scores_json: string;
  assessment_version: number;
  completed_at: number;
  guardian_acknowledged_at: number | null;
}

export interface PrivacyConsent {
  studentId: string;
  noticeVersion: string;
  guardianName: string;
  guardianAcknowledgedAt: number;
  aiDiagnosticsAllowed: boolean;
  cloudSyncAllowed: boolean;
}

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: unknown;
  attempts: number;
}

const now = () => Date.now();
const id = (prefix: string) => `${prefix}_${Crypto.randomUUID()}`;

export async function saveStudent(
  input: Omit<Student, 'id' | 'displayName' | 'isArchived'> & { id?: string },
): Promise<Student> {
  const database = await getDatabase();
  const studentId = input.id?.trim() || id('student');
  const displayName = [input.firstName.trim(), input.lastName.trim()].filter(Boolean).join(' ');
  await database.runAsync(
    `INSERT INTO students (
      id, student_number, first_name, last_name, middle_initial, display_name,
      grade_level, section, birthday, pin, is_archived, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      student_number = excluded.student_number,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      middle_initial = excluded.middle_initial,
      display_name = excluded.display_name,
      grade_level = excluded.grade_level,
      section = excluded.section,
      birthday = excluded.birthday,
      pin = excluded.pin,
      updated_at = excluded.updated_at`,
    studentId,
    input.studentNumber.trim(),
    input.firstName.trim(),
    input.lastName.trim(),
    input.middleInitial.trim().slice(0, 1),
    displayName,
    input.gradeLevel,
    input.section.trim(),
    input.birthday.trim(),
    input.pin.trim(),
    now(),
  );
  await initializeFlashcards(database, studentId);
  return {
    id: studentId,
    studentNumber: input.studentNumber.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    middleInitial: input.middleInitial.trim().slice(0, 1),
    displayName,
    gradeLevel: input.gradeLevel,
    section: input.section.trim(),
    birthday: input.birthday.trim(),
    pin: input.pin.trim(),
    isArchived: false,
  };
}

export async function loginStudent(identifier: string, pin: string): Promise<Student | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<StudentRow>(
    `SELECT * FROM students
     WHERE is_archived = 0
       AND (lower(student_number) = lower(?) OR lower(last_name) = lower(?))
     LIMIT 1`,
    identifier.trim(),
    identifier.trim(),
  );
  if (!row || row.pin !== pin.trim()) return null;
  return mapStudent(row);
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<StudentRow>('SELECT * FROM students WHERE id = ?', studentId);
  return row ? mapStudent(row) : null;
}

export async function listStudents(): Promise<Student[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<StudentRow>(
    'SELECT * FROM students WHERE is_archived = 0 ORDER BY last_name, first_name',
  );
  return rows.map(mapStudent);
}

export async function saveLearningProfile(profile: LearningProfile): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO learning_profiles (
        student_id, primary_style, scores_json, assessment_version, completed_at,
        guardian_acknowledged_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        primary_style = excluded.primary_style,
        scores_json = excluded.scores_json,
        assessment_version = excluded.assessment_version,
        completed_at = excluded.completed_at,
        guardian_acknowledged_at = excluded.guardian_acknowledged_at`,
      profile.studentId,
      profile.primaryStyle,
      JSON.stringify(profile.scores),
      profile.assessmentVersion,
      profile.completedAt,
      profile.guardianAcknowledgedAt,
    );
    await enqueueSync(database, 'learning_profile', profile.studentId, 'upsert', profile);
  });
  await initializeAdaptiveFormatProfile(profile);
}

export async function getPrivacyConsent(studentId: string): Promise<PrivacyConsent | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    student_id: string;
    notice_version: string;
    guardian_name: string;
    guardian_acknowledged_at: number;
    ai_diagnostics_allowed: number;
    cloud_sync_allowed: number;
  }>(
    `SELECT * FROM privacy_consents
     WHERE student_id = ?
     ORDER BY guardian_acknowledged_at DESC
     LIMIT 1`,
    studentId,
  );
  if (!row) return null;
  return {
    studentId: row.student_id,
    noticeVersion: row.notice_version,
    guardianName: row.guardian_name,
    guardianAcknowledgedAt: row.guardian_acknowledged_at,
    aiDiagnosticsAllowed: row.ai_diagnostics_allowed === 1,
    cloudSyncAllowed: row.cloud_sync_allowed === 1,
  };
}

export async function savePrivacyConsent(consent: PrivacyConsent): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO privacy_consents (
      student_id, notice_version, guardian_name, guardian_acknowledged_at,
      ai_diagnostics_allowed, cloud_sync_allowed
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, notice_version) DO UPDATE SET
      guardian_name = excluded.guardian_name,
      guardian_acknowledged_at = excluded.guardian_acknowledged_at,
      ai_diagnostics_allowed = excluded.ai_diagnostics_allowed,
      cloud_sync_allowed = excluded.cloud_sync_allowed`,
    consent.studentId,
    consent.noticeVersion,
    consent.guardianName.trim(),
    consent.guardianAcknowledgedAt,
    consent.aiDiagnosticsAllowed ? 1 : 0,
    consent.cloudSyncAllowed ? 1 : 0,
  );
}

export async function listDueSyncItems(): Promise<SyncQueueItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    entity_type: string;
    entity_id: string;
    operation: string;
    payload_json: string;
    attempts: number;
  }>(
    `SELECT id, entity_type, entity_id, operation, payload_json, attempts
     FROM sync_queue
     WHERE next_attempt_at <= ?
     ORDER BY created_at
     LIMIT 50`,
    now(),
  );
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payload: JSON.parse(row.payload_json) as unknown,
    attempts: row.attempts,
  }));
}

export async function completeSyncItem(idValue: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sync_queue WHERE id = ?', idValue);
}

export async function failSyncItem(idValue: string, message: string, attempts: number): Promise<void> {
  const database = await getDatabase();
  const delay = Math.min(60 * 60_000, 15_000 * 2 ** Math.min(attempts, 8));
  await database.runAsync(
    `UPDATE sync_queue
     SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?
     WHERE id = ?`,
    now() + delay,
    message.slice(0, 500),
    idValue,
  );
}

export async function getLearningProfile(studentId: string): Promise<LearningProfile | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ProfileRow>(
    'SELECT * FROM learning_profiles WHERE student_id = ?',
    studentId,
  );
  if (!row) return null;
  return {
    studentId: row.student_id,
    primaryStyle: row.primary_style,
    scores: JSON.parse(row.scores_json) as LearningProfile['scores'],
    assessmentVersion: row.assessment_version,
    completedAt: row.completed_at,
    guardianAcknowledgedAt: row.guardian_acknowledged_at,
  };
}

export async function listModules(studentId?: string): Promise<LearningModule[]> {
  const database = await getDatabase();
  const student = studentId ? await getStudent(studentId) : null;
  const profile = studentId ? await getLearningProfile(studentId) : null;
  const rows = await database.getAllAsync<ModuleRow>(
    `SELECT * FROM modules
     WHERE grade_level = ?
     ORDER BY subject, quarter, title`,
    student?.gradeLevel ?? 5,
  );
  const modules = rows.map(mapModule);
  if (!profile || profile.primaryStyle === 'balanced') return modules;
  return modules.sort((left, right) => {
    const leftMatch = left.contentStyleTags.includes(profile.primaryStyle) ? 1 : 0;
    const rightMatch = right.contentStyleTags.includes(profile.primaryStyle) ? 1 : 0;
    return rightMatch - leftMatch;
  });
}

export async function getModule(moduleId: string): Promise<LearningModule | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ModuleRow>('SELECT * FROM modules WHERE id = ?', moduleId);
  return row ? mapModule(row) : null;
}

export async function saveReceivedModulePackage(input: {
  moduleId: string;
  displayName: string;
  fileUri: string;
  mimeType?: 'application/pdf' | 'application/vnd.wais.module+json';
  sizeBytes: number;
  sha256: string;
  manifest?: CurriculumModuleManifest;
}): Promise<void> {
  const database = await getDatabase();
  if (
    input.manifest &&
    !Object.values(input.manifest.checksums).includes(
      `sha256:${input.sha256.toLocaleLowerCase()}`,
    )
  ) {
    throw new Error('The received file does not match its module manifest.');
  }
  const moduleId = input.moduleId.trim() || `pdf_${input.sha256.slice(0, 16)}`;
  await ensureModule(database, {
    id: moduleId,
    title: input.displayName.replace(/\.pdf$/i, ''),
    subject: 'ADDED_MATERIALS',
    competencyCode: 'Teacher-provided PDF module',
    gradeLevel: 5,
  });
  await database.runAsync(
    `UPDATE modules
     SET local_asset_uri = ?,
         package_sha256 = ?,
         package_size_bytes = ?,
         updated_at = ?
     WHERE id = ?`,
    input.mimeType === 'application/vnd.wais.module+json'
      ? null
      : input.fileUri,
    input.sha256.toLocaleLowerCase(),
    input.sizeBytes,
    now(),
    moduleId,
  );
  if (input.manifest) {
    await saveModuleManifest(input.manifest, true);
  }
}

export async function upsertCloudModule(module: LearningModule): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO modules (
      id, title, subject, grade_level, quarter, competency_code, summary, content,
      content_style_tags_json, local_asset_uri, remote_asset_path, package_sha256,
      package_size_bytes, is_teacher_created, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      subject = excluded.subject,
      grade_level = excluded.grade_level,
      quarter = excluded.quarter,
      competency_code = excluded.competency_code,
      summary = excluded.summary,
      content_style_tags_json = excluded.content_style_tags_json,
      local_asset_uri = COALESCE(excluded.local_asset_uri, modules.local_asset_uri),
      remote_asset_path = excluded.remote_asset_path,
      package_sha256 = excluded.package_sha256,
      package_size_bytes = excluded.package_size_bytes,
      updated_at = excluded.updated_at`,
    module.id,
    module.title,
    module.subject,
    module.gradeLevel,
    module.quarter,
    module.competencyCode,
    module.summary,
    module.content,
    JSON.stringify(module.contentStyleTags),
    module.localAssetUri,
    module.remoteAssetPath,
    module.packageSha256,
    module.packageSizeBytes,
    module.isTeacherCreated ? 1 : 0,
    module.updatedAt,
  );
}

export async function getQuestions(moduleId: string): Promise<QuizQuestion[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<QuestionRow>(
    'SELECT * FROM quiz_questions WHERE module_id = ? ORDER BY id',
    moduleId,
  );
  return rows.map(mapQuestion);
}

export async function markLessonRead(studentId: string, moduleId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO progress (student_id, module_id, status, mastery_level, updated_at)
     VALUES (?, ?, 'IN_PROGRESS', 'BEGINNER', ?)
     ON CONFLICT(student_id, module_id) DO UPDATE SET
       status = CASE WHEN progress.status = 'COMPLETED' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
       updated_at = excluded.updated_at`,
    studentId,
    moduleId,
    now(),
  );
}

export async function submitQuiz(args: {
  studentId: string;
  moduleId: string;
  responses: Array<Pick<QuestionResponse, 'questionId' | 'answer' | 'elapsedMs'>>;
  startedAt: number;
  learningFormatUsed: LearningFormat;
}): Promise<QuizAttempt> {
  const database = await getDatabase();
  const existing = await getAttempts(args.studentId, args.moduleId);

  const questions = await getQuestions(args.moduleId);
  const responseById = new Map(args.responses.map((response) => [response.questionId, response]));
  const responses: QuestionResponse[] = questions.map((question) => {
    const response = responseById.get(question.id);
    const answer = response?.answer.trim() ?? '';
    return {
      questionId: question.id,
      answer,
      isCorrect: answer.toLocaleLowerCase() === question.correctAnswer.trim().toLocaleLowerCase(),
      elapsedMs: Math.max(0, response?.elapsedMs ?? 0),
    };
  });
  const score = responses.filter((response) => response.isCorrect).length;
  const topics = analyzeResponses(questions, responses);
  const submittedAt = now();
  const attempt: QuizAttempt = {
    id: id('attempt'),
    studentId: args.studentId,
    moduleId: args.moduleId,
    score,
    totalItems: questions.length,
    weakTopic: topics.weakTopic,
    strongTopic: topics.strongTopic,
    masteryLevel: masteryFor(score, questions.length),
    durationSeconds: Math.max(0, Math.round((submittedAt - args.startedAt) / 1000)),
    attemptNumber: existing.length + 1,
    submittedAt,
    learningFormatUsed: args.learningFormatUsed,
    responses,
  };

  await database.withTransactionAsync(async () => {
    await insertAttempt(database, attempt, 'local');
    await database.runAsync(
      `INSERT INTO progress (student_id, module_id, status, mastery_level, updated_at)
       VALUES (?, ?, 'COMPLETED', ?, ?)
       ON CONFLICT(student_id, module_id) DO UPDATE SET
         status = 'COMPLETED',
         mastery_level = excluded.mastery_level,
         updated_at = excluded.updated_at`,
      args.studentId,
      args.moduleId,
      attempt.masteryLevel,
      submittedAt,
    );
    await enqueueSync(database, 'quiz_attempt', attempt.id, 'upsert', attempt);
  });

  await recordFormatOutcome({
    studentId: args.studentId,
    format: args.learningFormatUsed,
    completed: true,
    scorePercentage:
      questions.length === 0 ? 0 : Math.round((score / questions.length) * 100),
    attemptedAt: submittedAt,
  });
  return attempt;
}

export async function getAttempts(studentId: string, moduleId?: string): Promise<QuizAttempt[]> {
  const database = await getDatabase();
  const rows = moduleId
    ? await database.getAllAsync<AttemptRow>(
        'SELECT * FROM quiz_attempts WHERE student_id = ? AND module_id = ? ORDER BY submitted_at DESC',
        studentId,
        moduleId,
      )
    : await database.getAllAsync<AttemptRow>(
        'SELECT * FROM quiz_attempts WHERE student_id = ? ORDER BY submitted_at DESC',
        studentId,
      );
  const attempts: QuizAttempt[] = [];
  for (const row of rows) {
    const responseRows = await database.getAllAsync<ResponseRow>(
      'SELECT question_id, answer, is_correct, elapsed_ms FROM question_responses WHERE attempt_id = ?',
      row.id,
    );
    attempts.push(mapAttempt(row, responseRows));
  }
  return attempts;
}

export async function getStudentDashboard(studentId: string): Promise<StudentDashboard> {
  const database = await getDatabase();
  const attempts = await getAttempts(studentId);
  const modules = await listModules(studentId);
  const progress = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM progress
     WHERE student_id = ? AND status = 'COMPLETED'`,
    studentId,
  );
  const due = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM flashcard_reviews WHERE student_id = ? AND due_at <= ?',
    studentId,
    now(),
  );
  const weakTopic =
    attempts.find((attempt) => attempt.weakTopic !== 'Ready for next challenge')?.weakTopic ??
    'No weak topic yet';
  const strongest = [...attempts].sort(
    (left, right) => right.score / Math.max(1, right.totalItems) - left.score / Math.max(1, left.totalItems),
  )[0];
  const strongModule = strongest ? modules.find((module) => module.id === strongest.moduleId) : null;
  return {
    completedModules: progress?.count ?? 0,
    totalModules: modules.length,
    averageScore: averagePercent(attempts),
    dueFlashcards: due?.count ?? 0,
    weakTopic,
    strongTopic: strongModule?.subject ?? 'Take a quiz to unlock',
    totalAttempts: attempts.length,
  };
}

export async function getDueFlashcards(studentId: string, limit = 20): Promise<DueFlashcard[]> {
  const database = await getDatabase();
  await initializeFlashcards(database, studentId);
  const rows = await database.getAllAsync<{
    id: string;
    module_id: string;
    front: string;
    back: string;
    learning_style_tag: DueFlashcard['learningStyleTag'];
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    due_at: number;
  }>(
    `SELECT f.*, r.ease_factor, r.interval_days, r.repetitions, r.due_at
     FROM flashcards f
     JOIN flashcard_reviews r ON r.flashcard_id = f.id
     WHERE r.student_id = ? AND r.due_at <= ?
     ORDER BY r.due_at ASC
     LIMIT ?`,
    studentId,
    now(),
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    moduleId: row.module_id,
    front: row.front,
    back: row.back,
    learningStyleTag: row.learning_style_tag,
    studentId,
    easeFactor: row.ease_factor,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    dueAt: row.due_at,
  }));
}

export async function reviewFlashcard(card: DueFlashcard, rating: FlashcardRating): Promise<void> {
  const database = await getDatabase();
  const reviewedAt = now();
  const next = nextReview(rating, card, reviewedAt);
  await database.runAsync(
    `UPDATE flashcard_reviews
     SET ease_factor = ?, interval_days = ?, repetitions = ?, due_at = ?,
         last_rating = ?, last_reviewed_at = ?
     WHERE student_id = ? AND flashcard_id = ?`,
    next.easeFactor,
    next.intervalDays,
    next.repetitions,
    next.dueAt,
    rating,
    reviewedAt,
    card.studentId,
    card.id,
  );
}

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  const students = await listStudents();
  const threshold = await getStrugglingThreshold();
  const learners: TeacherLearnerRow[] = [];
  const latestPercentages: number[] = [];
  for (const student of students) {
    const dashboard = await getStudentDashboard(student.id);
    const attempts = await getAttempts(student.id);
    const latestByModule = new Map<string, QuizAttempt>();
    for (const attempt of attempts) {
      if (!latestByModule.has(attempt.moduleId)) {
        latestByModule.set(attempt.moduleId, attempt);
      }
    }
    const modulePercentages = [...latestByModule.values()].map(
      (attempt) => (attempt.score / Math.max(1, attempt.totalItems)) * 100,
    );
    latestPercentages.push(...modulePercentages);
    const averageScore =
      modulePercentages.length === 0
        ? 0
        : Math.round(
            (modulePercentages.reduce((sum, value) => sum + value, 0) /
              modulePercentages.length) *
              10,
          ) / 10;
    const latestScore =
      attempts.length === 0
        ? 0
        : Math.round(
            (attempts[0]!.score / Math.max(1, attempts[0]!.totalItems)) * 100,
          );
    const lastThree = attempts.slice(0, 3).map(
      (attempt) => (attempt.score / Math.max(1, attempt.totalItems)) * 100,
    );
    const decliningTrend =
      lastThree.length === 3 &&
      lastThree[0]! < lastThree[1]! &&
      lastThree[1]! < lastThree[2]!;
    const belowThreshold = attempts.length > 0 && latestScore < threshold;
    const adaptive = await getAdaptiveFormatProfile(student.id);
    learners.push({
      studentId: student.id,
      studentNumber: student.studentNumber,
      displayName: student.displayName,
      section: student.section,
      averageScore,
      completedModules: dashboard.completedModules,
      totalAttempts: dashboard.totalAttempts,
      weakTopic: dashboard.weakTopic,
      struggling: belowThreshold || decliningTrend,
      strugglingReason: belowThreshold
        ? `Latest score is below ${threshold}%`
        : decliningTrend
          ? 'Scores declined across the last 3 attempts'
          : 'On track',
      latestScore,
      decliningTrend,
      recommendedFormat: adaptive.currentDefaultFormat,
      formatConfidence: adaptive.confidence,
    });
  }
  const leaderboard = [...learners].sort((a, b) => b.averageScore - a.averageScore);
  return {
    classAverage:
      latestPercentages.length === 0
        ? 0
        : Math.round(
            (latestPercentages.reduce((sum, value) => sum + value, 0) /
              latestPercentages.length) *
              10,
          ) / 10,
    strugglingThreshold: threshold,
    leaderboard,
    strugglingStudents: leaderboard.filter((learner) => learner.struggling),
    learners,
  };
}

export async function importQrReport(raw: string): Promise<string> {
  const database = await getDatabase();
  const decoded = decodeQrPayload(raw);
  if (decoded.kind === 'quiz_report') {
    const report = await resolveQuizReportScan(database, decoded.data);
    if (!report) {
      const part = decoded.data as QuizReportPart;
      return `Stored QR ${part.part} of ${part.totalParts}. Scan the remaining code${
        part.totalParts - part.part === 1 ? '' : 's'
      }.`;
    }
    await importMvpQuizReport(database, report);
    return `Stored the ${report.moduleId} report for ${report.studentId}.`;
  }
  if (decoded.kind === 'student_profile') {
    const profile = decoded.data;
    const student = await saveStudent({
      id: profile.studentId || studentIdFromNumber(profile.studentNumber),
      studentNumber: profile.studentNumber,
      firstName: profile.firstName,
      lastName: profile.lastName,
      middleInitial: profile.middleInitial,
      gradeLevel: profile.gradeLevel,
      section: profile.section,
      birthday: profile.birthday,
      pin: '1234',
    });
    return `Added ${student.displayName}. Default PIN: 1234.`;
  }

  if (decoded.kind === 'teacher_module') {
    await importTeacherModule(database, decoded.data);
    return `Imported module: ${decoded.data.title}.`;
  }

  if (decoded.kind === 'quiz_result') {
    const legacy =
      decoded.version === 2
        ? ({
            payloadType: 'quiz_result',
            ...decoded.data.report,
          } satisfies LegacyQuizResult)
        : decoded.data;
    const responses =
      decoded.version === 2
        ? decoded.data.report.responses.map((response) => ({
            ...response,
            answer: '',
          }))
        : [];
    await importQuizResult(database, legacy, responses, decoded.version);
    return `Stored ${legacy.displayName}'s ${legacy.moduleTitle} result.`;
  }

  await importProgressExport(database, decoded);
  return `Imported ${decoded.data.quizAttempts.length} attempt(s) for ${decoded.data.displayName}.`;
}

async function resolveQuizReportScan(
  database: Db,
  data: QuizReport | QuizReportPart,
): Promise<QuizReport | null> {
  if (!('part' in data)) return data;
  await database.runAsync(
    `INSERT OR REPLACE INTO scanned_report_parts
     (report_id, part, total_parts, payload_json, scanned_at)
     VALUES (?, ?, ?, ?, ?)`,
    data.reportId,
    data.part,
    data.totalParts,
    JSON.stringify(data),
    now(),
  );
  const rows = await database.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM scanned_report_parts
     WHERE report_id = ? ORDER BY part`,
    data.reportId,
  );
  if (rows.length < data.totalParts) return null;
  const report = mergeQuizReportParts(
    rows.map((row) => JSON.parse(row.payload_json) as QuizReportPart),
  );
  await database.runAsync(
    'DELETE FROM scanned_report_parts WHERE report_id = ?',
    data.reportId,
  );
  return report;
}

async function importMvpQuizReport(
  database: Db,
  report: QuizReport,
): Promise<void> {
  let student = await getStudent(report.studentId);
  if (!student) {
    student = await saveStudent({
      id: report.studentId,
      studentNumber: report.studentId,
      firstName: 'Student',
      lastName: report.studentId.slice(-6),
      middleInitial: '',
      gradeLevel: 5,
      section: 'Imported',
      birthday: '',
      pin: '1234',
    });
  }
  await ensureModule(database, {
    id: report.moduleId,
    title: report.moduleId,
    subject: 'ADDED_MATERIALS',
    competencyCode: '',
    gradeLevel: student.gradeLevel,
  });
  const questions = await getQuestions(report.moduleId);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const misses = new Map(
    report.missedQuestions.map((item) => [item.questionId, item]),
  );
  const responses: QuestionResponse[] = report.timing.perQuestion.map((timing) => {
    const miss = misses.get(timing.questionId);
    return {
      questionId: timing.questionId,
      answer: miss?.chosenAnswer ?? '',
      isCorrect: !miss,
      elapsedMs: timing.timeSeconds * 1_000,
    };
  });
  const topics = analyzeResponses(
    responses.map((response) => ({
      id: response.questionId,
      topicTag:
        questionById.get(response.questionId)?.topicTag ??
        (response.isCorrect ? 'Demonstrated understanding' : 'Needs review'),
    })),
    responses,
  );
  const attempt: QuizAttempt = {
    id: `attempt_${report.reportId}`,
    studentId: student.id,
    moduleId: report.moduleId,
    score: report.score.correct,
    totalItems: report.score.total,
    weakTopic: topics.weakTopic,
    strongTopic: topics.strongTopic,
    masteryLevel: masteryFor(report.score.correct, report.score.total),
    durationSeconds: report.timing.totalTimeSeconds,
    attemptNumber: report.attemptNumber,
    submittedAt: Date.parse(report.completedAt),
    learningFormatUsed: report.learningFormatUsed,
    responses,
  };
  await database.withTransactionAsync(async () => {
    await insertAttempt(database, attempt, 'qr');
    await database.runAsync(
      `INSERT INTO progress (student_id, module_id, status, mastery_level, updated_at)
       VALUES (?, ?, 'COMPLETED', ?, ?)
       ON CONFLICT(student_id, module_id) DO UPDATE SET
         status = 'COMPLETED',
         mastery_level = excluded.mastery_level,
         updated_at = excluded.updated_at`,
      student.id,
      report.moduleId,
      attempt.masteryLevel,
      attempt.submittedAt,
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO scanned_reports
       (report_id, student_id, payload_json, schema_version, scanned_at)
       VALUES (?, ?, ?, 10, ?)`,
      report.reportId,
      student.id,
      JSON.stringify(report),
      now(),
    );
  });
}

async function importQuizResult(
  database: Db,
  result: LegacyQuizResult,
  responses: QuestionResponse[],
  version: number,
): Promise<void> {
  const student = await resolveImportedStudent(result);
  await ensureModule(database, {
    id: result.moduleId,
    title: result.moduleTitle,
    subject: result.subject,
    competencyCode: result.competencyCode,
    gradeLevel: result.gradeLevel,
  });
  const attempt: QuizAttempt = {
    id: result.attemptId,
    studentId: student.id,
    moduleId: result.moduleId,
    score: result.score,
    totalItems: result.totalItems,
    weakTopic: result.weakTopic,
    strongTopic: result.strongTopic,
    masteryLevel: normalizeMastery(result.masteryLevel),
    durationSeconds: result.durationSeconds,
    attemptNumber: result.attemptNumber,
    submittedAt: result.submittedAt,
    learningFormatUsed:
      decodedLearningFormat(
        'learningStyleTag' in result
          ? (result as LegacyQuizResult & { learningStyleTag?: string })
              .learningStyleTag
          : undefined,
      ),
    responses,
  };
  await database.withTransactionAsync(async () => {
    await insertAttempt(database, attempt, 'qr');
    await database.runAsync(
      `INSERT INTO progress (student_id, module_id, status, mastery_level, updated_at)
       VALUES (?, ?, 'COMPLETED', ?, ?)
       ON CONFLICT(student_id, module_id) DO UPDATE SET
         status = 'COMPLETED',
         mastery_level = excluded.mastery_level,
         updated_at = excluded.updated_at`,
      student.id,
      result.moduleId,
      attempt.masteryLevel,
      result.submittedAt,
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO scanned_reports
       (report_id, student_id, payload_json, schema_version, scanned_at)
       VALUES (?, ?, ?, ?, ?)`,
      result.attemptId,
      student.id,
      JSON.stringify(result),
      version,
      now(),
    );
  });
}

async function importProgressExport(
  database: Db,
  decoded: Extract<DecodedQrPayload, { kind: 'progress_export' }>,
): Promise<void> {
  const exportData = decoded.data;
  const nameParts = exportData.displayName.trim().split(/\s+/);
  const student = await resolveImportedStudent({
    studentId: exportData.studentId,
    studentNumber: exportData.studentId,
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    middleInitial: '',
    displayName: exportData.displayName,
    gradeLevel: exportData.gradeLevel,
    section: exportData.section,
  });
  for (const item of exportData.quizAttempts) {
    await ensureModule(database, {
      id: item.moduleId,
      title: item.moduleId,
      subject: 'ADDED_MATERIALS',
      competencyCode: '',
      gradeLevel: exportData.gradeLevel,
    });
    await insertAttempt(
      database,
      {
        id: item.attemptId,
        studentId: student.id,
        moduleId: item.moduleId,
        score: item.score,
        totalItems: item.totalItems,
        weakTopic: item.weakTopic,
        strongTopic: item.strongTopic,
        masteryLevel: normalizeMastery(item.masteryLevel),
        durationSeconds: item.durationSeconds,
        attemptNumber: item.attemptNumber,
        submittedAt: item.submittedAt,
        learningFormatUsed: 'text',
        responses: [],
      },
      'qr',
    );
  }
  for (const moduleId of exportData.completedModules) {
    await ensureModule(database, {
      id: moduleId,
      title: moduleId,
      subject: 'ADDED_MATERIALS',
      competencyCode: '',
      gradeLevel: exportData.gradeLevel,
    });
    await database.runAsync(
      `INSERT INTO progress (student_id, module_id, status, mastery_level, updated_at)
       VALUES (?, ?, 'COMPLETED', 'PROFICIENT', ?)
       ON CONFLICT(student_id, module_id) DO UPDATE SET status = 'COMPLETED'`,
      student.id,
      moduleId,
      now(),
    );
  }
}

async function importTeacherModule(
  database: Db,
  module: Extract<DecodedQrPayload, { kind: 'teacher_module' }>['data'],
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO modules (
        id, title, subject, grade_level, quarter, competency_code, summary, content,
        content_style_tags_json, is_teacher_created, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '["balanced"]', 1, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        subject = excluded.subject,
        grade_level = excluded.grade_level,
        quarter = excluded.quarter,
        competency_code = excluded.competency_code,
        content = excluded.content,
        updated_at = excluded.updated_at`,
      module.moduleId,
      module.title,
      normalizeSubject(module.subject),
      module.gradeLevel,
      module.quarter,
      module.competencyCode,
      module.content.slice(0, 180),
      module.content,
      now(),
    );
    for (const [index, question] of module.questions.entries()) {
      await database.runAsync(
        `INSERT OR REPLACE INTO quiz_questions
         (id, module_id, type, question_text, choices_json, correct_answer, topic_tag)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        question.id || `${module.moduleId}_q${index + 1}`,
        module.moduleId,
        normalizeQuestionType(question.type),
        question.questionText,
        JSON.stringify(question.choices),
        question.correctAnswer,
        question.topicTag,
      );
    }
  });
}

async function resolveImportedStudent(input: {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  displayName: string;
  gradeLevel: number;
  section: string;
}): Promise<Student> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<StudentRow>(
    `SELECT * FROM students
     WHERE id = ? OR lower(student_number) = lower(?)
     ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    input.studentId,
    input.studentNumber,
    input.studentId,
  );
  if (row) return mapStudent(row);
  return saveStudent({
    id: input.studentId || studentIdFromNumber(input.studentNumber),
    studentNumber: input.studentNumber || input.studentId,
    firstName: input.firstName || input.displayName.split(' ')[0] || 'Student',
    lastName: input.lastName || input.displayName.split(' ').slice(1).join(' '),
    middleInitial: input.middleInitial,
    gradeLevel: input.gradeLevel,
    section: input.section,
    birthday: '',
    pin: '1234',
  });
}

async function ensureModule(
  database: Db,
  module: {
    id: string;
    title: string;
    subject: string;
    competencyCode: string;
    gradeLevel: number;
  },
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO modules (
      id, title, subject, grade_level, quarter, competency_code, summary, content,
      content_style_tags_json, is_teacher_created, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, '', '', '["balanced"]', 1, ?)`,
    module.id,
    module.title,
    normalizeSubject(module.subject),
    module.gradeLevel,
    module.competencyCode,
    now(),
  );
}

async function insertAttempt(database: Db, attempt: QuizAttempt, source: 'local' | 'qr'): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO quiz_attempts (
      id, student_id, module_id, score, total_items, weak_topic, strong_topic,
      mastery_level, duration_seconds, attempt_number, submitted_at, source,
      learning_format_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    attempt.id,
    attempt.studentId,
    attempt.moduleId,
    attempt.score,
    attempt.totalItems,
    attempt.weakTopic,
    attempt.strongTopic,
    attempt.masteryLevel,
    attempt.durationSeconds,
    attempt.attemptNumber,
    attempt.submittedAt,
    source,
    attempt.learningFormatUsed,
  );
  for (const response of attempt.responses) {
    await database.runAsync(
      `INSERT OR IGNORE INTO question_responses
       (attempt_id, question_id, answer, is_correct, elapsed_ms)
       VALUES (?, ?, ?, ?, ?)`,
      attempt.id,
      response.questionId,
      response.answer,
      response.isCorrect ? 1 : 0,
      response.elapsedMs,
    );
  }
}

async function initializeFlashcards(database: Db, studentId: string): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO flashcard_reviews
     (student_id, flashcard_id, ease_factor, interval_days, repetitions, due_at)
     SELECT ?, id, 2.5, 0, 0, ? FROM flashcards`,
    studentId,
    now(),
  );
}

async function enqueueSync(
  database: Db,
  entityType: string,
  entityId: string,
  operation: string,
  payload: unknown,
): Promise<void> {
  const createdAt = now();
  await database.runAsync(
    `INSERT INTO sync_queue (
      id, entity_type, entity_id, operation, payload_json, next_attempt_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id('sync'),
    entityType,
    entityId,
    operation,
    JSON.stringify(payload),
    createdAt,
    createdAt,
  );
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    studentNumber: row.student_number,
    firstName: row.first_name,
    lastName: row.last_name,
    middleInitial: row.middle_initial,
    displayName: row.display_name,
    gradeLevel: row.grade_level,
    section: row.section,
    birthday: row.birthday,
    pin: row.pin,
    isArchived: row.is_archived === 1,
  };
}

function mapModule(row: ModuleRow): LearningModule {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    gradeLevel: row.grade_level,
    quarter: row.quarter,
    competencyCode: row.competency_code,
    summary: row.summary,
    content: row.content,
    contentStyleTags: JSON.parse(row.content_style_tags_json) as LearningModule['contentStyleTags'],
    localAssetUri: row.local_asset_uri,
    remoteAssetPath: row.remote_asset_path,
    packageSha256: row.package_sha256,
    packageSizeBytes: row.package_size_bytes,
    isTeacherCreated: row.is_teacher_created === 1,
    updatedAt: row.updated_at,
  };
}

function mapQuestion(row: QuestionRow): QuizQuestion {
  return {
    id: row.id,
    moduleId: row.module_id,
    type: row.type,
    questionText: row.question_text,
    choices: JSON.parse(row.choices_json) as string[],
    correctAnswer: row.correct_answer,
    topicTag: row.topic_tag,
  };
}

function mapAttempt(row: AttemptRow, responses: ResponseRow[]): QuizAttempt {
  return {
    id: row.id,
    studentId: row.student_id,
    moduleId: row.module_id,
    score: row.score,
    totalItems: row.total_items,
    weakTopic: row.weak_topic,
    strongTopic: row.strong_topic,
    masteryLevel: row.mastery_level,
    durationSeconds: row.duration_seconds,
    attemptNumber: row.attempt_number,
    submittedAt: row.submitted_at,
    learningFormatUsed: row.learning_format_used ?? 'text',
    responses: responses.map((response) => ({
      questionId: response.question_id,
      answer: response.answer,
      isCorrect: response.is_correct === 1,
      elapsedMs: response.elapsed_ms,
    })),
  };
}

function decodedLearningFormat(value: string | undefined): LearningFormat {
  if (value === 'auditory') return 'audio';
  if (value === 'reading') return 'text';
  if (value === 'visual' || value === 'kinesthetic') return value;
  return 'text';
}

function bestAttempt(attempts: QuizAttempt[]): QuizAttempt {
  const sorted = [...attempts].sort((left, right) => {
    const scoreDifference =
      right.score / Math.max(1, right.totalItems) - left.score / Math.max(1, left.totalItems);
    return scoreDifference || right.submittedAt - left.submittedAt;
  });
  const best = sorted[0];
  if (!best) throw new Error('No quiz attempts are available.');
  return best;
}

function studentIdFromNumber(studentNumber: string): string {
  const slug = studentNumber.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `student_${slug || Crypto.randomUUID()}`;
}

function normalizeMastery(value: string): MasteryLevel {
  const normalized = value.toUpperCase();
  if (
    normalized === 'BEGINNER' ||
    normalized === 'DEVELOPING' ||
    normalized === 'PROFICIENT' ||
    normalized === 'ADVANCED'
  ) {
    return normalized;
  }
  return 'DEVELOPING';
}

function normalizeSubject(value: string): LearningModule['subject'] {
  const normalized = value.toUpperCase();
  if (normalized === 'SCIENCE' || normalized === 'MATH' || normalized === 'ENGLISH') {
    return normalized;
  }
  return 'ADDED_MATERIALS';
}

function normalizeQuestionType(value: string): QuizQuestion['type'] {
  const normalized = value.toUpperCase();
  if (normalized === 'TRUE_FALSE' || normalized === 'IDENTIFICATION') return normalized;
  return 'MULTIPLE_CHOICE';
}
