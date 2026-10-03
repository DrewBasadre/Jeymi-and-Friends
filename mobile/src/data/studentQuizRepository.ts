import * as Crypto from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  retakeDecision,
  scoreStudentQuiz,
  studentQuizSchema,
  type RetakeDecision,
  type ScoredAttempt,
  type StudentQuiz,
} from '@/domain/assessmentModel';
import { analyzeResponses, masteryFor } from '@/domain/learning';
import { encodeResultQr, resultPayloadFor, signerFor } from '@/domain/resultQr';
import { ensureDeviceIdentity } from '@/services/deviceIdentity';
import { getDatabase } from './database';
import { recordFormatOutcome } from './mvpRepository';

export interface QuizResponseEntry {
  answer: string;
  elapsedMs: number;
}

export interface QuizSession {
  attemptId: string;
  studentId: string;
  quizId: string;
  quizVersion: number;
  packageId: string;
  attemptNumber: number;
  status: 'in_progress' | 'submitted';
  responses: Record<string, QuizResponseEntry>;
  currentIndex: number;
  startedAt: number;
  deadlineAt: number | null;
  submittedAt: number | null;
  scored: ScoredAttempt | null;
  resultId: string | null;
}

export interface StudentQuizSummary {
  quiz: StudentQuiz;
  packageId: string;
  installedAt: number;
  attempts: QuizSession[];
  inProgress: QuizSession | null;
  retake: RetakeDecision;
}

export async function installStudentQuiz(args: { quiz: StudentQuiz; packageId: string }): Promise<void> {
  const quiz = studentQuizSchema.parse(args.quiz);
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ fingerprint: string }>(
    'SELECT fingerprint FROM student_quizzes WHERE quiz_id = ? AND quiz_version = ?',
    quiz.quizId,
    quiz.version,
  );
  if (existing && existing.fingerprint !== quiz.fingerprint) {
    throw new Error('A different copy of this quiz version is already installed.');
  }
  await database.runAsync(
    `INSERT OR IGNORE INTO student_quizzes (quiz_id, quiz_version, package_id, fingerprint, quiz_json, installed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    quiz.quizId,
    quiz.version,
    args.packageId,
    quiz.fingerprint,
    JSON.stringify(quiz),
    Date.now(),
  );
}

export async function listStudentQuizzes(studentId: string, today = localDate(new Date())): Promise<StudentQuizSummary[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ quiz_json: string; package_id: string; installed_at: number }>(
    'SELECT quiz_json, package_id, installed_at FROM student_quizzes ORDER BY installed_at DESC',
  );
  const summaries: StudentQuizSummary[] = [];
  for (const row of rows) {
    const quiz = studentQuizSchema.parse(JSON.parse(row.quiz_json));
    const attempts = await listSessions(studentId, quiz.quizId, quiz.version);
    const submitted = attempts.filter((attempt) => attempt.status === 'submitted');
    summaries.push({
      quiz,
      packageId: row.package_id,
      installedAt: row.installed_at,
      attempts,
      inProgress: attempts.find((attempt) => attempt.status === 'in_progress') ?? null,
      retake: retakeDecision(quiz.policy, submitted.map((attempt) => ({ percent: attempt.scored?.percent ?? 0 })), today),
    });
  }
  return summaries;
}

export async function getStudentQuiz(quizId: string, version: number): Promise<{ quiz: StudentQuiz; packageId: string } | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ quiz_json: string; package_id: string }>(
    'SELECT quiz_json, package_id FROM student_quizzes WHERE quiz_id = ? AND quiz_version = ?',
    quizId,
    version,
  );
  return row ? { quiz: studentQuizSchema.parse(JSON.parse(row.quiz_json)), packageId: row.package_id } : null;
}

/** Resumes an interrupted attempt, or starts a new one when the policy allows it. */
export async function startOrResumeAttempt(studentId: string, quizId: string, version: number): Promise<QuizSession> {
  const installed = await getStudentQuiz(quizId, version);
  if (!installed) throw new Error('This quiz is not installed on this device.');
  const sessions = await listSessions(studentId, quizId, version);
  const open = sessions.find((session) => session.status === 'in_progress');
  if (open) {
    if (open.deadlineAt !== null && Date.now() >= open.deadlineAt) return submitAttempt(open.attemptId);
    return open;
  }
  const submitted = sessions.filter((session) => session.status === 'submitted');
  const decision = retakeDecision(
    installed.quiz.policy,
    submitted.map((session) => ({ percent: session.scored?.percent ?? 0 })),
    localDate(new Date()),
  );
  if (!decision.allowed) throw new Error(retakeMessage(decision.reason));
  const startedAt = Date.now();
  const session: QuizSession = {
    attemptId: `mini_${Crypto.randomUUID()}`,
    studentId,
    quizId,
    quizVersion: version,
    packageId: installed.packageId,
    attemptNumber: submitted.length + 1,
    status: 'in_progress',
    responses: {},
    currentIndex: 0,
    startedAt,
    deadlineAt: installed.quiz.policy.timeLimitMinutes ? startedAt + installed.quiz.policy.timeLimitMinutes * 60_000 : null,
    submittedAt: null,
    scored: null,
    resultId: null,
  };
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO quiz_sessions (
       attempt_id, student_id, quiz_id, quiz_version, package_id, attempt_number, status,
       responses_json, current_index, started_at, deadline_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress', '{}', 0, ?, ?, ?)`,
    session.attemptId,
    studentId,
    quizId,
    version,
    installed.packageId,
    session.attemptNumber,
    startedAt,
    session.deadlineAt,
    startedAt,
  );
  return session;
}

