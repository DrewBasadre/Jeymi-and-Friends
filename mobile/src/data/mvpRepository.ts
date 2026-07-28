import * as Crypto from 'expo-crypto';
import {
  appendFormatHistory,
  assessmentToFormatProfile,
  buildParentDigestSummary,
  buildPomodoroSession,
  createCustomReviewSet,
  effectiveFormat,
  interleaveReviewItems,
  updateSm2State,
} from '@/domain/review';
import { moduleManifestSchema } from '@/domain/manifest';
import type {
  AdaptiveFormatProfile,
  CurriculumModuleManifest,
  CustomReviewSet,
  DueReviewItem,
  FormatHistoryEntry,
  LearningFormat,
  LearningProfile,
  ParentDigest,
  PomodoroSession,
  ReviewImportance,
  ReviewItem,
  StudyTechnique,
  Subject,
} from '@/domain/types';
import { getDatabase } from './database';

interface AdaptiveRow {
  student_id: string;
  initial_assessment_json: string;
  current_default_format: LearningFormat;
  manual_override: LearningFormat | null;
  confidence: number;
  updated_at: number;
}

interface ReviewItemRow {
  item_id: string;
  module_id: string;
  module_version: number;
  concept_id: string;
  type: ReviewItem['type'];
  importance: ReviewImportance;
  prompt: string;
  answer: string;
  formats_json: string;
  authored_by: string;
  tags_json: string;
  easiness_factor?: number;
  interval_days?: number;
  repetitions?: number;
  due_date?: string;
  last_reviewed?: string | null;
}

export async function getAdaptiveFormatProfile(
  studentId: string,
): Promise<AdaptiveFormatProfile> {
  const database = await getDatabase();
  const learning = await database.getFirstAsync<{
    student_id: string;
    primary_style: LearningProfile['primaryStyle'];
    scores_json: string;
    assessment_version: number;
    completed_at: number;
    guardian_acknowledged_at: number | null;
  }>('SELECT * FROM learning_profiles WHERE student_id = ?', studentId);
  const row = await database.getFirstAsync<AdaptiveRow>(
    'SELECT * FROM adaptive_format_profiles WHERE student_id = ?',
    studentId,
  );
  const historyRows = await database.getAllAsync<{
    attempted_at: number;
    format: LearningFormat;
    completed: number;
    score_percentage: number;
  }>(
    `SELECT attempted_at, format, completed, score_percentage
     FROM format_history WHERE student_id = ? ORDER BY attempted_at`,
    studentId,
  );
  const history: FormatHistoryEntry[] = historyRows.map((item) => ({
    date: dateOnly(new Date(item.attempted_at)),
    format: item.format,
    completed: item.completed === 1,
    scorePercentage: item.score_percentage,
  }));
  if (row) {
    const storedAssessment = JSON.parse(
      row.initial_assessment_json,
    ) as Partial<AdaptiveFormatProfile['initialAssessment']>;
    return {
      studentId: row.student_id,
      initialAssessment: {
        text: storedAssessment.text ?? 0.25,
        audio: storedAssessment.audio ?? 0.25,
        visual: storedAssessment.visual ?? 0.25,
        kinesthetic: storedAssessment.kinesthetic ?? 0.25,
        completedAt:
          storedAssessment.completedAt ??
          new Date(learning?.completed_at ?? row.updated_at).toISOString(),
      },
      currentDefaultFormat: row.current_default_format,
      manualOverride: row.manual_override,
      confidence: row.confidence,
      formatHistory: history,
      updatedAt: row.updated_at,
    };
  }
  const base: LearningProfile = learning
    ? {
        studentId: learning.student_id,
        primaryStyle: learning.primary_style,
        scores: JSON.parse(learning.scores_json) as LearningProfile['scores'],
        assessmentVersion: learning.assessment_version,
        completedAt: learning.completed_at,
        guardianAcknowledgedAt: learning.guardian_acknowledged_at,
      }
    : {
        studentId,
        primaryStyle: 'balanced',
        scores: { visual: 1, auditory: 1, reading: 1, kinesthetic: 1 },
        assessmentVersion: 1,
        completedAt: Date.now(),
        guardianAcknowledgedAt: null,
      };
  const profile = assessmentToFormatProfile(base);
  await saveAdaptiveFormatProfile(profile);
  return profile;
}

export async function initializeAdaptiveFormatProfile(
  learningProfile: LearningProfile,
): Promise<void> {
  const existing = await getAdaptiveFormatProfile(learningProfile.studentId);
  await saveAdaptiveFormatProfile(
    assessmentToFormatProfile(learningProfile, existing),
  );
}

