import type {
  ParentDigestSummary,
  PerformanceTrend,
} from './types';

export function compareWeeklyPerformance(
  currentAverage: number,
  previousAverage: number | null,
): PerformanceTrend {
  if (previousAverage === null) return 'stable';
  const delta = currentAverage - previousAverage;
  if (delta > 2) return 'improving';
  if (delta < -2) return 'declining';
  return 'stable';
}

export function buildDigestInsight(
  current: ParentDigestSummary,
  previous: Pick<
    ParentDigestSummary,
    'averageScorePercentage' | 'engagementDaysActive'
  > | null,
): string {
  if (current.quizzesTaken === 0 && current.flashcardsReviewed === 0) {
    return 'No quiz or review activity was recorded this week. A short recall session is a good way to restart the routine.';
  }

  const concept = current.topStrugglingConcepts[0]?.conceptId;
  if (concept) {
    return `The most useful next step is another short practice session on ${friendlyConcept(concept)}, which had ${current.topStrugglingConcepts[0]!.missCount} missed response${current.topStrugglingConcepts[0]!.missCount === 1 ? '' : 's'}.`;
  }

  if (
    previous &&
    current.averageScorePercentage > previous.averageScorePercentage + 2
  ) {
    return `Average quiz performance improved by ${Math.round(current.averageScorePercentage - previous.averageScorePercentage)} points. Keep the same steady review rhythm.`;
  }

  if (
    previous &&
    current.engagementDaysActive > previous.engagementDaysActive
  ) {
    return `Learning activity spread across ${current.engagementDaysActive} days, more consistently than last week. Short, repeated sessions are working well.`;
  }

  return `This week included ${current.quizzesTaken} quiz attempt${current.quizzesTaken === 1 ? '' : 's'} and ${current.flashcardsReviewed} review${current.flashcardsReviewed === 1 ? '' : 's'}. Continue with the next due review items.`;
}

function friendlyConcept(value: string): string {
  return value.replaceAll(/[-_:]+/g, ' ').trim().toLocaleLowerCase();
}
