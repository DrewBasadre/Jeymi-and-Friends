import type {
  FlashcardRating,
  LearningAssessmentAnswer,
  LearningProfile,
  LearningStyle,
  MasteryLevel,
  QuestionResponse,
} from './types';

const STYLES: Array<Exclude<LearningStyle, 'balanced'>> = [
  'visual',
  'auditory',
  'reading',
  'kinesthetic',
];

export function masteryFor(score: number, total: number): MasteryLevel {
  if (total <= 0) return 'BEGINNER';
  const ratio = score / total;
  if (ratio >= 0.9) return 'ADVANCED';
  if (ratio >= 0.8) return 'PROFICIENT';
  if (ratio >= 0.6) return 'DEVELOPING';
  return 'BEGINNER';
}

export function averagePercent(scores: Array<{ score: number; totalItems: number }>): number {
  const valid = scores.filter((item) => item.totalItems > 0);
  if (valid.length === 0) return 0;
  const average = valid.reduce((sum, item) => sum + (item.score / item.totalItems) * 100, 0) / valid.length;
  return Math.round(average * 10) / 10;
}

export function deriveLearningProfile(
  studentId: string,
  answers: LearningAssessmentAnswer[],
  guardianAcknowledgedAt: number | null,
  completedAt = Date.now(),
): LearningProfile {
  const scores = {
    visual: 0,
    auditory: 0,
    reading: 0,
    kinesthetic: 0,
  };
  answers.forEach((answer) => {
    scores[answer.style] += 1;
  });
  const highest = Math.max(...Object.values(scores));
  const leaders = STYLES.filter((style) => scores[style] === highest);
  const primaryStyle: LearningStyle = leaders.length === 1 && answers.length > 0 ? leaders[0]! : 'balanced';
  return {
    studentId,
    primaryStyle,
    scores,
    assessmentVersion: 1,
    completedAt,
    guardianAcknowledgedAt,
  };
}

export function analyzeResponses(
  questions: Array<{ id: string; topicTag: string }>,
  responses: QuestionResponse[],
): { weakTopic: string; strongTopic: string } {
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const question of questions) {
    const response = responses.find((item) => item.questionId === question.id);
    const current = byTopic.get(question.topicTag) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (response?.isCorrect) current.correct += 1;
    byTopic.set(question.topicTag, current);
  }
  const ranked = [...byTopic.entries()].sort((a, b) => {
    const aRatio = a[1].total === 0 ? 0 : a[1].correct / a[1].total;
    const bRatio = b[1].total === 0 ? 0 : b[1].correct / b[1].total;
    return aRatio - bRatio;
  });
  return {
    weakTopic: ranked[0]?.[0] ?? 'Ready for next challenge',
    strongTopic: ranked.at(-1)?.[0] ?? 'Needs more practice',
  };
}

export function nextReview(
  rating: FlashcardRating,
  current: { easeFactor: number; intervalDays: number; repetitions: number },
  reviewedAt = Date.now(),
): { easeFactor: number; intervalDays: number; repetitions: number; dueAt: number } {
  const quality = rating + 1;
  let repetitions = current.repetitions;
  let intervalDays = current.intervalDays;
  let easeFactor = current.easeFactor;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueAt: reviewedAt + intervalDays * 86_400_000,
  };
}