/** Saved after every answer so a crash, call, or dead battery never loses work. */
export async function saveAttemptProgress(
  attemptId: string,
  responses: Record<string, QuizResponseEntry>,
  currentIndex: number,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE quiz_sessions SET responses_json = ?, current_index = ?, updated_at = ?
     WHERE attempt_id = ? AND status = 'in_progress'`,
    JSON.stringify(responses),
    currentIndex,
    Date.now(),
    attemptId,
  );
}

export async function submitAttempt(attemptId: string): Promise<QuizSession> {
  const session = await getSession(attemptId);
  if (!session) throw new Error('This attempt was not found.');
  if (session.status === 'submitted') return session;
  const installed = await getStudentQuiz(session.quizId, session.quizVersion);
  if (!installed) throw new Error('This quiz is no longer installed.');
  const answers = Object.fromEntries(Object.entries(session.responses).map(([id, entry]) => [id, entry.answer]));
  const scored = scoreStudentQuiz(installed.quiz, answers);
  const submittedAt = session.deadlineAt !== null ? Math.min(Date.now(), session.deadlineAt) : Date.now();
  const resultId = bytesToHex(Crypto.getRandomBytes(16));
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE quiz_sessions
       SET status = 'submitted', submitted_at = ?, updated_at = ?, score = ?, total = ?, percent = ?, items_json = ?, result_id = ?
       WHERE attempt_id = ? AND status = 'in_progress'`,
      submittedAt,
      Date.now(),
      scored.score,
      scored.total,
      scored.percent,
      JSON.stringify(scored.items),
      resultId,
      attemptId,
    );
    await mirrorAttempt(installed.quiz, session, scored, submittedAt);
  });
  await recordFormatOutcome({
    studentId: session.studentId,
    format: 'text',
    completed: true,
    scorePercentage: scored.percent,
    attemptedAt: submittedAt,
  });
  return (await getSession(attemptId))!;
}

/** The compact, signed result a teacher scans. Contains no answers or questions. */
export async function resultQrForAttempt(attemptId: string): Promise<string[]> {
  const session = await getSession(attemptId);
  if (!session?.scored || !session.resultId || !session.submittedAt) throw new Error('Submit the quiz before showing its result QR.');
  const installed = await getStudentQuiz(session.quizId, session.quizVersion);
  if (!installed) throw new Error('This quiz is no longer installed.');
  const identity = await ensureDeviceIdentity(`student:${session.studentId}`);
  return encodeResultQr(
    resultPayloadFor({
      quiz: installed.quiz,
      packageId: session.packageId,
      studentId: session.studentId,
      attemptNumber: session.attemptNumber,
      scored: session.scored,
      completedAt: session.submittedAt,
      resultId: session.resultId,
    }),
    { signer: signerFor(identity) },
  );
}

export async function getSession(attemptId: string): Promise<QuizSession | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<SessionRow>('SELECT * FROM quiz_sessions WHERE attempt_id = ?', attemptId);
  return row ? mapSession(row) : null;
}