export async function setLearningFormatOverride(
  studentId: string,
  format: LearningFormat | null,
): Promise<AdaptiveFormatProfile> {
  const profile = await getAdaptiveFormatProfile(studentId);
  const next = {
    ...profile,
    manualOverride: format,
    updatedAt: Date.now(),
  };
  await saveAdaptiveFormatProfile(next);
  return next;
}

export async function getEffectiveLearningFormat(
  studentId: string,
): Promise<LearningFormat> {
  return effectiveFormat(await getAdaptiveFormatProfile(studentId));
}

export async function recordFormatOutcome(args: {
  studentId: string;
  format: LearningFormat;
  completed: boolean;
  scorePercentage: number;
  attemptedAt: number;
}): Promise<AdaptiveFormatProfile> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO format_history
     (id, student_id, attempted_at, format, completed, score_percentage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    `format_${Crypto.randomUUID()}`,
    args.studentId,
    args.attemptedAt,
    args.format,
    args.completed ? 1 : 0,
    args.scorePercentage,
  );
  const profile = await getAdaptiveFormatProfile(args.studentId);
  const next = appendFormatHistory(
    { ...profile, formatHistory: profile.formatHistory.slice(0, -1) },
    {
      date: dateOnly(new Date(args.attemptedAt)),
      format: args.format,
      completed: args.completed,
      scorePercentage: args.scorePercentage,
    },
  );
  await saveAdaptiveFormatProfile(next);
  return next;
}

export async function listDueReviewItems(
  studentId: string,
  limit = 40,
): Promise<DueReviewItem[]> {
  const database = await getDatabase();
  await initializeReviewStates(studentId);
  const rows = await database.getAllAsync<ReviewItemRow>(
    `SELECT i.*, s.easiness_factor, s.interval_days, s.repetitions,
            s.due_date, s.last_reviewed
     FROM review_items i
     JOIN review_states s ON s.item_id = i.item_id
     WHERE s.student_id = ? AND s.due_date <= ?
     ORDER BY
       CASE i.importance WHEN 'core' THEN 0 WHEN 'supplementary' THEN 1 ELSE 2 END,
       s.due_date,
       i.item_id
     LIMIT ?`,
    studentId,
    today(),
    limit,
  );
  return interleaveReviewItems(rows.map((row) => mapDueReviewItem(row, studentId)));
}

export async function reviewItem(args: {
  studentId: string;
  itemId: string;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  elapsedSeconds: number;
  technique: StudyTechnique;
}): Promise<void> {
  const database = await getDatabase();
  await initializeReviewStates(args.studentId);
  const state = await database.getFirstAsync<{
    easiness_factor: number;
    interval_days: number;
    repetitions: number;
  }>(
    `SELECT easiness_factor, interval_days, repetitions
     FROM review_states WHERE student_id = ? AND item_id = ?`,
    args.studentId,
    args.itemId,
  );
  if (!state) throw new Error('This review item is not available.');
  const reviewedAt = new Date();
  const next = updateSm2State(
    {
      easinessFactor: state.easiness_factor,
      intervalDays: state.interval_days,
      repetitions: state.repetitions,
    },
    args.quality,
    reviewedAt,
  );
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE review_states
       SET easiness_factor = ?, interval_days = ?, repetitions = ?,
           due_date = ?, last_reviewed = ?
       WHERE student_id = ? AND item_id = ?`,
      next.easinessFactor,
      next.intervalDays,
      next.repetitions,
      next.dueDate,
      next.lastReviewed,
      args.studentId,
      args.itemId,
    );
    await database.runAsync(
      `INSERT INTO review_events
       (id, student_id, item_id, quality, recalled, elapsed_seconds, reviewed_at, technique)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `review_${Crypto.randomUUID()}`,
      args.studentId,
      args.itemId,
      args.quality,
      args.quality >= 3 ? 1 : 0,
      Math.max(0, Math.round(args.elapsedSeconds)),
      reviewedAt.getTime(),
      args.technique,
    );
  });
}

export async function listReviewItems(moduleId?: string): Promise<ReviewItem[]> {
  const database = await getDatabase();
  const rows = moduleId
    ? await database.getAllAsync<ReviewItemRow>(
        'SELECT * FROM review_items WHERE module_id = ? ORDER BY item_id',
        moduleId,
      )
    : await database.getAllAsync<ReviewItemRow>(
        'SELECT * FROM review_items ORDER BY module_id, item_id',
      );
  return rows.map(mapReviewItem);
}

