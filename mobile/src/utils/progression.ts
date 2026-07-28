/**
 * Client-derived progression — study points, levels and milestones.
 *
 * Everything here is computed from data the app already has (completed
 * modules, quiz attempts, average score, cards due). Nothing is invented and
 * nothing is persisted: this is a *presentation* of real progress, exactly
 * like `peacockPhase`. If the backend later ships authoritative progression
 * fields, replace these functions — callers keep working.
 *
 * Design intent: the gamification is academic, not arcade. Points come from
 * finishing lessons and practising; ranks are scholarly titles; milestones
 * describe genuine learning behaviour.
 */

export interface ProgressionInput {
  completedModules?: number;
  totalModules?: number;
  averageScore?: number;
  totalAttempts?: number;
  dueFlashcards?: number;
}

// Points are transparent on purpose — a learner can explain their own total.
const POINTS_PER_MODULE = 100;
const POINTS_PER_ATTEMPT = 20;

/** Study points earned so far. Deterministic, explainable, no hidden state. */
export function studyPoints(input: ProgressionInput): number {
  const modules = Math.max(0, Math.floor(input.completedModules ?? 0));
  const attempts = Math.max(0, Math.floor(input.totalAttempts ?? 0));
  const mastery = Math.max(0, Math.min(100, Math.round(input.averageScore ?? 0)));
  return modules * POINTS_PER_MODULE + attempts * POINTS_PER_ATTEMPT + mastery;
}

/** Points needed to clear a given level. Gently rising, never punishing. */
function costOfLevel(level: number): number {
  return 300 + (level - 1) * 150;
}

const RANKS = [
  { from: 1, title: 'Novice' },
  { from: 3, title: 'Apprentice' },
  { from: 5, title: 'Scholar' },
  { from: 7, title: 'Adept' },
  { from: 10, title: 'Luminary' },
] as const;

export function rankTitle(level: number): string {
  let title = RANKS[0].title as string;
  for (const rank of RANKS) if (level >= rank.from) title = rank.title;
  return title;
}

export interface LearnerLevel {
  /** 1-based level number. */
  level: number;
  /** Scholarly rank name for this level band. */
  title: string;
  /** Total study points earned. */
  points: number;
  /** Points earned inside the current level. */
  pointsIntoLevel: number;
  /** Points the current level costs in total. */
  pointsForLevel: number;
  /** 0–1 progress through the current level. */
  progress: number;
  /** Points still needed to reach the next level. */
  pointsToNext: number;
}

/** Level, rank and in-level progress derived from real study activity. */
export function learnerLevel(input: ProgressionInput): LearnerLevel {
  const points = studyPoints(input);
  let level = 1;
  let remaining = points;
  while (remaining >= costOfLevel(level) && level < 99) {
    remaining -= costOfLevel(level);
    level += 1;
  }
  const pointsForLevel = costOfLevel(level);
  return {
    level,
    title: rankTitle(level),
    points,
    pointsIntoLevel: remaining,
    pointsForLevel,
    progress: pointsForLevel > 0 ? remaining / pointsForLevel : 0,
    pointsToNext: Math.max(0, pointsForLevel - remaining),
  };
}

export type MilestoneIcon =
  | 'first-steps'
  | 'streak'
  | 'halfway'
  | 'complete'
  | 'sharp'
  | 'mastery'
  | 'practice'
  | 'clear';

export interface Milestone {
  id: string;
  label: string;
  /** What the learner did — or what unlocks it, when still locked. */
  hint: string;
  icon: MilestoneIcon;
  earned: boolean;
}

/**
 * Milestones for the achievements strip. Every condition is checkable against
 * real progress, so a badge can never light up for something a learner has
 * not actually done.
 */
export function milestones(input: ProgressionInput): Milestone[] {
  const completed = Math.max(0, input.completedModules ?? 0);
  const total = Math.max(0, input.totalModules ?? 0);
  const score = Math.max(0, Math.min(100, input.averageScore ?? 0));
  const attempts = Math.max(0, input.totalAttempts ?? 0);
  const due = Math.max(0, input.dueFlashcards ?? 0);
  const ratio = total > 0 ? completed / total : 0;

  return [
    {
      id: 'first-lesson',
      label: 'First lesson',
      hint: completed >= 1 ? 'You finished your first module.' : 'Finish one module to earn this.',
      icon: 'first-steps',
      earned: completed >= 1,
    },
    {
      id: 'five-lessons',
      label: 'Five deep',
      hint: completed >= 5 ? 'Five modules completed.' : 'Complete five modules to earn this.',
      icon: 'streak',
      earned: completed >= 5,
    },
    {
      id: 'halfway',
      label: 'Halfway',
      hint: ratio >= 0.5 ? 'Half of your modules are done.' : 'Reach half of your modules.',
      icon: 'halfway',
      earned: total > 0 && ratio >= 0.5,
    },
    {
      id: 'full-sweep',
      label: 'Full sweep',
      hint: total > 0 && completed >= total ? 'Every module completed.' : 'Complete every module.',
      icon: 'complete',
      earned: total > 0 && completed >= total,
    },
    {
      id: 'sharp',
      label: 'Sharp',
      hint: score >= 80 ? 'Average score above 80%.' : 'Hold an 80% average.',
      icon: 'sharp',
      earned: score >= 80,
    },
    {
      id: 'mastery',
      label: 'Mastery',
      hint: score >= 95 ? 'Average score above 95%.' : 'Hold a 95% average.',
      icon: 'mastery',
      earned: score >= 95,
    },
    {
      id: 'persistent',
      label: 'Persistent',
      hint: attempts >= 10 ? 'Ten quiz attempts logged.' : 'Take ten quizzes.',
      icon: 'practice',
      earned: attempts >= 10,
    },
    {
      id: 'cards-clear',
      label: 'Cards clear',
      hint: attempts > 0 && due === 0 ? 'No flashcards waiting.' : 'Clear every due flashcard.',
      icon: 'clear',
      earned: attempts > 0 && due === 0,
    },
  ];
}

/** Short encouraging line for the home hero, chosen from real state. */
export function progressHeadline(input: ProgressionInput): string {
  const completed = input.completedModules ?? 0;
  const total = input.totalModules ?? 0;
  const due = input.dueFlashcards ?? 0;
  if (total > 0 && completed >= total) return 'Every module complete — outstanding.';
  if (due > 0) return `${due} ${due === 1 ? 'card' : 'cards'} ready for review.`;
  if (completed === 0) return 'Open your first lesson to start growing.';
  const left = total - completed;
  if (total > 0) return `${left} ${left === 1 ? 'module' : 'modules'} left to finish.`;
  return 'Keep the momentum going.';
}
