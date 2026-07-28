import { describe, expect, it } from '@jest/globals';
import {
  buildDigestInsight,
  compareWeeklyPerformance,
} from '../src/domain/digest';
import type { ParentDigestSummary } from '../src/domain/types';

const summary: ParentDigestSummary = {
  modulesCompleted: 2,
  quizzesTaken: 3,
  averageScorePercentage: 82,
  trend: 'improving',
  flashcardsReviewed: 14,
  engagementDaysActive: 4,
  topStrugglingConcepts: [],
};

describe('parent digest', () => {
  it('compares weekly averages with a stable tolerance', () => {
    expect(compareWeeklyPerformance(82, 70)).toBe('improving');
    expect(compareWeeklyPerformance(70, 82)).toBe('declining');
    expect(compareWeeklyPerformance(81, 80)).toBe('stable');
    expect(compareWeeklyPerformance(81, null)).toBe('stable');
  });

  it('prioritizes a struggling concept in the deterministic insight', () => {
    const insight = buildDigestInsight(
      {
        ...summary,
        topStrugglingConcepts: [
          { conceptId: 'equivalent-fractions', missCount: 3 },
        ],
      },
      null,
    );
    expect(insight).toContain('equivalent fractions');
    expect(insight).toContain('3 missed responses');
  });

  it('reports an improving weekly average without external AI', () => {
    expect(
      buildDigestInsight(summary, {
        averageScorePercentage: 72,
        engagementDaysActive: 3,
      }),
    ).toContain('improved by 10 points');
  });
});
