import { describe, expect, it } from '@jest/globals';
import {
  assessmentFingerprint,
  buildStudentQuiz,
  formFor,
  parseQuizDefinition,
  questionsForForm,
  retakeDecision,
  scoreQuizResponses,
  scoreStudentQuiz,
  DEFAULT_QUIZ_POLICY,
} from '../src/domain/assessmentModel';
import { digitalQuiz, paperQuiz, plantQuestions } from './fixtures/quizzes';

describe('assessment definitions', () => {
  it('keeps the authored canonical order on form A', () => {
    const quiz = digitalQuiz();
    expect(questionsForForm(quiz, 'A').map((item) => [item.position, item.question.id])).toEqual([
      [1, 'q-leaf'],
      [2, 'q-sun'],
      [3, 'q-gas'],
      [4, 'q-blank'],
    ]);
  });

  it('derives a stable fingerprint that changes with order, version, and choice order', () => {
    const quiz = digitalQuiz();
    const fingerprint = assessmentFingerprint(quiz, formFor(quiz, 'A'));
    expect(fingerprint).toMatch(/^[a-f0-9]{32}$/);
    expect(assessmentFingerprint(digitalQuiz(), formFor(digitalQuiz(), 'A'))).toBe(fingerprint);
    expect(assessmentFingerprint({ ...quiz, version: 2 }, formFor(quiz, 'A'))).not.toBe(fingerprint);
    const reordered = { ...formFor(quiz, 'A'), questionOrder: ['q-sun', 'q-leaf', 'q-gas', 'q-blank'] };
    expect(assessmentFingerprint(quiz, reordered)).not.toBe(fingerprint);
    const rechoiced = { ...formFor(quiz, 'A'), choiceOrders: { 'q-leaf': [1, 0, 2, 3] } };
    expect(assessmentFingerprint(quiz, rechoiced)).not.toBe(fingerprint);
  });

  it('rejects invalid questions and mode mismatches', () => {
    expect(() =>
      digitalQuiz({ questions: [{ ...digitalQuiz().questions[0]!, answer: 'Bark' }] } as never),
    ).toThrow('not one of the choices');
    expect(() =>
      parseQuizDefinition({ ...paperQuiz(), questions: [...paperQuiz().questions, digitalQuiz().questions[2]] }),
    ).toThrow();
    expect(() => digitalQuiz({ policy: null })).toThrow('quiz policy');
    expect(() =>
      digitalQuiz({
        forms: [{ code: 'A', questionOrder: ['q-leaf', 'q-sun'], choiceOrders: {} }],
      }),
    ).toThrow('every question');
  });
});

describe('scoring', () => {
  it('scores points with alternates, normalization, and blanks', () => {
    const scored = scoreQuizResponses(digitalQuiz(), 'A', {
      'q-leaf': 'Leaf',
      'q-sun': 'False',
      'q-gas': '  co2. ',
      'q-blank': '',
    });
    expect(scored.items.map((item) => item.outcome)).toEqual([
      'correct',
      'incorrect',
      'correct',
      'unanswered',
    ]);
    expect(scored.score).toBe(3);
    expect(scored.total).toBe(5);
    expect(scored.percent).toBe(60);
  });

  it('grades alternate paper forms against their own answer letters', () => {
    const quiz = paperQuiz();
    const formB = questionsForForm(quiz, 'B');
    const responses: Record<string, string> = {};
    for (const { question } of formB) responses[question.id] = question.answer;
    expect(scoreQuizResponses(quiz, 'B', responses).percent).toBe(100);
    const reordered = formB.some(
      ({ question, displayChoices }) =>
        question.kind === 'multiple_choice' && displayChoices.join() !== question.choices.join(),
    );
    expect(reordered).toBe(true);
  });
});

describe('answer-key isolation', () => {
  it('ships only salted digests to students and still scores offline', () => {
    const quiz = digitalQuiz();
    const studentQuiz = buildStudentQuiz(quiz);
    const serialized = JSON.stringify(studentQuiz);
    for (const question of plantQuestions) {
      if (question.kind === 'multiple_choice' || question.kind === 'true_false') continue;
      expect(serialized).not.toContain(question.answer);
      for (const alternate of question.acceptedAnswers ?? []) expect(serialized).not.toContain(alternate);
    }
    expect(serialized).not.toContain('rationale');
    expect(studentQuiz.questions.every((question) => question.reveal === null)).toBe(true);

    const result = scoreStudentQuiz(studentQuiz, {
      'q-leaf': 'Leaf',
      'q-sun': 'True',
      'q-gas': 'carbon dioxide',
      'q-blank': 'Chlorophyll',
    });
    expect(result.percent).toBe(100);
    expect(scoreStudentQuiz(studentQuiz, { 'q-leaf': 'Root' }).items[0]?.outcome).toBe('incorrect');
  });

  it('reveals answers only when the policy allows it', () => {
    const revealed = buildStudentQuiz(
      digitalQuiz({ policy: { ...DEFAULT_QUIZ_POLICY, revealAnswers: true } }),
    );
    expect(revealed.questions[2]?.reveal?.answer).toBe('Carbon dioxide');
  });

  it('refuses to build a student package for paper quizzes', () => {
    expect(() => buildStudentQuiz(paperQuiz())).toThrow('digital');
  });
});

describe('retake policy', () => {
  const policy = { ...DEFAULT_QUIZ_POLICY, attemptLimit: 2, dueDate: '2026-10-10' };
  it('allows, limits, and stops retakes', () => {
    expect(retakeDecision(policy, [], '2026-10-04')).toEqual({ allowed: true });
    expect(retakeDecision(policy, [{ percent: 50 }], '2026-10-04')).toEqual({ allowed: true });
    expect(retakeDecision(policy, [{ percent: 90 }], '2026-10-04')).toEqual({ allowed: false, reason: 'mastered' });
    expect(retakeDecision(policy, [{ percent: 10 }, { percent: 20 }], '2026-10-04')).toEqual({
      allowed: false,
      reason: 'attempt_limit',
    });
    expect(retakeDecision(policy, [], '2026-10-11')).toEqual({ allowed: false, reason: 'past_due' });
  });
});
