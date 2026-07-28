import { describe, expect, it } from '@jest/globals';
import {
  createInlineRecallForTerm,
  createInlineRecallFromSelection,
  isInlineRecallAnswerCorrect,
} from '../src/domain/inlineRecall';

describe('inline recall activities', () => {
  it('turns a selected lesson span into a sentence-level cloze', () => {
    const text =
      'Fractions describe equal parts of a whole. The denominator names the total equal parts.';
    const start = text.indexOf('denominator');
    const activity = createInlineRecallFromSelection(
      text,
      start,
      start + 'denominator'.length,
    );

    expect(activity).toMatchObject({
      answer: 'denominator',
      sentence: 'The denominator names the total equal parts.',
      prompt: 'The _____ names the total equal parts.',
    });
  });

  it('finds a teacher-tagged term without case sensitivity', () => {
    const activity = createInlineRecallForTerm(
      'Evaporation changes liquid water into water vapor.',
      'evaporation',
    );

    expect(activity?.prompt).toBe(
      '_____ changes liquid water into water vapor.',
    );
  });

  it('normalizes harmless answer spacing and punctuation', () => {
    const activity = createInlineRecallForTerm(
      'A numerator counts selected parts.',
      'numerator',
    );
    if (!activity) throw new Error('Expected recall activity.');

    expect(isInlineRecallAnswerCorrect(activity, '  NUMERATOR. ')).toBe(true);
    expect(isInlineRecallAnswerCorrect(activity, 'denominator')).toBe(false);
  });

  it('rejects empty and punctuation-only selections', () => {
    expect(createInlineRecallFromSelection('Hello world.', 2, 2)).toBeNull();
    expect(createInlineRecallFromSelection('Hello ... world.', 6, 9)).toBeNull();
  });
});
