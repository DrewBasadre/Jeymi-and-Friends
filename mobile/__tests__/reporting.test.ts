import { describe, expect, it } from '@jest/globals';
import {
  buildClassPerformanceReport,
  performanceTrend,
} from '../src/domain/reporting';
import type {
  LearningFormat,
  QuizAttempt,
  StudentPerformanceReport,
} from '../src/domain/types';

function attempt(
  score: number,
  submittedAt: number,
  studentId = 'student-1',
): QuizAttempt {
  return {
    id: `attempt-${studentId}-${submittedAt}`,
    studentId,
    moduleId: 'module-1',
    score,
    totalItems: 10,
    weakTopic: 'fractions',
    strongTopic: 'measurement',
    masteryLevel: 'DEVELOPING',
    durationSeconds: 60,
    attemptNumber: 1,
    submittedAt,
    learningFormatUsed: 'text',
    responses: [],
  };
}

function report(args: {
  studentId: string;
  average: number;
  trend?: StudentPerformanceReport['trend'];
  latestScore?: number;
  concepts?: string[];
  format?: LearningFormat;
}): StudentPerformanceReport {
  return {
    studentId: args.studentId,
    profile: {
      name: args.studentId,
      studentNumber: args.studentId,
      section: 'Emerald',
      currentLearningFormat: args.format ?? 'text',
    },
    quizHistory: [attempt(args.latestScore ?? 8, 3, args.studentId)],
    averageScorePercentage: args.average,
    strugglingConcepts: (args.concepts ?? []).map((conceptId) => ({
      conceptId,
      missCount: 1,
      attempts: 1,
    })),
    trend: args.trend ?? 'stable',
  };
}

describe('offline performance reporting', () => {
  it('derives trends from the newest and oldest of the last three attempts', () => {
    expect(performanceTrend([attempt(8, 3), attempt(7, 2), attempt(5, 1)])).toBe(
      'improving',
    );
    expect(performanceTrend([attempt(5, 3), attempt(7, 2), attempt(8, 1)])).toBe(
      'declining',
    );
    expect(performanceTrend([attempt(8, 3), attempt(8, 2)])).toBe('stable');
  });

  it('builds a deterministic section leaderboard and class average', () => {
    const result = buildClassPerformanceReport('section-1', [
      report({ studentId: 'b', average: 75 }),
      report({ studentId: 'a', average: 90 }),
    ]);

    expect(result.classAveragePercentage).toBe(82.5);
    expect(result.leaderboard.map((entry) => entry.studentId)).toEqual([
      'a',
      'b',
    ]);
  });

  it('flags low latest scores or declining trends', () => {
    const result = buildClassPerformanceReport('section-1', [
      report({ studentId: 'low', average: 70, latestScore: 5 }),
      report({ studentId: 'declining', average: 80, trend: 'declining' }),
      report({ studentId: 'steady', average: 80 }),
    ]);

    expect(result.strugglingStudents).toEqual(['low', 'declining']);
  });

  it('counts each learner once per commonly missed concept', () => {
    const result = buildClassPerformanceReport('section-1', [
      report({
        studentId: 'a',
        average: 80,
        concepts: ['fractions', 'measurement'],
      }),
      report({ studentId: 'b', average: 70, concepts: ['fractions'] }),
    ]);

    expect(result.commonlyMissedConcepts).toEqual([
      { conceptId: 'fractions', percentOfClassMissing: 100 },
      { conceptId: 'measurement', percentOfClassMissing: 50 },
    ]);
  });
});
