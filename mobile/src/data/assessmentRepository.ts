import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { parseAssessmentGuide, renderAssessmentGuide, type AssessmentGuide } from '@/domain/assessmentGuide';
import type { GradedResult } from '@/domain/assessmentAnalytics';
import {
  assessmentQuestionSchema,
  type AssessmentQuestion,
  type QuizDefinition,
} from '@/domain/assessmentModel';
import { analyzeResponses, masteryFor } from '@/domain/learning';
import {
  gradePaperSheet,
  pendingReview,
  type AnswerSheetTemplate,
  type CorrectionEvent,
  type FrameIssue,
  type OmrAnalysis,
  type QuestionDetection,
} from '@/domain/omr';
import type { ResultImportContext, ResultImportPreview } from '@/domain/resultQr';
import { getDatabase } from './database';
import { getActiveSection } from './repository';

export interface InstalledAssessment {
  quizId: string;
  version: number;
  mode: QuizDefinition['mode'];
  title: string;
  studentPackageId: string;
  guide: AssessmentGuide;
  guideMarkdown: string;
  definition: QuizDefinition | null;
  template: AnswerSheetTemplate | null;
  origin: 'authored' | 'installed';
  createdAt: number;
  archivedAt: number | null;
}

interface AssessmentRow {
  quiz_id: string;
  quiz_version: number;
  mode: QuizDefinition['mode'];
  title: string;
  student_package_id: string;
  guide_markdown: string;
  definition_json: string | null;
  template_json: string | null;
  origin: 'authored' | 'installed';
  created_at: number;
  archived_at: number | null;
}

/** Quiz versions are immutable: a second guide for the same version must match. */
export async function installAssessmentFromGuide(args: {
  guideMarkdown: string;
  definition: QuizDefinition | null;
  template: AnswerSheetTemplate | null;
  studentPackageId: string;
  origin: 'authored' | 'installed';
}): Promise<InstalledAssessment> {
  const guide = parseAssessmentGuide(args.guideMarkdown);
  if (args.definition && (args.definition.quizId !== guide.quizId || args.definition.version !== guide.version)) {
    throw new Error('The quiz definition and assessment guide describe different quizzes.');
  }
  const database = await getDatabase();
  const existing = await database.getFirstAsync<AssessmentRow>(
    'SELECT * FROM assessments WHERE quiz_id = ? AND quiz_version = ?',
    guide.quizId,
    guide.version,
  );
  if (existing) {
    if (existing.guide_markdown !== args.guideMarkdown) {
      throw new Error(`Version ${guide.version} of ${guide.title} already exists with different questions. Publish a new version instead.`);
    }
    return mapAssessment(existing);
  }
  await database.runAsync(
    `INSERT INTO assessments (
       quiz_id, quiz_version, mode, title, student_package_id, guide_markdown,
       definition_json, template_json, origin, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    guide.quizId,
    guide.version,
    guide.mode,
    guide.title,
    args.studentPackageId,
    args.guideMarkdown,
    args.definition ? JSON.stringify(args.definition) : null,
    args.template ? JSON.stringify(args.template) : null,
    args.origin,
    Date.now(),
  );
  await ensureRecordBookModule(database, guide);
  return (await getAssessment(guide.quizId, guide.version))!;
}

export async function saveAuthoredAssessment(
  quiz: QuizDefinition,
  template: AnswerSheetTemplate | null,
): Promise<InstalledAssessment> {
  const assessment = await installAssessmentFromGuide({
    guideMarkdown: renderAssessmentGuide(quiz),
    definition: quiz,
    template,
    studentPackageId: quiz.quizId,
    origin: 'authored',
  });
  for (const question of quiz.questions) await saveBankQuestion(question, 'published', `quiz:${quiz.quizId}@${quiz.version}`);
  return assessment;
}

export async function listAssessments(options: { includeArchived?: boolean } = {}): Promise<InstalledAssessment[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<AssessmentRow>(
    `SELECT * FROM assessments ${options.includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY created_at DESC`,
  );
  return rows.map(mapAssessment);
}

export async function getAssessment(quizId: string, version: number): Promise<InstalledAssessment | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<AssessmentRow>(
    'SELECT * FROM assessments WHERE quiz_id = ? AND quiz_version = ?',
    quizId,
    version,
  );
  return row ? mapAssessment(row) : null;
}

export async function setAssessmentArchived(quizId: string, version: number, archived: boolean): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE assessments SET archived_at = ? WHERE quiz_id = ? AND quiz_version = ?',
    archived ? Date.now() : null,
    quizId,
    version,
  );
}

/* ── Question bank ───────────────────────────────────────────────────── */

export interface BankQuestion {
  question: AssessmentQuestion;
  status: 'draft' | 'published' | 'archived';
  source: string;
  updatedAt: number;
}

export async function listQuestionBank(includeArchived = false): Promise<BankQuestion[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ question_json: string; status: BankQuestion['status']; source: string; updated_at: number }>(
    `SELECT * FROM question_bank ${includeArchived ? '' : "WHERE status != 'archived'"} ORDER BY updated_at DESC`,
  );
  return rows.map((row) => ({
    question: assessmentQuestionSchema.parse(JSON.parse(row.question_json)),
    status: row.status,
    source: row.source,
    updatedAt: row.updated_at,
  }));
}

export async function saveBankQuestion(
  question: AssessmentQuestion,
  status: BankQuestion['status'],
  source: string,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO question_bank (question_id, question_json, status, source, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(question_id) DO UPDATE SET
       question_json = excluded.question_json,
       status = CASE WHEN question_bank.status = 'archived' THEN 'archived' ELSE excluded.status END,
       updated_at = excluded.updated_at`,
    question.id,
    JSON.stringify(assessmentQuestionSchema.parse(question)),
    status,
    source,
    Date.now(),
  );
}

export async function setBankQuestionStatus(questionId: string, status: BankQuestion['status']): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE question_bank SET status = ?, updated_at = ? WHERE question_id = ?', status, Date.now(), questionId);
}

