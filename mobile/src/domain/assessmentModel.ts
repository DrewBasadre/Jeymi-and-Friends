import { z } from 'zod';
import { sha256Hex } from './hash';
import { masteryFor } from './learning';
import type { MasteryLevel } from './types';

export const ASSESSMENT_SCHEMA_VERSION = 1 as const;
export const DELIVERY_MODES = ['paper_omr', 'digital_mini_quiz'] as const;
export const QUESTION_KINDS = [
  'multiple_choice',
  'true_false',
  'identification',
  'fill_in_the_blank',
] as const;
export const PAPER_QUESTION_KINDS = ['multiple_choice', 'true_false'] as const;
export const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
export const TRUE_FALSE_CHOICES = ['True', 'False'] as const;
export const MAX_DIGITAL_QUESTIONS = 50;
export const MAX_PAPER_QUESTIONS = 100;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export type ItemOutcome = 'correct' | 'incorrect' | 'unanswered';

export const stableIdSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/,
    'IDs use letters, numbers, dot, dash, or underscore (64 characters max).',
  );

const optionalText = (max: number) => z.string().max(max).default('');

export const assessmentQuestionSchema = z
  .object({
    id: stableIdSchema,
    kind: z.enum(QUESTION_KINDS),
    prompt: z.string().trim().min(1).max(1_200),
    choices: z.array(z.string().trim().min(1).max(240)).max(CHOICE_LABELS.length),
    answer: z.string().trim().min(1).max(240),
    acceptedAnswers: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
    rationale: optionalText(1_200),
    topic: z.string().trim().min(1).max(120),
    competency: z.string().trim().min(1).max(160),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    points: z.number().int().min(1).max(100),
    misconception: optionalText(600),
    intervention: optionalText(600),
    remediationRef: optionalText(200),
  })
  .superRefine((question, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (question.kind === 'multiple_choice') {
      if (question.choices.length < 2) issue('choices', 'Add at least two choices.');
      if (new Set(question.choices.map(normalizeAnswer)).size !== question.choices.length) {
        issue('choices', 'Choices must be distinct.');
      }
      for (const accepted of [question.answer, ...question.acceptedAnswers]) {
        if (!question.choices.includes(accepted)) {
          issue('answer', `"${accepted}" is not one of the choices.`);
        }
      }
    } else if (question.kind === 'true_false') {
      if (
        question.choices.length !== 2 ||
        question.choices[0] !== TRUE_FALSE_CHOICES[0] ||
        question.choices[1] !== TRUE_FALSE_CHOICES[1]
      ) {
        issue('choices', 'True-or-false choices must be exactly True and False.');
      }
      if (!TRUE_FALSE_CHOICES.includes(question.answer as 'True')) {
        issue('answer', 'The answer must be True or False.');
      }
      if (question.acceptedAnswers.length) {
        issue('acceptedAnswers', 'True-or-false questions have one answer.');
      }
    } else {
      if (question.choices.length) issue('choices', 'Only choice questions have choices.');
      if (question.kind === 'fill_in_the_blank' && !/_{3,}/.test(question.prompt)) {
        issue('prompt', 'Mark the blank with three or more underscores (___).');
      }
    }
  });

export const quizPolicySchema = z.object({
  attemptLimit: z.number().int().min(1).max(20).nullable(),
  feedback: z.enum(['immediate', 'after_submit', 'score_only']),
  revealAnswers: z.boolean(),
  dueDate: z.iso.date().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(240).nullable(),
  retake: z.enum(['not_allowed', 'allowed', 'below_mastery']),
  masteryPercent: z.number().int().min(1).max(100),
});

export const paperSettingsSchema = z.object({
  templateId: stableIdSchema,
  retainScanImages: z.boolean(),
});

export const quizFormSchema = z.object({
  code: z.string().regex(/^[A-D]$/, 'Form codes are A to D.'),
  questionOrder: z.array(stableIdSchema).min(1),
  choiceOrders: z.record(z.string(), z.array(z.number().int().min(0).max(4))),
});