async function listSessions(studentId: string, quizId: string, version: number): Promise<QuizSession[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<SessionRow>(
    `SELECT * FROM quiz_sessions WHERE student_id = ? AND quiz_id = ? AND quiz_version = ?
     ORDER BY attempt_number`,
    studentId,
    quizId,
    version,
  );
  return rows.map(mapSession);
}

async function mirrorAttempt(quiz: StudentQuiz, session: QuizSession, scored: ScoredAttempt, submittedAt: number): Promise<void> {
  const database = await getDatabase();
  const moduleId = `mini-quiz:${quiz.quizId}@${quiz.version}`;
  await database.runAsync(
    `INSERT OR IGNORE INTO modules (
       id, title, subject, grade_level, quarter, competency_code, summary, content,
       content_style_tags_json, is_teacher_created, updated_at
     ) VALUES (?, ?, 'ADDED_MATERIALS', 0, 0, '', 'Teacher mini-quiz', ?, '[]', 1, ?)`,
    moduleId,
    quiz.title,
    `# ${quiz.title}`,
    Date.now(),
  );
  const responses = quiz.questions.map((question) => ({
    questionId: `${moduleId}:${question.id}`,
    answer: session.responses[question.id]?.answer ?? '',
    isCorrect: scored.items.find((item) => item.questionId === question.id)?.outcome === 'correct',
    elapsedMs: session.responses[question.id]?.elapsedMs ?? 0,
  }));
  const topics = analyzeResponses(
    quiz.questions.map((question) => ({ id: `${moduleId}:${question.id}`, topicTag: question.topic })),
    responses,
  );
  const attemptRowId = `attempt_${session.attemptId}`;
  await database.runAsync(
    `INSERT OR IGNORE INTO quiz_attempts (
       id, student_id, module_id, score, total_items, weak_topic, strong_topic, mastery_level,
       duration_seconds, attempt_number, submitted_at, source, learning_format_used, quiz_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'text', ?)`,
    attemptRowId,
    session.studentId,
    moduleId,
    scored.score,
    scored.total,
    topics.weakTopic,
    topics.strongTopic,
    masteryFor(scored.score, scored.total),
    Math.round((submittedAt - session.startedAt) / 1000),
    session.attemptNumber,
    submittedAt,
    quiz.quizId,
  );
  for (const [index, question] of quiz.questions.entries()) {
    await database.runAsync(
      `INSERT OR IGNORE INTO question_responses (
         attempt_id, question_id, answer, is_correct, elapsed_ms, question_text, correct_answer
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      attemptRowId,
      responses[index]!.questionId,
      responses[index]!.answer,
      responses[index]!.isCorrect ? 1 : 0,
      responses[index]!.elapsedMs,
      question.prompt,
      question.reveal?.answer ?? '',
    );
  }
}

interface SessionRow {
  attempt_id: string;
  student_id: string;
  quiz_id: string;
  quiz_version: number;
  package_id: string;
  attempt_number: number;
  status: 'in_progress' | 'submitted';
  responses_json: string;
  current_index: number;
  started_at: number;
  deadline_at: number | null;
  submitted_at: number | null;
  score: number | null;
  total: number | null;
  percent: number | null;
  items_json: string | null;
  result_id: string | null;
}

function mapSession(row: SessionRow): QuizSession {
  const items = row.items_json ? (JSON.parse(row.items_json) as ScoredAttempt['items']) : null;
  return {
    attemptId: row.attempt_id,
    studentId: row.student_id,
    quizId: row.quiz_id,
    quizVersion: row.quiz_version,
    packageId: row.package_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    responses: JSON.parse(row.responses_json) as Record<string, QuizResponseEntry>,
    currentIndex: row.current_index,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.submitted_at,
    scored:
      items && row.score !== null && row.total !== null
        ? {
            items,
            score: row.score,
            total: row.total,
            correctCount: items.filter((item) => item.outcome === 'correct').length,
            percent: row.percent ?? 0,
            mastery: masteryFor(row.score, row.total),
          }
        : null,
    resultId: row.result_id,
  };
}

export function retakeMessage(reason: Extract<RetakeDecision, { allowed: false }>['reason']): string {
  return {
    attempt_limit: 'You have used every attempt your teacher allowed.',
    not_allowed: 'Your teacher allowed one attempt for this quiz.',
    mastered: 'You already reached mastery on this quiz.',
    past_due: 'This quiz is past its due date.',
  }[reason];
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