export async function listCustomReviewSets(
  createdBy?: string,
): Promise<CustomReviewSet[]> {
  const database = await getDatabase();
  const rows = createdBy
    ? await database.getAllAsync<{
        set_id: string;
        created_by: string;
        title: string;
        item_ids_json: string;
        created_items_json: string;
        visibility: CustomReviewSet['visibility'];
        created_at: number;
      }>(
        'SELECT * FROM custom_review_sets WHERE created_by = ? ORDER BY created_at DESC',
        createdBy,
      )
    : await database.getAllAsync<{
        set_id: string;
        created_by: string;
        title: string;
        item_ids_json: string;
        created_items_json: string;
        visibility: CustomReviewSet['visibility'];
        created_at: number;
      }>('SELECT * FROM custom_review_sets ORDER BY created_at DESC');
  return rows.map((row) => ({
    setId: row.set_id,
    createdBy: row.created_by,
    title: row.title,
    itemIds: JSON.parse(row.item_ids_json) as string[],
    createdItems: JSON.parse(row.created_items_json) as ReviewItem[],
    visibility: row.visibility,
    createdAt: row.created_at,
  }));
}

export async function saveCustomReviewSet(args: {
  createdBy: string;
  title: string;
  itemIds?: string[];
  createdItem?: {
    prompt: string;
    answer: string;
    conceptId: string;
    importance: ReviewImportance;
  };
  visibility?: CustomReviewSet['visibility'];
}): Promise<CustomReviewSet> {
  const database = await getDatabase();
  const moduleId = `custom_${Crypto.randomUUID()}`;
  const createdItems: ReviewItem[] = args.createdItem
    ? [
        {
          itemId: `item_${Crypto.randomUUID()}`,
          moduleId,
          moduleVersion: 1,
          conceptId: args.createdItem.conceptId.trim(),
          type: 'flashcard',
          importance: args.createdItem.importance,
          prompt: args.createdItem.prompt.trim(),
          answer: args.createdItem.answer.trim(),
          formats: { text: args.createdItem.answer.trim() },
          authoredBy: args.createdBy,
          tags: [args.createdItem.conceptId.trim()],
        },
      ]
    : [];
  const set = createCustomReviewSet({
    createdBy: args.createdBy,
    title: args.title,
    itemIds: args.itemIds,
    createdItems,
    visibility: args.visibility,
  });
  await database.withTransactionAsync(async () => {
    for (const item of createdItems) await upsertReviewItem(database, item);
    await database.runAsync(
      `INSERT INTO custom_review_sets
       (set_id, created_by, title, item_ids_json, created_items_json, visibility, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      set.setId,
      set.createdBy,
      set.title,
      JSON.stringify(set.itemIds),
      JSON.stringify(set.createdItems),
      set.visibility,
      set.createdAt,
    );
  });
  return set;
}

export async function createPomodoroForStudent(args: {
  studentId: string;
  workMinutes?: number;
  breakMinutes?: number;
  cyclesPlanned?: number;
}): Promise<PomodoroSession> {
  const database = await getDatabase();
  const [dueItems, timingRows, quizTimingRows] = await Promise.all([
    listDueReviewItems(args.studentId),
    database.getAllAsync<{ elapsed_seconds: number }>(
      `SELECT elapsed_seconds FROM review_events
       WHERE student_id = ? AND elapsed_seconds > 0
       ORDER BY reviewed_at DESC LIMIT 100`,
      args.studentId,
    ),
    database.getAllAsync<{ elapsed_seconds: number }>(
      `SELECT CAST(r.elapsed_ms / 1000 AS INTEGER) AS elapsed_seconds
       FROM question_responses r
       JOIN quiz_attempts a ON a.id = r.attempt_id
       WHERE a.student_id = ? AND r.elapsed_ms > 0
       ORDER BY a.submitted_at DESC LIMIT 100`,
      args.studentId,
    ),
  ]);
  const session = buildPomodoroSession({
    studentId: args.studentId,
    dueItems,
    historicalSeconds: [...timingRows, ...quizTimingRows].map(
      (item) => item.elapsed_seconds,
    ),
    workMinutes: args.workMinutes,
    breakMinutes: args.breakMinutes,
    cyclesPlanned: args.cyclesPlanned,
  });
  await savePomodoroSession(session);
  return session;
}

export async function savePomodoroSession(
  session: PomodoroSession,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO pomodoro_sessions
     (session_id, student_id, work_minutes, break_minutes, cycles_planned,
      queue_snapshot_json, started_at, completed_cycles, item_log_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       completed_cycles = excluded.completed_cycles,
       item_log_json = excluded.item_log_json`,
    session.sessionId,
    session.studentId,
    session.workMinutes,
    session.breakMinutes,
    session.cyclesPlanned,
    JSON.stringify(session.queueSnapshot),
    session.startedAt,
    session.completedCycles,
    JSON.stringify(session.itemLog),
  );
}

export async function generateParentDigest(
  studentId: string,
): Promise<ParentDigest> {
  const database = await getDatabase();
  const now = new Date();
  const weekStartDate = startOfWeek(now);
  const previousStart = new Date(weekStartDate.getTime() - 7 * 86_400_000);
  const attempts = await database.getAllAsync<{
    module_id: string;
    duration_seconds: number;
    submitted_at: number;
  }>(
    `SELECT module_id, duration_seconds, submitted_at
     FROM quiz_attempts
     WHERE student_id = ? AND submitted_at >= ?
     ORDER BY submitted_at`,
    studentId,
    previousStart.getTime(),
  );
  const moduleIds = [
    ...new Set(
      attempts
        .filter((item) => item.submitted_at >= weekStartDate.getTime())
        .map((item) => item.module_id),
    ),
  ];
  const names: string[] = [];
  for (const moduleId of moduleIds) {
    const module = await database.getFirstAsync<{ title: string; subject: Subject }>(
      'SELECT title, subject FROM modules WHERE id = ?',
      moduleId,
    );
    if (module) names.push(module.title);
  }
  const currentSeconds = attempts
    .filter((item) => item.submitted_at >= weekStartDate.getTime())
    .reduce((sum, item) => sum + item.duration_seconds, 0);
  const previousSeconds = attempts
    .filter((item) => item.submitted_at < weekStartDate.getTime())
    .reduce((sum, item) => sum + item.duration_seconds, 0);
  const timeTrend: ParentDigest['timeTrend'] =
    previousSeconds === 0
      ? 'not-enough-data'
      : currentSeconds > previousSeconds * 1.1
        ? 'up'
        : currentSeconds < previousSeconds * 0.9
          ? 'down'
          : 'steady';
  const format = await getEffectiveLearningFormat(studentId);
  const latestModule = moduleIds[0]
    ? await database.getFirstAsync<{ subject: Subject }>(
        'SELECT subject FROM modules WHERE id = ?',
        moduleIds[0],
      )
    : null;
  const homeSuggestion = suggestionFor(format, latestModule?.subject ?? 'ADDED_MATERIALS');
  const base = {
    digestId: `digest_${Crypto.randomUUID()}`,
    studentId,
    weekStart: dateOnly(weekStartDate),
    weekEnd: dateOnly(new Date(weekStartDate.getTime() + 6 * 86_400_000)),
    modulesCompleted: names,
    timeTrend,
    currentFormatPreference: format,
    homeSuggestion,
    generatedAt: Date.now(),
  };
  const digest: ParentDigest = {
    ...base,
    summary: buildParentDigestSummary(base),
  };
  await database.runAsync(
    `INSERT INTO parent_digests
     (digest_id, student_id, week_start, week_end, payload_json, generated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, week_start) DO UPDATE SET
       digest_id = excluded.digest_id,
       week_end = excluded.week_end,
       payload_json = excluded.payload_json,
       generated_at = excluded.generated_at`,
    digest.digestId,
    digest.studentId,
    digest.weekStart,
    digest.weekEnd,
    JSON.stringify(digest),
    digest.generatedAt,
  );
  return digest;
}

export async function getStrugglingThreshold(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM teacher_settings WHERE key = 'struggling_threshold'",
  );
  const value = Number(row?.value ?? 60);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 60;
}

export async function setStrugglingThreshold(value: number): Promise<number> {
  const database = await getDatabase();
  const normalized = Math.min(100, Math.max(0, Math.round(value)));
  await database.runAsync(
    `INSERT INTO teacher_settings (key, value, updated_at)
     VALUES ('struggling_threshold', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    String(normalized),
    Date.now(),
  );
  return normalized;
}

export async function saveModuleManifest(
  manifest: CurriculumModuleManifest,
  verified = false,
): Promise<void> {
  const database = await getDatabase();
  const parsed = moduleManifestSchema.parse(manifest);
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO module_manifests
       (module_id, version, source, manifest_json, verified_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(module_id) DO UPDATE SET
         version = excluded.version,
         source = excluded.source,
         manifest_json = excluded.manifest_json,
         verified_at = excluded.verified_at`,
      parsed.moduleId,
      parsed.version,
      parsed.source,
      JSON.stringify(parsed),
      verified ? Date.now() : null,
    );
    for (const item of parsed.reviewItems) await upsertReviewItem(database, item);
  });
}

