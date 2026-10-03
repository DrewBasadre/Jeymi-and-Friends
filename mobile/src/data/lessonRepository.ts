import * as Crypto from 'expo-crypto';
import type { PresentationPlan } from '@/domain/lessonAdaptation';
import type { LearningFormat } from '@/domain/types';
import { getDatabase } from './database';

export interface LessonProgress {
  completedBlocks: string[];
  checkResults: Record<string, boolean>;
  hintsUsed: number;
  completedAt: number | null;
}

export async function getLessonProgress(studentId: string, lessonId: string): Promise<LessonProgress> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    completed_blocks_json: string;
    check_results_json: string;
    hints_used: number;
    completed_at: number | null;
  }>('SELECT * FROM lesson_progress WHERE student_id = ? AND lesson_id = ?', studentId, lessonId);
  return row
    ? {
        completedBlocks: JSON.parse(row.completed_blocks_json) as string[],
        checkResults: JSON.parse(row.check_results_json) as Record<string, boolean>,
        hintsUsed: row.hints_used,
        completedAt: row.completed_at,
      }
    : { completedBlocks: [], checkResults: {}, hintsUsed: 0, completedAt: null };
}

export async function saveLessonProgress(
  studentId: string,
  lesson: { lessonId: string; version: number },
  progress: LessonProgress,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO lesson_progress (
       student_id, lesson_id, lesson_version, completed_blocks_json, check_results_json,
       hints_used, completed_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, lesson_id) DO UPDATE SET
       lesson_version = excluded.lesson_version,
       completed_blocks_json = excluded.completed_blocks_json,
       check_results_json = excluded.check_results_json,
       hints_used = excluded.hints_used,
       completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at),
       updated_at = excluded.updated_at`,
    studentId,
    lesson.lessonId,
    lesson.version,
    JSON.stringify(progress.completedBlocks),
    JSON.stringify(progress.checkResults),
    progress.hintsUsed,
    progress.completedAt,
    Date.now(),
  );
}

/** Stores why a format was recommended, and who picked a different one. */
export async function recordRecommendation(args: {
  studentId: string;
  lessonId: string;
  plan: PresentationPlan;
  chosenFormat?: LearningFormat | null;
  chosenBy?: 'student' | 'parent' | null;
}): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO learning_recommendations (
       id, student_id, lesson_id, recommended_format, signals_json, chosen_format, chosen_by, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    `rec_${Crypto.randomUUID()}`,
    args.studentId,
    args.lessonId,
    args.plan.format,
    JSON.stringify(args.plan.reasons),
    args.chosenFormat ?? null,
    args.chosenBy ?? null,
    Date.now(),
  );
}

/** Recently missed concepts and the average score, for explainable adaptation. */
export async function recentLearnerEvidence(studentId: string): Promise<{
  recentPercent: number | null;
  missedConcepts: string[];
  timingPattern: 'fast-and-wrong' | 'slow-and-wrong' | 'mixed' | 'no-misses' | null;
}> {
  const database = await getDatabase();
  const attempts = await database.getAllAsync<{ id: string; score: number; total_items: number }>(
    'SELECT id, score, total_items FROM quiz_attempts WHERE student_id = ? ORDER BY submitted_at DESC LIMIT 5',
    studentId,
  );
  if (!attempts.length) return { recentPercent: null, missedConcepts: [], timingPattern: null };
  const recentPercent = Math.round(
    (attempts.reduce((sum, attempt) => sum + attempt.score / Math.max(1, attempt.total_items), 0) / attempts.length) * 100,
  );
  const misses = await database.getAllAsync<{ topic: string | null; elapsed_ms: number }>(
    `SELECT COALESCE(qq.topic_tag, ri.concept_id) AS topic, qr.elapsed_ms
     FROM question_responses qr
     LEFT JOIN quiz_questions qq ON qq.id = qr.question_id
     LEFT JOIN review_items ri ON ri.item_id = qr.question_id
     WHERE qr.is_correct = 0 AND qr.attempt_id IN (${attempts.map(() => '?').join(',')})`,
    ...attempts.map((attempt) => attempt.id),
  );
  const missedConcepts = [...new Set(misses.map((miss) => miss.topic).filter((topic): topic is string => Boolean(topic)))];
  const timed = misses.filter((miss) => miss.elapsed_ms > 0);
  const fast = timed.filter((miss) => miss.elapsed_ms < 8_000).length;
  const timingPattern = !misses.length
    ? 'no-misses'
    : !timed.length
      ? null
      : fast / timed.length >= 0.6
        ? 'fast-and-wrong'
        : fast / timed.length <= 0.25
          ? 'slow-and-wrong'
          : 'mixed';
  return { recentPercent, missedConcepts, timingPattern };
}