export const quizDefinitionSchema = z
  .object({
    schemaVersion: z.literal(ASSESSMENT_SCHEMA_VERSION),
    quizId: stableIdSchema,
    version: z.number().int().min(1),
    mode: z.enum(DELIVERY_MODES),
    title: z.string().trim().min(1).max(160),
    gradeLevel: z.number().int().min(1).max(12),
    subject: z.string().trim().min(1).max(60),
    author: z.string().trim().min(1).max(160),
    createdAt: z.iso.datetime(),
    questions: z.array(assessmentQuestionSchema).min(1).max(MAX_PAPER_QUESTIONS),
    forms: z.array(quizFormSchema).min(1).max(4),
    policy: quizPolicySchema.nullable(),
    paper: paperSettingsSchema.nullable(),
  })
  .superRefine((quiz, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    const ids = quiz.questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) issue(['questions'], 'Question IDs must be unique.');
    const byId = new Map(quiz.questions.map((question) => [question.id, question]));
    const formCodes = new Set<string>();
    quiz.forms.forEach((form, index) => {
      if (formCodes.has(form.code)) issue(['forms', index], `Form ${form.code} is repeated.`);
      formCodes.add(form.code);
      const sameSet =
        form.questionOrder.length === ids.length &&
        new Set(form.questionOrder).size === ids.length &&
        form.questionOrder.every((id) => byId.has(id));
      if (!sameSet) {
        issue(['forms', index], `Form ${form.code} must list every question exactly once.`);
      }
      for (const [questionId, order] of Object.entries(form.choiceOrders)) {
        const question = byId.get(questionId);
        if (!question || !isPermutation(order, question.choices.length)) {
          issue(['forms', index, 'choiceOrders', questionId], 'Invalid choice order.');
        }
      }
    });
    if (quiz.forms[0]?.code !== 'A' || quiz.forms[0].questionOrder.join() !== ids.join()) {
      issue(['forms', 0], 'Form A must follow the canonical question order.');
    }
    if (quiz.mode === 'paper_omr') {
      if (!quiz.paper) issue(['paper'], 'Paper quizzes need an answer-sheet template.');
      quiz.questions.forEach((question, index) => {
        if (!(PAPER_QUESTION_KINDS as readonly string[]).includes(question.kind)) {
          issue(['questions', index, 'kind'], 'Paper quizzes support multiple choice and true or false.');
        }
      });
    } else {
      if (!quiz.policy) issue(['policy'], 'Digital mini-quizzes need a quiz policy.');
      if (quiz.paper) issue(['paper'], 'Digital mini-quizzes have no answer sheet.');
      if (quiz.questions.length > MAX_DIGITAL_QUESTIONS) {
        issue(['questions'], `Mini-quizzes hold at most ${MAX_DIGITAL_QUESTIONS} questions.`);
      }
    }
  });

export type AssessmentQuestion = z.infer<typeof assessmentQuestionSchema>;
export type AssessmentQuestionInput = z.input<typeof assessmentQuestionSchema>;
export type QuizPolicy = z.infer<typeof quizPolicySchema>;
export type QuizForm = z.infer<typeof quizFormSchema>;
export type QuizDefinition = z.infer<typeof quizDefinitionSchema>;
export type QuizDefinitionInput = z.input<typeof quizDefinitionSchema>;

export const DEFAULT_QUIZ_POLICY: QuizPolicy = {
  attemptLimit: 3,
  feedback: 'after_submit',
  revealAnswers: false,
  dueDate: null,
  timeLimitMinutes: null,
  retake: 'below_mastery',
  masteryPercent: 80,
};

export function parseQuizDefinition(value: unknown): QuizDefinition {
  return quizDefinitionSchema.parse(value);
}

/** Lowercase, trim, collapse spaces, drop trailing sentence punctuation. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
}

export function formFor(quiz: Pick<QuizDefinition, 'forms'>, code: string): QuizForm {
  const form = quiz.forms.find((candidate) => candidate.code === code);
  if (!form) throw new Error(`Form ${code} does not exist for this quiz.`);
  return form;
}

export function choiceOrderFor(
  form: QuizForm,
  question: Pick<AssessmentQuestion, 'id' | 'choices'>,
): number[] {
  return form.choiceOrders[question.id] ?? question.choices.map((_, index) => index);
}

/**
 * Fingerprint of one printed or delivered form: quiz identity plus the ordered
 * question IDs and each question's choice order. Any reordering changes it.
 */
