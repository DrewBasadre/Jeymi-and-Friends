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
  type QuizReport,
  type QuizReportPart,
} from '@/domain/qr';
import {
  buildClassPerformanceReport,
  performanceTrend,
} from '@/domain/reporting';
import {
  assignmentMatchesStudentSection,
  formatSectionLabel,
} from '@/domain/section';
import type {
  ClassPerformanceReport,
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
  Section,
  StrugglingConcept,
  Student,
  StudentDashboard,
  StudentPerformanceReport,
  StudentTask,
  TeacherProfile,
  TeacherDashboard,
  TeacherLearnerRow,
} from '@/domain/types';
import { installModulePackage } from '@/services/modulePackages';
import { getDatabase } from './database';
import {
  getAdaptiveFormatProfile,
  getStrugglingThreshold,
  initializeAdaptiveFormatProfile,
  recordFormatOutcome,
  saveScannedLearningFormat,
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
  });
  await initializeAdaptiveFormatProfile(profile);
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
  mimeType?:
    | 'application/vnd.wais.module+zip'
    | 'application/vnd.wais.review-set+json';
  sizeBytes: number;
  sha256: string;
  manifest?: CurriculumModuleManifest;
}): Promise<void> {
  await saveModulePackage({
    ...input,
    expectedSource: 'teacher-bluetooth',
    isTeacherCreated: true,
    competencyCode: 'Teacher-provided Markdown module',
  });
}

export async function saveSeedModulePackage(input: {
  moduleId: string;
  displayName: string;
  fileUri: string;
  sizeBytes: number;
}): Promise<void> {
  await saveModulePackage({
    ...input,
    expectedSource: 'seed-bundle',
    isTeacherCreated: false,
    competencyCode: 'MATATAG-aligned Q1 demo content',
  });
}

