import { describe, expect, it } from '@jest/globals';
import {
  parseAssessmentGuide,
  renderAssessmentGuide,
  resolveFormPositions,
} from '../src/domain/assessmentGuide';
import {
  analyzeAssessment,
  buildLearnerPlan,
  renderAssessmentReport,
  type GradedResult,
} from '../src/domain/assessmentAnalytics';
import { assessmentFingerprint, formFor, scoreQuizResponses } from '../src/domain/assessmentModel';
import { digitalQuiz, paperQuiz } from './fixtures/quizzes';

describe('assessment-guide.md', () => {
  it('round-trips every teacher field and every form', () => {
    for (const quiz of [digitalQuiz(), paperQuiz()]) {
      const guide = parseAssessmentGuide(renderAssessmentGuide(quiz));
      expect(guide.quizId).toBe(quiz.quizId);
      expect(guide.version).toBe(quiz.version);
      expect(guide.questions.map(({ number: _number, ...question }) => question)).toEqual(quiz.questions);
      expect(guide.forms.map((form) => form.fingerprint)).toEqual(
        quiz.forms.map((form) => assessmentFingerprint(quiz, form)),
      );
    }
  });

  it('lists the answer key, rationale, and remediation for each question', () => {
    const markdown = renderAssessmentGuide(digitalQuiz());
    expect(markdown).toContain('## Question 3 · `q-gas`');
    expect(markdown).toContain('- Correct answer: Carbon dioxide');
    expect(markdown).toContain('- Also accept: CO2');
    expect(markdown).toContain('- Remediation block: adaptive-lesson#photosynthesis');
  });

  it('rejects a guide whose question order was edited', () => {
    const markdown = renderAssessmentGuide(digitalQuiz()).replace(
      'q-leaf, q-sun, q-gas, q-blank',
      'q-sun, q-leaf, q-gas, q-blank',
    );
    expect(() => parseAssessmentGuide(markdown)).toThrow('fingerprint');
  });

  it('maps form positions to stable IDs and refuses out-of-range positions', () => {
    const quiz = paperQuiz();
    const guide = parseAssessmentGuide(renderAssessmentGuide(quiz));
    const formB = formFor(quiz, 'B');
    expect(resolveFormPositions(guide, 'B', [1, 3]).map((question) => question.id)).toEqual([
      formB.questionOrder[0],
      formB.questionOrder[2],
    ]);
    expect(() => resolveFormPositions(guide, 'A', [11])).toThrow('outside the quiz');
  });
});

describe('assessment analytics', () => {
  const quiz = paperQuiz();
  const guide = parseAssessmentGuide(renderAssessmentGuide(quiz));
  const result = (studentId: string, formCode: string, wrong: string[], attemptNumber = 1): GradedResult => {
    const responses: Record<string, string | null> = {};
    for (const question of quiz.questions) {
      responses[question.id] = wrong.includes(question.id)
        ? question.choices.find((choice) => choice !== question.answer)!
        : question.answer;
    }
    const scored = scoreQuizResponses(quiz, formCode, responses);
    return {
      resultId: `${studentId}-${attemptNumber}`,
      studentId,
      quizId: quiz.quizId,
      quizVersion: quiz.version,
      formCode,
      attemptNumber,
      source: 'paper_scan',
      completedAt: attemptNumber,
      score: scored.score,
      total: scored.total,
      items: scored.items.map((item) => {
        const question = quiz.questions.find((candidate) => candidate.id === item.questionId)!;
        const chosen = responses[item.questionId]!;
        return { questionId: item.questionId, outcome: item.outcome, selectedChoice: question.choices.indexOf(chosen) };
      }),
    };
  };

  it('computes item difficulty, distractors, misconceptions, and remediation', () => {
    const analytics = analyzeAssessment(
      guide,
      [
        result('ana', 'A', ['p2', 'p3']),
        result('ben', 'B', ['p2']),
        result('cara', 'A', ['p2', 'p6', 'p7', 'p8', 'p9']),
        result('cara', 'A', ['p2'], 2),
      ],
      { rosterSize: 4, masteryPercent: 85 },
    );
    expect(analytics.resultCount).toBe(3);
    expect(analytics.completionRate).toBe(0.75);
    const p2 = analytics.items.find((item) => item.questionId === 'p2')!;
    expect(p2.correctRate).toBe(0);
    expect(p2.difficulty).toBe('hard');
    expect(p2.distractors?.find((entry) => entry.isKey)?.count).toBe(0);
    expect(analytics.commonlyMissed[0]?.questionId).toBe('p2');
    expect(analytics.misconceptions[0]).toMatchObject({ questionId: 'p2', misconception: 'Adds denominators.' });
    expect(analytics.needsRemediation.map((entry) => entry.studentId)).toEqual(['ana']);
    expect(analytics.forms).toEqual([
      { code: 'A', resultCount: 2, meanPercent: 85 },
      { code: 'B', resultCount: 1, meanPercent: 90 },
    ]);
    expect(analytics.attempts.map((entry) => entry.attemptNumber)).toEqual([1, 2]);
    expect(renderAssessmentReport(guide, analytics, { ana: 'Ana Santos' })).toContain('Ana Santos: 80%');
  });

  it('builds a learner plan grouped by competency', () => {
    const plan = buildLearnerPlan(guide, result('ana', 'A', ['p2', 'p3', 'p7']));
    expect(plan.incorrect.map((question) => question.number)).toEqual([2, 3, 7]);
    expect(plan.competencies[0]).toMatchObject({ competency: 'M5NS-Ia', questionNumbers: [2, 3] });
    expect(plan.competencies[0]?.misconceptions).toEqual(['Adds denominators.']);
    expect(plan.summary).toContain('M5NS-Ia');
  });
});