export function assessmentFingerprint(
  quiz: Pick<QuizDefinition, 'quizId' | 'version' | 'questions'>,
  form: QuizForm,
): string {
  const byId = new Map(quiz.questions.map((question) => [question.id, question]));
  const parts = form.questionOrder.map((id) => {
    const question = byId.get(id);
    if (!question) throw new Error(`Form ${form.code} references unknown question ${id}.`);
    return `${id}:${choiceOrderFor(form, question).join('')}`;
  });
  return sha256Hex(
    ['PAVO-FP-1', quiz.quizId, quiz.version, form.code, parts.length, ...parts].join('|'),
  ).slice(0, 32);
}

/** Deterministic alternate form: shuffles question order and choice order. */
export function createAlternateForm(
  quiz: Pick<QuizDefinition, 'questions'>,
  code: QuizForm['code'],
  seed: number,
): QuizForm {
  const random = mulberry32(seed);
  const questionOrder = shuffle(
    quiz.questions.map((question) => question.id),
    random,
  );
  const choiceOrders: Record<string, number[]> = {};
  for (const question of quiz.questions) {
    if (question.kind === 'multiple_choice') {
      choiceOrders[question.id] = shuffle(
        question.choices.map((_, index) => index),
        random,
      );
    }
  }
  return { code, questionOrder, choiceOrders };
}

export interface QuestionAtPosition {
  position: number;
  question: AssessmentQuestion;
  displayChoices: string[];
  choiceOrder: number[];
}

/** Questions in the order a student sees them on one form (positions are 1-based). */
export function questionsForForm(quiz: QuizDefinition, code: string): QuestionAtPosition[] {
  const form = formFor(quiz, code);
  const byId = new Map(quiz.questions.map((question) => [question.id, question]));
  return form.questionOrder.map((id, index) => {
    const question = byId.get(id)!;
    const choiceOrder = choiceOrderFor(form, question);
    return {
      position: index + 1,
      question,
      choiceOrder,
      displayChoices: choiceOrder.map((choiceIndex) => question.choices[choiceIndex]!),
    };
  });
}

export function gradeAnswer(
  question: Pick<AssessmentQuestion, 'answer' | 'acceptedAnswers'>,
  response: string | null | undefined,
): ItemOutcome {
  if (response === null || response === undefined || !normalizeAnswer(response)) {
    return 'unanswered';
  }
  const accepted = [question.answer, ...question.acceptedAnswers].map(normalizeAnswer);
  return accepted.includes(normalizeAnswer(response)) ? 'correct' : 'incorrect';
}

export interface ScoredItem {
  position: number;
  questionId: string;
  outcome: ItemOutcome;
  pointsEarned: number;
  pointsPossible: number;
}

export interface ScoredAttempt {
  items: ScoredItem[];
  score: number;
  total: number;
  correctCount: number;
  percent: number;
  mastery: MasteryLevel;
}

export function summarizeItems(items: ScoredItem[]): ScoredAttempt {
  const score = items.reduce((sum, item) => sum + item.pointsEarned, 0);
  const total = items.reduce((sum, item) => sum + item.pointsPossible, 0);
  return {
    items,
    score,
    total,
    correctCount: items.filter((item) => item.outcome === 'correct').length,
    percent: total > 0 ? Math.round((score / total) * 100) : 0,
    mastery: masteryFor(score, total),
  };
}

/** Teacher-side scoring with the full answer key, keyed by stable question ID. */
export function scoreQuizResponses(
  quiz: QuizDefinition,
  formCode: string,
  responses: Record<string, string | null | undefined>,
): ScoredAttempt {
  return summarizeItems(
    questionsForForm(quiz, formCode).map(({ position, question }) => {
      const outcome = gradeAnswer(question, responses[question.id]);
      return {
        position,
        questionId: question.id,
        outcome,
        pointsEarned: outcome === 'correct' ? question.points : 0,
        pointsPossible: question.points,
      };
    }),
  );
}

export function answerKeyDigest(fingerprint: string, questionId: string, answer: string): string {
  return sha256Hex(`PAVO-KEY-1|${fingerprint}|${questionId}|${normalizeAnswer(answer)}`);
}

export const studentQuizQuestionSchema = z.object({
  id: stableIdSchema,
  position: z.number().int().min(1),
  kind: z.enum(QUESTION_KINDS),
  prompt: z.string().min(1).max(1_200),
  choices: z.array(z.string().min(1).max(240)).max(CHOICE_LABELS.length),
  points: z.number().int().min(1).max(100),
  topic: z.string().min(1).max(120),
  keyDigests: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(9),
  reveal: z
    .object({ answer: z.string().min(1).max(240), rationale: z.string().max(1_200) })
    .nullable(),
});

