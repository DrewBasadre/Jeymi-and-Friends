import type {
  AdaptiveFormatProfile,
  CustomReviewSet,
  DueReviewItem,
  FormatHistoryEntry,
  LearningFormat,
  LearningProfile,
  PomodoroSession,
  ReviewItem,
  ReviewState,
} from './types';

const DAY_MS = 86_400_000;
const FORMATS: LearningFormat[] = ['text', 'audio', 'visual', 'kinesthetic'];

export function assessmentToFormatProfile(
  profile: LearningProfile,
  existing?: AdaptiveFormatProfile | null,
): AdaptiveFormatProfile {
  const total = Math.max(
    1,
    profile.scores.visual +
      profile.scores.auditory +
      profile.scores.reading +
      profile.scores.kinesthetic,
  );
  const initialAssessment = {
    text: profile.scores.reading / total,
    audio: profile.scores.auditory / total,
    visual: profile.scores.visual / total,
    kinesthetic: profile.scores.kinesthetic / total,
    completedAt: new Date(profile.completedAt).toISOString(),
  };
  const startingFormat = styleToFormat(profile.primaryStyle);
  return {
    studentId: profile.studentId,
    initialAssessment,
    currentDefaultFormat: existing?.currentDefaultFormat ?? startingFormat,
    manualOverride: existing?.manualOverride ?? null,
    confidence: existing?.confidence ?? 0.2,
    formatHistory: existing?.formatHistory ?? [],
    updatedAt: Date.now(),
  };
}

export function recomputeAdaptiveFormat(
  profile: AdaptiveFormatProfile,
  recomputeEvery = 5,
): AdaptiveFormatProfile {
  const history = profile.formatHistory;
  if (history.length === 0 || history.length % recomputeEvery !== 0) {
    return {
      ...profile,
      confidence: confidenceFor(history.length),
      updatedAt: Date.now(),
    };
  }

  const ageDecay = Math.max(0.15, 0.45 * Math.pow(0.9, history.length / recomputeEvery));
  const observedWeight = 1 - ageDecay;
  const ranked = FORMATS.map((format) => {
    const entries = history.filter((entry) => entry.format === format);
    const completionRate =
      entries.length === 0
        ? 0
        : entries.filter((entry) => entry.completed).length / entries.length;
    const scoreAverage =
      entries.length === 0
        ? 0
        : entries.reduce((sum, entry) => sum + entry.scorePercentage / 100, 0) /
          entries.length;
    const observed =
      entries.length === 0 ? 0 : completionRate * 0.4 + scoreAverage * 0.6;
    return {
      format,
      value: profile.initialAssessment[format] * ageDecay + observed * observedWeight,
    };
  }).sort((left, right) => right.value - left.value);

  return {
    ...profile,
    currentDefaultFormat: ranked[0]?.format ?? profile.currentDefaultFormat,
    confidence: confidenceFor(history.length),
    updatedAt: Date.now(),
  };
}

export function appendFormatHistory(
  profile: AdaptiveFormatProfile,
  entry: FormatHistoryEntry,
): AdaptiveFormatProfile {
  return recomputeAdaptiveFormat({
    ...profile,
    formatHistory: [...profile.formatHistory, entry],
    updatedAt: Date.now(),
  });
}

export function effectiveFormat(profile: AdaptiveFormatProfile): LearningFormat {
  return profile.manualOverride ?? profile.currentDefaultFormat;
}

export function styleToFormat(style: LearningProfile['primaryStyle']): LearningFormat {
  if (style === 'auditory') return 'audio';
  if (style === 'reading') return 'text';
  if (style === 'balanced') return 'text';
  return style;
}

export function updateSm2State(
  state: Pick<
    ReviewState,
    'easinessFactor' | 'intervalDays' | 'repetitions'
  >,
  quality: 0 | 1 | 2 | 3 | 4 | 5,
  reviewedAt = new Date(),
): Omit<ReviewState, 'itemId' | 'studentId'> {
  let repetitions = state.repetitions;
  let intervalDays = state.intervalDays;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(intervalDays * state.easinessFactor));
  }

  const easinessFactor = Math.max(
    1.3,
    state.easinessFactor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );
  const due = new Date(reviewedAt.getTime() + intervalDays * DAY_MS);
  return {
    easinessFactor,
    intervalDays,
    repetitions,
    dueDate: dateOnly(due),
    lastReviewed: dateOnly(reviewedAt),
  };
}

export function interleaveReviewItems<T extends Pick<ReviewItem, 'conceptId'>>(
  items: T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.conceptId) ?? [];
    group.push(item);
    groups.set(item.conceptId, group);
  }
  const result: T[] = [];
  while ([...groups.values()].some((group) => group.length > 0)) {
    for (const group of groups.values()) {
      const item = group.shift();
      if (item) result.push(item);
    }
  }
  return result;
}

export function estimatePomodoroQueueSize(
  workMinutes: number,
  historicalSeconds: number[],
  fallbackSeconds = 60,
): number {
  const valid = historicalSeconds.filter((value) => value > 0 && Number.isFinite(value));
  const average =
    valid.length > 0
      ? valid.reduce((sum, value) => sum + value, 0) / valid.length
      : fallbackSeconds;
  return Math.max(1, Math.floor((Math.max(1, workMinutes) * 60) / average));
}

export function buildPomodoroSession(args: {
  studentId: string;
  dueItems: DueReviewItem[];
  historicalSeconds: number[];
  workMinutes?: number;
  breakMinutes?: number;
  cyclesPlanned?: number;
  now?: Date;
}): PomodoroSession {
  const workMinutes = args.workMinutes ?? 25;
  const queueSize = estimatePomodoroQueueSize(workMinutes, args.historicalSeconds);
  return {
    sessionId: `pomodoro_${randomId()}`,
    studentId: args.studentId,
    workMinutes,
    breakMinutes: args.breakMinutes ?? 5,
    cyclesPlanned: args.cyclesPlanned ?? 4,
    queueSnapshot: interleaveReviewItems(args.dueItems)
      .slice(0, queueSize)
      .map((item) => item.itemId),
    startedAt: (args.now ?? new Date()).toISOString(),
    completedCycles: 0,
    itemLog: [],
  };
}

export function createCustomReviewSet(args: {
  createdBy: string;
  title: string;
  itemIds?: string[];
  createdItems?: ReviewItem[];
  visibility?: CustomReviewSet['visibility'];
}): CustomReviewSet {
  return {
    setId: `set_${randomId()}`,
    createdBy: args.createdBy,
    title: args.title.trim(),
    itemIds: args.itemIds ?? [],
    createdItems: args.createdItems ?? [],
    visibility: args.visibility ?? 'private',
    createdAt: Date.now(),
  };
}

function confidenceFor(historyCount: number): number {
  return Math.round(Math.min(0.95, 0.2 + historyCount * 0.075) * 100) / 100;
}

function dateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
