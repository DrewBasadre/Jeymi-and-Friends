import { describe, expect, it } from '@jest/globals';
import { strFromU8 } from 'fflate';
import { DEFAULT_QUIZ_POLICY, studentQuizSchema } from '../src/domain/assessmentModel';
import { readPackage } from '../src/domain/packageV2';
import {
  buildMiniQuizPackage,
  buildQuizFromDraft,
  newQuestion,
  questionFromModule,
  type QuizDraftInput,
} from '../src/domain/quizAuthoring';
import { plantQuestions } from './fixtures/quizzes';
import { assessmentQuestionSchema } from '../src/domain/assessmentModel';

const questions = plantQuestions.map((question) => assessmentQuestionSchema.parse(question));
const draft = (overrides: Partial<QuizDraftInput> = {}): QuizDraftInput => ({
  quizId: 'plants-mini',
  version: 1,
  mode: 'digital_mini_quiz',
  title: 'Plants mini-quiz',
  gradeLevel: 5,
  subject: 'Science',
  questions,
  policy: DEFAULT_QUIZ_POLICY,
  templateId: 'pavo-std-20x4',
  alternateForms: 0,
  retainScanImages: false,
  masterKey: null,
  forms: null,
  ...overrides,
});

describe('quiz authoring', () => {
  it('requires a delivery mode and mode-appropriate question kinds', () => {
    expect(() => buildQuizFromDraft(draft({ mode: null }), 'teacher:demo', '2026-10-04T00:00:00.000Z')).toThrow('Choose Paper quiz');
    expect(() => buildQuizFromDraft(draft({ mode: 'paper_omr' }), 'teacher:demo', '2026-10-04T00:00:00.000Z')).toThrow('cannot be used in a paper quiz');
  });

  it('builds a digital mini-quiz with policy and no alternate forms', () => {
    const quiz = buildQuizFromDraft(draft({ alternateForms: 2 }), 'teacher:demo', '2026-10-04T00:00:00.000Z');
    expect(quiz.forms).toHaveLength(1);
    expect(quiz.policy).toEqual(DEFAULT_QUIZ_POLICY);
    expect(quiz.paper).toBeNull();
  });

  it('builds paper quizzes with deterministic alternate forms and a master-sheet key', () => {
    const paper = questions.filter((question) => question.kind === 'multiple_choice' || question.kind === 'true_false');
    const input = draft({ mode: 'paper_omr', questions: paper, alternateForms: 2, masterKey: { 'q-leaf': { answer: 'Stem', acceptedAnswers: ['Leaf'] } } });
    const first = buildQuizFromDraft(input, 'teacher:demo', '2026-10-04T00:00:00.000Z');
    const second = buildQuizFromDraft(input, 'teacher:demo', '2026-10-04T00:00:00.000Z');
    expect(first.forms.map((form) => form.code)).toEqual(['A', 'B', 'C']);
    expect(second.forms).toEqual(first.forms);
    expect(first.questions.find((question) => question.id === 'q-leaf')).toMatchObject({ answer: 'Stem', acceptedAnswers: ['Leaf'] });
    expect(first.paper).toEqual({ templateId: 'pavo-std-20x4', retainScanImages: false });
  });

  it('reuses module questions with their kind preserved', () => {
    const converted = questionFromModule(
      { id: 'legacy', moduleId: 'm', type: 'MULTIPLE_CHOICE', questionText: 'Pick one', choices: ['True', 'False'], correctAnswer: 'True', topicTag: 'logic' },
      'reuse-1',
      'S5-1',
    );
    expect(converted.kind).toBe('true_false');
    expect(assessmentQuestionSchema.parse(converted).competency).toBe('S5-1');
    expect(newQuestion('fill_in_the_blank', 'blank-1').prompt).toContain('___');
  });

  it('packages a mini-quiz for students without the answer key', () => {
    const quiz = buildQuizFromDraft(draft(), 'teacher:demo', '2026-10-04T00:00:00.000Z');
    const { archive } = buildMiniQuizPackage({ quiz, author: { id: 'teacher_demo', name: 'Ms. Reyes' }, createdAt: '2026-10-04T00:00:00.000Z' });
    const read = readPackage(archive, { audience: 'student', now: Date.UTC(2026, 9, 4) });
    expect(read.manifest.packageType).toBe('quiz');
    expect(read.manifest.redistribution.studentToStudent).toBe(false);
    const studentQuiz = studentQuizSchema.parse(JSON.parse(strFromU8(read.files['quiz.json']!)));
    expect(JSON.stringify(studentQuiz)).not.toContain('Carbon dioxide');
  });
});