async function saveModulePackage(input: {
  moduleId: string;
  displayName: string;
  fileUri: string;
  sizeBytes: number;
  sha256?: string;
  manifest?: CurriculumModuleManifest;
  expectedSource: 'teacher-bluetooth' | 'seed-bundle';
  isTeacherCreated: boolean;
  competencyCode: string;
}): Promise<void> {
  const database = await getDatabase();
  const installed = await installModulePackage({
    fileUri: input.fileUri,
    expectedArchiveSha256: input.sha256,
    expectedManifest: input.manifest,
    expectedSource: input.expectedSource,
  });
  const manifest = installed.manifest;
  const moduleId =
    manifest.moduleId ||
    input.moduleId.trim() ||
    `module_${installed.archiveSha256.slice(0, 16)}`;
  await ensureModule(database, {
    id: moduleId,
    title: input.displayName.replace(/\.wais-module$/i, ''),
    subject: manifest.subject,
    competencyCode: input.competencyCode,
    gradeLevel: manifest.gradeLevel,
    isTeacherCreated: input.isTeacherCreated,
  });
  await database.runAsync(
    `UPDATE modules
     SET title = ?,
         subject = ?,
         grade_level = ?,
         summary = ?,
         content = ?,
         local_asset_uri = ?,
         package_sha256 = ?,
         package_size_bytes = ?,
         is_teacher_created = ?,
         updated_at = ?
     WHERE id = ?`,
    input.displayName.replace(/\.wais-module$/i, ''),
    normalizeSubject(manifest.subject),
    manifest.gradeLevel,
    markdownSummary(installed.markdown),
    installed.markdown,
    installed.directoryUri,
    installed.archiveSha256,
    input.sizeBytes,
    input.isTeacherCreated ? 1 : 0,
    now(),
    moduleId,
  );
  await saveModuleManifest(manifest, true);
  if (installed.quizQuestions.length > 0) {
    for (const question of installed.quizQuestions) {
      const type: QuizQuestion['type'] = {
        'multiple-choice': 'MULTIPLE_CHOICE',
        'fill-in-the-blank': 'FILL_IN_THE_BLANK',
        identification: 'IDENTIFICATION',
      }[question.type] as QuizQuestion['type'];
      await database.runAsync(
        `INSERT OR REPLACE INTO quiz_questions (
          id, module_id, type, question_text, choices_json, correct_answer, topic_tag
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        question.questionId,
        moduleId,
        type,
        question.prompt,
        JSON.stringify(question.options ?? []),
        question.correctAnswer,
        question.conceptId,
      );
    }
  } else {
    for (const item of manifest.reviewItems ?? []) {
      if (item.type !== 'quiz-question') continue;
      await database.runAsync(
        `INSERT OR REPLACE INTO quiz_questions (
          id, module_id, type, question_text, choices_json, correct_answer, topic_tag
        ) VALUES (?, ?, 'IDENTIFICATION', ?, '[]', ?, ?)`,
        item.itemId,
        moduleId,
        item.prompt,
        item.answer,
        item.conceptId,
      );
    }
  }
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
  const dueReviewItems = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM review_states
     WHERE student_id = ? AND due_date <= ?`,
    studentId,
    localDate(new Date()),
  );
  const weakTopic =
    attempts.find((attempt) => attempt.weakTopic !== 'Ready for next challenge')?.weakTopic ??
    'No weak topic yet';
  const strongest = [...attempts].sort(
    (left, right) => right.score / Math.max(1, right.totalItems) - left.score / Math.max(1, left.totalItems),
  )[0];
  const strongModule = strongest ? modules.find((module) => module.id === strongest.moduleId) : null;
  const completedModules = progress?.count ?? 0;
  const today = localDate(new Date());
  const chartDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return localDate(date);
  });
  const quizAttemptsByDay = chartDates.map((date) => ({
    date,
    count: attempts.filter(
      (attempt) => localDate(new Date(attempt.submittedAt)) === date,
    ).length,
  }));
  const averageScoreTrend = chartDates.map((date) => {
    const dailyAttempts = attempts.filter(
      (attempt) => localDate(new Date(attempt.submittedAt)) === date,
    );
    return {
      date,
      averageScorePercentage: averagePercent(dailyAttempts),
    };
  });
  return {
    completedModules,
    totalModules: modules.length,
    moduleCompletionPercentage:
      modules.length === 0
        ? 0
        : Math.round((completedModules / modules.length) * 100),
    averageScore: averagePercent(attempts),
    dueFlashcards: due?.count ?? 0,
    dueReviews: (due?.count ?? 0) + (dueReviewItems?.count ?? 0),
    weakTopic,
    strongTopic: strongModule?.subject ?? 'Take a quiz to unlock',
    totalAttempts: attempts.length,
    quizAttemptsToday:
      quizAttemptsByDay.find((point) => point.date === today)?.count ?? 0,
    quizAttemptsByDay,
    averageScoreTrend,
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

export async function getStudentPerformanceReport(
  studentId: string,
): Promise<StudentPerformanceReport | null> {
  const student = await getStudent(studentId);
  if (!student) return null;

  const database = await getDatabase();
  const [quizHistory, adaptive, strugglingConcepts] = await Promise.all([
    getAttempts(studentId),
    getAdaptiveFormatProfile(studentId),
    database.getAllAsync<{
      concept_id: string;
      miss_count: number;
      attempts: number;
    }>(
      `SELECT
         COALESCE(ri.concept_id, qq.topic_tag, qa.weak_topic, 'Needs review')
           AS concept_id,
         COUNT(*) AS miss_count,
         COUNT(DISTINCT qr.attempt_id) AS attempts
       FROM question_responses qr
       JOIN quiz_attempts qa ON qa.id = qr.attempt_id
       LEFT JOIN review_items ri ON ri.item_id = qr.question_id
       LEFT JOIN quiz_questions qq ON qq.id = qr.question_id
       WHERE qa.student_id = ? AND qr.is_correct = 0
       GROUP BY concept_id
       ORDER BY miss_count DESC, concept_id`,
      studentId,
    ),
  ]);

  return {
    studentId,
    profile: {
      name: student.displayName,
      studentNumber: student.studentNumber,
      section: student.section,
      currentLearningFormat:
        adaptive.manualOverride ?? adaptive.currentDefaultFormat,
    },
    quizHistory,
    averageScorePercentage: averagePercent(quizHistory),
    strugglingConcepts: strugglingConcepts.map(
      (row): StrugglingConcept => ({
        conceptId: row.concept_id,
        missCount: row.miss_count,
        attempts: row.attempts,
      }),
    ),
    trend: performanceTrend(quizHistory),
  };
}

export async function getClassPerformanceReport(
  sectionId: string,
): Promise<ClassPerformanceReport> {
  const section = (await listSections()).find(
    (candidate) => candidate.sectionId === sectionId,
  );
  if (!section) throw new Error('Section was not found.');

  const threshold = await getStrugglingThreshold();
  const reports = (
    await Promise.all(
      section.roster.map((studentId) => getStudentPerformanceReport(studentId)),
    )
  ).filter((report): report is StudentPerformanceReport => report !== null);
  return buildClassPerformanceReport(sectionId, reports, threshold);
}

export async function getTeacherDashboard(
  sectionId?: string,
): Promise<TeacherDashboard> {
  const database = await getDatabase();
  const students = (
    sectionId
      ? await database.getAllAsync<StudentRow>(
          `SELECT s.* FROM students s
           JOIN section_roster sr ON sr.student_id = s.id
           WHERE sr.section_id = ? AND s.is_archived = 0
           ORDER BY s.last_name, s.first_name`,
          sectionId,
        )
      : await database.getAllAsync<StudentRow>(
          `SELECT DISTINCT s.* FROM students s
           JOIN section_roster sr ON sr.student_id = s.id
           WHERE s.is_archived = 0
           ORDER BY s.last_name, s.first_name`,
        )
  ).map(mapStudent);
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
    const decliningTrend = performanceTrend(attempts) === 'declining';
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
  if (decoded.kind === 'quizReport') {
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
  if (decoded.kind === 'profile') {
    const profile = decoded.data;
    const activeSection = await getActiveSection();
    if (!activeSection) {
      throw new Error('Choose an active section before scanning a student profile.');
    }
    const name = splitDisplayName(profile.name);
    const student = await saveStudent({
      id: profile.studentId,
      studentNumber: profile.studentNumber,
      firstName: name.firstName,
      lastName: name.lastName,
      middleInitial: '',
      gradeLevel: activeSection.gradeLevel,
      section: activeSection.name,
      birthday: '',
      pin: '1234',
    });
    await database.runAsync(
      `INSERT INTO section_roster (section_id, student_id, added_at)
       VALUES (?, ?, ?)
       ON CONFLICT(section_id, student_id) DO UPDATE SET added_at = excluded.added_at`,
      activeSection.sectionId,
      student.id,
      now(),
    );
    await saveScannedLearningFormat(
      student.id,
      profile.currentLearningFormat,
    );
    return `Placed ${student.displayName} in ${activeSection.name}.`;
  }

  throw new Error('Students scan assignment QR codes from the Scan tab.');
}

export async function importAssignmentQr(
  raw: string,
  studentId: string,
): Promise<{ added: number; total: number }> {
  const decoded = decodeQrPayload(raw);
  if (decoded.kind !== 'assignment') {
    throw new Error('The student Scan tab only accepts assignment QR codes.');
  }
  const student = await getStudent(studentId);
  if (!student) throw new Error('Student profile was not found on this device.');
  if (
    !assignmentMatchesStudentSection({
      classSection: decoded.data.classSection,
      studentGradeLevel: student.gradeLevel,
      studentSection: student.section,
    })
  ) {
    throw new Error(
      `This assignment is for ${decoded.data.classSection}, not ${formatSectionLabel(
        student.gradeLevel,
        student.section,
      )}.`,
    );
  }
  const database = await getDatabase();
  let added = 0;
  await database.withTransactionAsync(async () => {
    for (const task of decoded.data.tasks) {
      const targetId =
        task.type === 'module' ? task.moduleId : task.quizId;
      const existing = await database.getFirstAsync<{ task_id: string }>(
        `SELECT task_id FROM student_tasks
         WHERE student_id = ? AND task_type = ? AND target_id = ? AND due_date = ?`,
        studentId,
        task.type,
        targetId,
        task.dueDate,
      );
      await database.runAsync(
        `INSERT INTO student_tasks (
          task_id, student_id, task_type, target_id, due_date, issued_by,
          issued_at, class_section, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(student_id, task_type, target_id, due_date) DO UPDATE SET
          issued_by = excluded.issued_by,
          issued_at = excluded.issued_at,
          class_section = excluded.class_section`,
        existing?.task_id ?? id('task'),
        studentId,
        task.type,
        targetId,
        task.dueDate,
        decoded.data.issuedBy,
        decoded.data.issuedAt,
        decoded.data.classSection,
      );
      if (!existing) added += 1;
    }
  });
  return { added, total: decoded.data.tasks.length };
}

export async function listStudentTasks(studentId: string): Promise<StudentTask[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    task_id: string;
    student_id: string;
    task_type: StudentTask['type'];
    target_id: string;
    due_date: string;
    issued_by: string;
    issued_at: string;
    class_section: string;
    completed_at: string | null;
  }>(
    `SELECT * FROM student_tasks
     WHERE student_id = ?
     ORDER BY completed_at IS NOT NULL, due_date, issued_at`,
    studentId,
  );
  return rows.map((row) => ({
    taskId: row.task_id,
    studentId: row.student_id,
    type: row.task_type,
    targetId: row.target_id,
    dueDate: row.due_date,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    classSection: row.class_section,
    completedAt: row.completed_at,
  }));
}

export async function saveTeacherProfile(
  input: Omit<TeacherProfile, 'teacherId' | 'createdAt'> & {
    teacherId?: string;
  },
): Promise<TeacherProfile> {
  const database = await getDatabase();
  const teacherId = input.teacherId?.trim() || id('teacher');
  const createdAt = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO teachers (teacher_id, name, age, faculty_id, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(teacher_id) DO UPDATE SET
       name = excluded.name,
       age = excluded.age,
       faculty_id = excluded.faculty_id`,
    teacherId,
    input.name.trim(),
    input.age,
    input.facultyId.trim(),
    Date.parse(createdAt),
  );
  return { ...input, teacherId, createdAt };
}

export async function getTeacherProfile(): Promise<TeacherProfile | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    teacher_id: string;
    name: string;
    age: number;
    faculty_id: string;
    created_at: number;
  }>('SELECT * FROM teachers ORDER BY created_at LIMIT 1');
  return row
    ? {
        teacherId: row.teacher_id,
        name: row.name,
        age: row.age,
        facultyId: row.faculty_id,
        createdAt: new Date(row.created_at).toISOString(),
      }
    : null;
}

export async function createSection(args: {
  teacherId: string;
  name: string;
  gradeLevel: number;
}): Promise<Section> {
  const database = await getDatabase();
  const sectionId = id('section');
  const count = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sections WHERE teacher_id = ?',
    args.teacherId,
  );
  const isActive = (count?.count ?? 0) === 0;
  await database.runAsync(
    `INSERT INTO sections (
      section_id, teacher_id, name, grade_level, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    sectionId,
    args.teacherId,
    args.name.trim(),
    args.gradeLevel,
    isActive ? 1 : 0,
    now(),
  );
  return {
    sectionId,
    teacherId: args.teacherId,
    name: args.name.trim(),
    gradeLevel: args.gradeLevel,
    isActive,
    roster: [],
  };
}

export async function setActiveSection(sectionId: string): Promise<void> {
  const database = await getDatabase();
  const section = await database.getFirstAsync<{ teacher_id: string }>(
    'SELECT teacher_id FROM sections WHERE section_id = ?',
    sectionId,
  );
  if (!section) throw new Error('Section was not found.');
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE sections SET is_active = 0 WHERE teacher_id = ?',
      section.teacher_id,
    );
    await database.runAsync(
      'UPDATE sections SET is_active = 1 WHERE section_id = ?',
      sectionId,
    );
  });
}

