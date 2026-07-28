import { describe, expect, it, test } from '@jest/globals';
import {
  analyzeResponses,
  averagePercent,
  deriveLearningProfile,
  masteryFor,
  nextReview,
} from '../src/domain/learning';

describe('learning domain', () => {
  test.each([
    [0, 0, 'BEGINNER'],
    [5, 10, 'BEGINNER'],
    [6, 10, 'DEVELOPING'],
    [8, 10, 'PROFICIENT'],
    [9, 10, 'ADVANCED'],
  ] satisfies Array<[number, number, ReturnType<typeof masteryFor>]>)(
    'maps %i/%i to %s mastery',
    (score, total, expected) => {
    expect(masteryFor(score, total)).toBe(expected);
    },
  );

  it('averages percentages without weighting larger quizzes more heavily', () => {
    expect(
      averagePercent([
        { score: 8, totalItems: 10 },
        { score: 1, totalItems: 2 },
      ]),
    ).toBe(65);
  });

  it('selects a unique learning-style leader', () => {
    const profile = deriveLearningProfile(
      'student-1',
      [
        { questionId: 'q1', style: 'visual' },
        { questionId: 'q2', style: 'visual' },
        { questionId: 'q3', style: 'reading' },
      ],
      1_000,
      2_000,
    );

    expect(profile).toEqual({
      studentId: 'student-1',
      primaryStyle: 'visual',
      scores: {
        visual: 2,
        auditory: 0,
        reading: 1,
        kinesthetic: 0,
      },
      assessmentVersion: 1,
      completedAt: 2_000,
      guardianAcknowledgedAt: 1_000,
    });
  });

  it('uses balanced when assessment styles are tied', () => {
    const profile = deriveLearningProfile(
      'student-1',
      [
        { questionId: 'q1', style: 'visual' },
        { questionId: 'q2', style: 'auditory' },
      ],
      null,
    );

    expect(profile.primaryStyle).toBe('balanced');
  });

  it('identifies the strongest and weakest response topics', () => {
    const result = analyzeResponses(
      [
        { id: 'q1', topicTag: 'Fractions' },
        { id: 'q2', topicTag: 'Fractions' },
        { id: 'q3', topicTag: 'Materials' },
      ],
      [
        { questionId: 'q1', answer: '1/2', isCorrect: false, elapsedMs: 4_000 },
        { questionId: 'q2', answer: '1/4', isCorrect: true, elapsedMs: 3_000 },
        { questionId: 'q3', answer: 'solid', isCorrect: true, elapsedMs: 2_000 },
      ],
    );

    expect(result).toEqual({
      weakTopic: 'Fractions',
      strongTopic: 'Materials',
    });
  });

  it('resets a missed flashcard and schedules it for tomorrow', () => {
    const reviewedAt = 1_700_000_000_000;
    const review = nextReview(
      1,
      { easeFactor: 2.5, intervalDays: 12, repetitions: 3 },
      reviewedAt,
    );

    expect(review.repetitions).toBe(0);
    expect(review.intervalDays).toBe(1);
    expect(review.easeFactor).toBeGreaterThanOrEqual(1.3);
    expect(review.dueAt).toBe(reviewedAt + 86_400_000);
  });
});