export async function getModuleManifest(
  moduleId: string,
): Promise<CurriculumModuleManifest | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ manifest_json: string }>(
    'SELECT manifest_json FROM module_manifests WHERE module_id = ?',
    moduleId,
  );
  return row ? moduleManifestSchema.parse(JSON.parse(row.manifest_json)) : null;
}

async function saveAdaptiveFormatProfile(
  profile: AdaptiveFormatProfile,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO adaptive_format_profiles
     (student_id, initial_assessment_json, current_default_format,
      manual_override, confidence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       initial_assessment_json = excluded.initial_assessment_json,
       current_default_format = excluded.current_default_format,
       manual_override = excluded.manual_override,
       confidence = excluded.confidence,
       updated_at = excluded.updated_at`,
    profile.studentId,
    JSON.stringify(profile.initialAssessment),
    profile.currentDefaultFormat,
    profile.manualOverride,
    profile.confidence,
    profile.updatedAt,
  );
}

async function initializeReviewStates(studentId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR IGNORE INTO review_states
     (student_id, item_id, easiness_factor, interval_days, repetitions, due_date)
     SELECT ?, item_id, 2.5, 0, 0, ? FROM review_items`,
    studentId,
    today(),
  );
}

async function upsertReviewItem(
  database: Awaited<ReturnType<typeof getDatabase>>,
  item: ReviewItem,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO review_items
     (item_id, module_id, module_version, concept_id, type, importance,
      prompt, answer, formats_json, authored_by, tags_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       module_id = excluded.module_id,
       module_version = excluded.module_version,
       concept_id = excluded.concept_id,
       type = excluded.type,
       importance = excluded.importance,
       prompt = excluded.prompt,
       answer = excluded.answer,
       formats_json = excluded.formats_json,
       authored_by = excluded.authored_by,
       tags_json = excluded.tags_json`,
    item.itemId,
    item.moduleId,
    item.moduleVersion,
    item.conceptId,
    item.type,
    item.importance,
    item.prompt,
    item.answer,
    JSON.stringify(item.formats),
    item.authoredBy,
    JSON.stringify(item.tags),
  );
}

function mapReviewItem(row: ReviewItemRow): ReviewItem {
  return {
    itemId: row.item_id,
    moduleId: row.module_id,
    moduleVersion: row.module_version,
    conceptId: row.concept_id,
    type: row.type,
    importance: row.importance,
    prompt: row.prompt,
    answer: row.answer,
    formats: JSON.parse(row.formats_json) as ReviewItem['formats'],
    authoredBy: row.authored_by,
    tags: JSON.parse(row.tags_json) as string[],
  };
}

function mapDueReviewItem(row: ReviewItemRow, studentId: string): DueReviewItem {
  return {
    ...mapReviewItem(row),
    state: {
      itemId: row.item_id,
      studentId,
      easinessFactor: row.easiness_factor ?? 2.5,
      intervalDays: row.interval_days ?? 0,
      repetitions: row.repetitions ?? 0,
      dueDate: row.due_date ?? today(),
      lastReviewed: row.last_reviewed ?? null,
    },
  };
}

function suggestionFor(format: LearningFormat, subject: Subject): string {
  const subjectAction = {
    MATH: 'Practice three short examples using objects found at home.',
    SCIENCE: 'Observe one household object and explain which properties make it useful.',
    ENGLISH: 'Read a short paragraph together and name its main idea and two details.',
    ADDED_MATERIALS: 'Ask the learner to teach back one idea from the latest module.',
  }[subject];
  const formatAction = {
    visual: 'Use a quick sketch or color-coded model.',
    audio: 'Let the learner explain each step aloud.',
    text: 'Write a short checklist before starting.',
    kinesthetic: 'Use familiar objects and let the learner demonstrate.',
  }[format];
  return `${formatAction} ${subjectAction}`;
}

function startOfWeek(value: Date): Date {
  const result = new Date(value);
  const day = result.getDay();
  const distance = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - distance);
  result.setHours(0, 0, 0, 0);
  return result;
}

function today(): string {
  return dateOnly(new Date());
}

function dateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