/* ── Roster helpers ──────────────────────────────────────────────────── */

export interface RosterEntry {
  studentId: string;
  name: string;
  classNumber: number;
}

/** Class numbers follow roster order (first enrolled = 1), matching printed class packs. */
export async function rosterWithClassNumbers(sectionId?: string): Promise<RosterEntry[]> {
  const section = sectionId ? { sectionId } : await getActiveSection();
  if (!section) return [];
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: string; display_name: string }>(
    `SELECT s.id, s.display_name FROM section_roster r
     JOIN students s ON s.id = r.student_id
     WHERE r.section_id = ? AND s.is_archived = 0
     ORDER BY r.added_at, s.last_name`,
    section.sectionId,
  );
  return rows.map((row, index) => ({ studentId: row.id, name: row.display_name, classNumber: index + 1 }));
}

/* ── Result QR import ────────────────────────────────────────────────── */

export async function resultImportContext(): Promise<ResultImportContext> {
  const database = await getDatabase();
  const [assessments, imported, keys, section] = await Promise.all([
    listAssessments({ includeArchived: true }),
    database.getAllAsync<{ result_id: string }>('SELECT result_id FROM imported_results'),
    database.getAllAsync<{ student_id: string; public_key: string }>('SELECT student_id, public_key FROM enrolled_device_keys'),
    getActiveSection(),
  ]);
  return {
    installed: assessments.map((assessment) => ({ packageId: assessment.studentPackageId, guide: assessment.guide })),
    roster: section ? section.roster : null,
    importedResultIds: imported.map((row) => row.result_id),
    enrolledKeys: Object.fromEntries(keys.map((row) => [row.student_id, row.public_key])),
  };
}