export const studentQuizSchema = z.object({
  schemaVersion: z.literal(ASSESSMENT_SCHEMA_VERSION),
  kind: z.literal('pavo-student-quiz'),
  quizId: stableIdSchema,
  version: z.number().int().min(1),
  formCode: z.string().regex(/^[A-D]$/),
  fingerprint: z.string().regex(/^[a-f0-9]{32}$/),
  title: z.string().min(1).max(160),
  gradeLevel: z.number().int().min(1).max(12),
  subject: z.string().min(1).max(60),
  policy: quizPolicySchema,
  questions: z.array(studentQuizQuestionSchema).min(1).max(MAX_DIGITAL_QUESTIONS),
});

export type StudentQuiz = z.infer<typeof studentQuizSchema>;
export type StudentQuizQuestion = z.infer<typeof studentQuizQuestionSchema>;

/**
 * The only quiz shape that leaves the teacher device for students. Answer keys
 * become salted digests; plaintext answers appear only when the teacher chose
 * to reveal them after submission.
 */
export function buildStudentQuiz(quiz: QuizDefinition, formCode = 'A'): StudentQuiz {
  if (quiz.mode !== 'digital_mini_quiz' || !quiz.policy) {
    throw new Error('Only digital mini-quizzes are delivered to student devices.');
  }
  const fingerprint = assessmentFingerprint(quiz, formFor(quiz, formCode));
  return studentQuizSchema.parse({
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    kind: 'pavo-student-quiz',
    quizId: quiz.quizId,
    version: quiz.version,
    formCode,
    fingerprint,
    title: quiz.title,
    gradeLevel: quiz.gradeLevel,
    subject: quiz.subject,
    policy: quiz.policy,
    questions: questionsForForm(quiz, formCode).map(({ position, question, displayChoices }) => ({
      id: question.id,
      position,
      kind: question.kind,
      prompt: question.prompt,
      choices: displayChoices,
      points: question.points,
      topic: question.topic,
      keyDigests: [question.answer, ...question.acceptedAnswers].map((answer) =>
        answerKeyDigest(fingerprint, question.id, answer),
      ),
      reveal: quiz.policy!.revealAnswers
        ? { answer: question.answer, rationale: question.rationale }
        : null,
    })),
  });
}

export function gradeStudentAnswer(
  quiz: Pick<StudentQuiz, 'fingerprint'>,
  question: Pick<StudentQuizQuestion, 'id' | 'keyDigests'>,
  response: string | null | undefined,
): ItemOutcome {
  if (response === null || response === undefined || !normalizeAnswer(response)) {
    return 'unanswered';
  }
  return question.keyDigests.includes(answerKeyDigest(quiz.fingerprint, question.id, response))
    ? 'correct'
    : 'incorrect';
}

export function scoreStudentQuiz(
  quiz: StudentQuiz,
  responses: Record<string, string | null | undefined>,
): ScoredAttempt {
  return summarizeItems(
    quiz.questions.map((question) => {
      const outcome = gradeStudentAnswer(quiz, question, responses[question.id]);
      return {
        position: question.position,
        questionId: question.id,
        outcome,
        pointsEarned: outcome === 'correct' ? question.points : 0,
        pointsPossible: question.points,
      };
    }),
  );
}

export type RetakeDecision =
  | { allowed: true }
  | { allowed: false; reason: 'attempt_limit' | 'not_allowed' | 'mastered' | 'past_due' };

export function retakeDecision(
  policy: QuizPolicy,
  previous: Array<{ percent: number }>,
  today: string,
): RetakeDecision {
  if (policy.dueDate && today > policy.dueDate) return { allowed: false, reason: 'past_due' };
  if (previous.length === 0) return { allowed: true };
  if (policy.attemptLimit !== null && previous.length >= policy.attemptLimit) {
    return { allowed: false, reason: 'attempt_limit' };
  }
  if (policy.retake === 'not_allowed') return { allowed: false, reason: 'not_allowed' };
  if (
    policy.retake === 'below_mastery' &&
    previous.some((attempt) => attempt.percent >= policy.masteryPercent)
  ) {
    return { allowed: false, reason: 'mastered' };
  }
  return { allowed: true };
}

function isPermutation(order: number[], length: number): boolean {
  return order.length === length && [...order].sort((a, b) => a - b).every((value, index) => value === index);
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