export async function listSections(): Promise<Section[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    section_id: string;
    teacher_id: string;
    name: string;
    grade_level: number;
    is_active: number;
  }>('SELECT * FROM sections ORDER BY is_active DESC, name');
  return Promise.all(
    rows.map(async (row) => {
      const roster = await database.getAllAsync<{ student_id: string }>(
        'SELECT student_id FROM section_roster WHERE section_id = ? ORDER BY added_at',
        row.section_id,
      );
      return {
        sectionId: row.section_id,
        teacherId: row.teacher_id,
        name: row.name,
        gradeLevel: row.grade_level,
        isActive: row.is_active === 1,
        roster: roster.map((item) => item.student_id),
      };
    }),
  );
}

export async function getActiveSection(): Promise<Section | null> {
  return (await listSections()).find((section) => section.isActive) ?? null;
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

async function ensureModule(
  database: Db,
  module: {
    id: string;
    title: string;
    subject: string;
    competencyCode: string;
    gradeLevel: number;
    isTeacherCreated?: boolean;
  },
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO modules (
      id, title, subject, grade_level, quarter, competency_code, summary, content,
      content_style_tags_json, is_teacher_created, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, '', '', '["balanced"]', ?, ?)`,
    module.id,
    module.title,
    normalizeSubject(module.subject),
    module.gradeLevel,
    module.competencyCode,
    module.isTeacherCreated === false ? 0 : 1,
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

function markdownSummary(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function normalizeSubject(value: string): LearningModule['subject'] {
  const normalized = value.toUpperCase();
  if (normalized === 'SCIENCE' || normalized === 'MATH' || normalized === 'ENGLISH') {
    return normalized;
  }
  return 'ADDED_MATERIALS';
}

function splitDisplayName(value: string): {
  firstName: string;
  lastName: string;
} {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? 'Student',
    lastName: parts.slice(1).join(' ') || 'Learner',
  };
}

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