export async function saveImportedResult(args: {
  preview: ResultImportPreview;
  payloadText: string;
  teacherId: string;
}): Promise<void> {
  const database = await getDatabase();
  const { graded } = args.preview;
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO imported_results (
         result_id, student_id, quiz_id, quiz_version, package_id, form_code, attempt_number,
         score, total, verification, source, items_json, payload_text, completed_at, imported_at, imported_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'result_qr', ?, ?, ?, ?, ?)`,
      graded.resultId,
      graded.studentId,
      graded.quizId,
      graded.quizVersion,
      args.preview.payload.packageId,
      graded.formCode,
      graded.attemptNumber,
      graded.score,
      graded.total,
      args.preview.verification,
      JSON.stringify(graded.items),
      args.payloadText,
      graded.completedAt,
      Date.now(),
      args.teacherId,
    );
    await mirrorToRecordBook(database, args.preview.guide, graded);
  });
}

/** Stores a result graded on this device (used by the demo classroom). */
export async function saveLocalResult(guide: AssessmentGuide, packageId: string, result: GradedResult, teacherId: string): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT OR REPLACE INTO imported_results (
         result_id, student_id, quiz_id, quiz_version, package_id, form_code, attempt_number,
         score, total, verification, source, items_json, payload_text, completed_at, imported_at, imported_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      result.resultId,
      result.studentId,
      result.quizId,
      result.quizVersion,
      packageId,
      result.formCode,
      result.attemptNumber,
      result.score,
      result.total,
      result.source === 'paper_scan' ? 'teacher_scanned' : 'signed',
      result.source === 'paper_scan' ? 'paper_scan' : 'result_qr',
      JSON.stringify(result.items),
      result.completedAt,
      result.completedAt,
      teacherId,
    );
    await mirrorToRecordBook(database, guide, result);
  });
}

export async function listGradedResults(quizId: string, version: number): Promise<GradedResult[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    result_id: string;
    student_id: string;
    quiz_id: string;
    quiz_version: number;
    form_code: string;
    attempt_number: number;
    score: number;
    total: number;
    source: 'result_qr' | 'paper_scan';
    items_json: string;
    completed_at: number;
  }>('SELECT * FROM imported_results WHERE quiz_id = ? AND quiz_version = ? ORDER BY completed_at', quizId, version);
  return rows.map((row) => ({
    resultId: row.result_id,
    studentId: row.student_id,
    quizId: row.quiz_id,
    quizVersion: row.quiz_version,
    formCode: row.form_code,
    attemptNumber: row.attempt_number,
    source: row.source,
    completedAt: row.completed_at,
    score: row.score,
    total: row.total,
    items: JSON.parse(row.items_json) as GradedResult['items'],
  }));
}

/* ── Paper scans ─────────────────────────────────────────────────────── */

export interface PaperScanRecord {
  scanId: string;
  quizId: string;
  quizVersion: number;
  formCode: string;
  templateId: string;
  studentId: string | null;
  classNumber: number | null;
  sheetCode: string | null;
  status: 'review' | 'final' | 'discarded';
  detections: QuestionDetection[];
  metrics: OmrAnalysis['metrics'];
  warnings: FrameIssue[];
  score: number | null;
  total: number | null;
  imageUri: string | null;
  imageRetained: boolean;
  scannedAt: number;
}

export async function createPaperScan(args: Omit<PaperScanRecord, 'scanId' | 'status' | 'score' | 'total' | 'scannedAt'> & {
  teacherId: string;
}): Promise<PaperScanRecord> {
  const database = await getDatabase();
  const scanId = `scan_${Crypto.randomUUID()}`;
  const scannedAt = Date.now();
  await database.runAsync(
    `INSERT INTO paper_scans (
       scan_id, quiz_id, quiz_version, form_code, template_id, student_id, class_number, sheet_code,
       status, detections_json, metrics_json, warnings_json, image_uri, image_retained, teacher_id, scanned_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'review', ?, ?, ?, ?, ?, ?, ?)`,
    scanId,
    args.quizId,
    args.quizVersion,
    args.formCode,
    args.templateId,
    args.studentId,
    args.classNumber,
    args.sheetCode,
    JSON.stringify(args.detections),
    JSON.stringify(args.metrics),
    JSON.stringify(args.warnings),
    args.imageRetained ? args.imageUri : null,
    args.imageRetained ? 1 : 0,
    args.teacherId,
    scannedAt,
  );
  return { ...args, scanId, status: 'review', score: null, total: null, scannedAt };
}

export async function recordCorrection(event: CorrectionEvent, detections: QuestionDetection[]): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO paper_corrections (id, scan_id, question_number, original_json, corrected_json, corrected_at, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      `fix_${Crypto.randomUUID()}`,
      event.scanId,
      event.questionNumber,
      JSON.stringify(event.original),
      JSON.stringify(event.corrected),
      event.at,
      event.teacherId,
    );
    await database.runAsync('UPDATE paper_scans SET detections_json = ? WHERE scan_id = ?', JSON.stringify(detections), event.scanId);
  });
}

export async function listCorrections(scanId: string): Promise<CorrectionEvent[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    question_number: number;
    original_json: string;
    corrected_json: string;
    corrected_at: string;
    teacher_id: string;
  }>('SELECT * FROM paper_corrections WHERE scan_id = ? ORDER BY corrected_at', scanId);
  return rows.map((row) => ({
    scanId,
    questionNumber: row.question_number,
    original: JSON.parse(row.original_json) as CorrectionEvent['original'],
    corrected: JSON.parse(row.corrected_json) as CorrectionEvent['corrected'],
    at: row.corrected_at,
    teacherId: row.teacher_id,
  }));
}

/** An already graded paper for the same learner and quiz version, if any. */
export async function findDuplicatePaper(quizId: string, version: number, studentId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ scan_id: string }>(
    `SELECT scan_id FROM paper_scans
     WHERE quiz_id = ? AND quiz_version = ? AND student_id = ? AND status = 'final'`,
    quizId,
    version,
    studentId,
  );
  return row?.scan_id ?? null;
}

export async function finalizePaperScan(args: {
  scan: PaperScanRecord;
  assessment: InstalledAssessment;
  studentId: string;
  detections: QuestionDetection[];
  teacherId: string;
  replaceScanId?: string | null;
}): Promise<GradedResult> {
  const { scan, assessment } = args;
  const questionCount = assessment.guide.questions.length;
  if (pendingReview(args.detections, questionCount).length) throw new Error('Review every flagged mark before saving.');
  const graded = gradePaperSheet(assessment.guide, scan.formCode, args.detections);
  const result: GradedResult = {
    resultId: scan.scanId,
    studentId: args.studentId,
    quizId: assessment.quizId,
    quizVersion: assessment.version,
    formCode: scan.formCode,
    attemptNumber: 1,
    source: 'paper_scan',
    completedAt: scan.scannedAt,
    score: graded.scored.score,
    total: graded.scored.total,
    items: graded.items.map((item) => ({
      questionId: item.questionId,
      outcome: item.outcome,
      selectedChoice: item.selectedChoice,
    })),
  };
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    if (args.replaceScanId) {
      await database.runAsync("UPDATE paper_scans SET status = 'discarded' WHERE scan_id = ?", args.replaceScanId);
      await database.runAsync('DELETE FROM imported_results WHERE result_id = ?', args.replaceScanId);
      await database.runAsync('DELETE FROM quiz_attempts WHERE id = ?', `attempt_${args.replaceScanId}`);
    }
    await database.runAsync(
      `UPDATE paper_scans
       SET status = 'final', student_id = ?, detections_json = ?, score = ?, total = ?, items_json = ?, finalized_at = ?
       WHERE scan_id = ?`,
      args.studentId,
      JSON.stringify(args.detections),
      result.score,
      result.total,
      JSON.stringify(result.items),
      Date.now(),
      scan.scanId,
    );
    await database.runAsync(
      `INSERT INTO imported_results (
         result_id, student_id, quiz_id, quiz_version, package_id, form_code, attempt_number,
         score, total, verification, source, items_json, payload_text, completed_at, imported_at, imported_by
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'teacher_scanned', 'paper_scan', ?, NULL, ?, ?, ?)`,
      result.resultId,
      result.studentId,
      result.quizId,
      result.quizVersion,
      assessment.studentPackageId,
      result.formCode,
      result.score,
      result.total,
      JSON.stringify(result.items),
      result.completedAt,
      Date.now(),
      args.teacherId,
    );
    await mirrorToRecordBook(database, assessment.guide, result);
  });
  return result;
}

export async function discardPaperScan(scanId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("UPDATE paper_scans SET status = 'discarded', image_uri = NULL WHERE scan_id = ?", scanId);
}

export async function listPaperScans(quizId: string, version: number): Promise<PaperScanRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    scan_id: string;
    quiz_id: string;
    quiz_version: number;
    form_code: string;
    template_id: string;
    student_id: string | null;
    class_number: number | null;
    sheet_code: string | null;
    status: PaperScanRecord['status'];
    detections_json: string;
    metrics_json: string;
    warnings_json: string;
    score: number | null;
    total: number | null;
    image_uri: string | null;
    image_retained: number;
    scanned_at: number;
  }>(
    "SELECT * FROM paper_scans WHERE quiz_id = ? AND quiz_version = ? AND status != 'discarded' ORDER BY scanned_at DESC",
    quizId,
    version,
  );
  return rows.map((row) => ({
    scanId: row.scan_id,
    quizId: row.quiz_id,
    quizVersion: row.quiz_version,
    formCode: row.form_code,
    templateId: row.template_id,
    studentId: row.student_id,
    classNumber: row.class_number,
    sheetCode: row.sheet_code,
    status: row.status,
    detections: JSON.parse(row.detections_json) as QuestionDetection[],
    metrics: JSON.parse(row.metrics_json) as OmrAnalysis['metrics'],
    warnings: JSON.parse(row.warnings_json) as FrameIssue[],
    score: row.score,
    total: row.total,
    imageUri: row.image_uri,
    imageRetained: row.image_retained === 1,
    scannedAt: row.scanned_at,
  }));
}

/* ── Record book integration ─────────────────────────────────────────── */

function recordBookModuleId(guide: Pick<AssessmentGuide, 'quizId' | 'version'>): string {
  return `assessment:${guide.quizId}@${guide.version}`;
}

/** A hidden module (grade 0) lets dashboards and record books reuse existing attempt queries. */
async function ensureRecordBookModule(database: SQLiteDatabase, guide: AssessmentGuide): Promise<void> {
  const moduleId = recordBookModuleId(guide);
  await database.runAsync(
    `INSERT OR IGNORE INTO modules (
       id, title, subject, grade_level, quarter, competency_code, summary, content,
       content_style_tags_json, is_teacher_created, updated_at
     ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, '[]', 1, ?)`,
    moduleId,
    guide.title,
    normalizeSubject(guide.subject),
    [...new Set(guide.questions.map((question) => question.competency))].join(', ').slice(0, 200),
    `${guide.mode === 'paper_omr' ? 'Paper quiz' : 'Digital mini-quiz'} · version ${guide.version}`,
    `# ${guide.title}`,
    Date.now(),
  );
  for (const question of guide.questions) {
    await database.runAsync(
      `INSERT OR IGNORE INTO quiz_questions (id, module_id, type, question_text, choices_json, correct_answer, topic_tag, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `${moduleId}:${question.id}`,
      moduleId,
      question.kind === 'identification' ? 'IDENTIFICATION' : question.kind === 'fill_in_the_blank' ? 'FILL_IN_THE_BLANK' : 'MULTIPLE_CHOICE',
      question.prompt,
      JSON.stringify(question.choices),
      question.answer,
      question.topic,
      question.number,
    );
  }
}

async function mirrorToRecordBook(database: SQLiteDatabase, guide: AssessmentGuide, result: GradedResult): Promise<void> {
  await ensureRecordBookModule(database, guide);
  const moduleId = recordBookModuleId(guide);
  const byId = new Map(guide.questions.map((question) => [question.id, question]));
  const responses = result.items.map((item) => ({
    questionId: `${moduleId}:${item.questionId}`,
    answer: '',
    isCorrect: item.outcome === 'correct',
    elapsedMs: 0,
  }));
  const topics = analyzeResponses(
    result.items.map((item) => ({ id: `${moduleId}:${item.questionId}`, topicTag: byId.get(item.questionId)?.topic ?? 'Review' })),
    responses,
  );
  const attemptId = `attempt_${result.resultId}`;
  await database.runAsync(
    `INSERT OR REPLACE INTO quiz_attempts (
       id, student_id, module_id, score, total_items, weak_topic, strong_topic, mastery_level,
       duration_seconds, attempt_number, submitted_at, source, learning_format_used, quiz_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'text', ?)`,
    attemptId,
    result.studentId,
    moduleId,
    result.score,
    result.total,
    topics.weakTopic,
    topics.strongTopic,
    masteryFor(result.score, result.total),
    result.attemptNumber,
    result.completedAt,
    result.source === 'paper_scan' ? 'paper' : 'qr',
    result.quizId,
  );
  for (const [index, item] of result.items.entries()) {
    const question = byId.get(item.questionId);
    await database.runAsync(
      `INSERT OR REPLACE INTO question_responses (
         attempt_id, question_id, answer, is_correct, elapsed_ms, question_text, correct_answer
       ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      attemptId,
      responses[index]!.questionId,
      item.outcome === 'unanswered' ? '' : item.selectedChoice != null && question ? question.choices[item.selectedChoice] ?? '' : '',
      item.outcome === 'correct' ? 1 : 0,
      question?.prompt ?? '',
      question?.answer ?? '',
    );
  }
}

function mapAssessment(row: AssessmentRow): InstalledAssessment {
  return {
    quizId: row.quiz_id,
    version: row.quiz_version,
    mode: row.mode,
    title: row.title,
    studentPackageId: row.student_package_id,
    guide: parseAssessmentGuide(row.guide_markdown),
    guideMarkdown: row.guide_markdown,
    definition: row.definition_json ? (JSON.parse(row.definition_json) as QuizDefinition) : null,
    template: row.template_json ? (JSON.parse(row.template_json) as AnswerSheetTemplate) : null,
    origin: row.origin,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

function normalizeSubject(subject: string): string {
  const upper = subject.toUpperCase();
  if (upper.startsWith('SCI')) return 'SCIENCE';
  if (upper.startsWith('MATH')) return 'MATH';
  if (upper.startsWith('ENG')) return 'ENGLISH';
  return 'ADDED_MATERIALS';
}
