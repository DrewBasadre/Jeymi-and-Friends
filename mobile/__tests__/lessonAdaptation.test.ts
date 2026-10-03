import { describe, expect, it } from '@jest/globals';
import { parseAdaptiveLesson } from '../src/domain/adaptiveLesson';
import { planLessonPresentation, type LearnerEvidence } from '../src/domain/lessonAdaptation';
import { PHOTOSYNTHESIS_LESSON } from './fixtures/lessons';

const lesson = parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON);
const neutral: LearnerEvidence = {
  preferredStyle: null,
  adaptiveFormat: null,
  manualFormat: null,
  recentPercent: null,
  missedConcepts: [],
  timingPattern: null,
  dueReviews: 0,
  accessibility: { screenReader: false, largeText: false },
  online: true,
};

describe('lesson adaptation', () => {
  it('uses the authored order and hides remediation and extension without evidence', () => {
    const plan = planLessonPresentation(lesson, neutral);
    expect(plan.format).toBe('text');
    expect(plan.blockOrder).not.toContain('remedy-1');
    expect(plan.blockOrder).not.toContain('extend-1');
    expect(plan.blockOrder[0]).toBe('obj-1');
    expect(plan.reasons).toEqual([]);
  });

  it('explains every adaptation with the signal that caused it', () => {
    const plan = planLessonPresentation(lesson, {
      ...neutral,
      preferredStyle: 'visual',
      recentPercent: 45,
      missedConcepts: ['photosynthesis'],
      timingPattern: 'fast-and-wrong',
      dueReviews: 3,
      online: false,
    });
    expect(plan.format).toBe('visual');
    expect(plan.blockOrder.indexOf('leaf-visual')).toBeLessThan(plan.blockOrder.indexOf('photosynthesis'));
    expect(plan.blockOrder.indexOf('remedy-1')).toBe(plan.blockOrder.indexOf('photosynthesis') + 1);
    expect(plan.blockOrder.indexOf('hints-1')).toBeLessThan(plan.blockOrder.indexOf('guided-1'));
    expect(plan.expandWorkedExamples && plan.hintsBeforePractice && plan.pauseBeforeChecks && plan.suggestReview).toBe(true);
    expect(plan.reasons.map((reason) => reason.signal)).toEqual(
      expect.arrayContaining(['learning_preference', 'missed_concepts', 'quiz_performance', 'response_time', 'review_history', 'connectivity']),
    );
  });

  it('lets a manual choice override confident format evidence, and turns on read-aloud for screen readers', () => {
    const plan = planLessonPresentation(lesson, {
      ...neutral,
      adaptiveFormat: { current: 'audio', confidence: 0.9 },
      manualFormat: 'kinesthetic',
      accessibility: { screenReader: true, largeText: false },
    });
    expect(plan.format).toBe('kinesthetic');
    expect(plan.reasons[0]).toEqual({ signal: 'manual_choice', effect: 'Showing the kinesthetic format you chose.' });
    expect(plan.showReadAloud).toBe(true);
    expect(plan.blockOrder.indexOf('guided-1')).toBeLessThan(plan.blockOrder.indexOf('example-1'));
  });

  it('includes the extension for confident learners', () => {
    const plan = planLessonPresentation(lesson, { ...neutral, recentPercent: 92 });
    expect(plan.blockOrder).toContain('extend-1');
    expect(plan.includeExtension).toBe(true);
  });
});
