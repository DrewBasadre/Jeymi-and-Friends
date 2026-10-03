import { strToU8 } from 'fflate';
import {
  ASSESSMENT_SCHEMA_VERSION,
  DEFAULT_QUIZ_POLICY,
  PAPER_QUESTION_KINDS,
  TRUE_FALSE_CHOICES,
  buildStudentQuiz,
  createAlternateForm,
  parseQuizDefinition,
  type AssessmentQuestion,
  type DeliveryMode,
  type QuestionKind,
  type QuizDefinition,
  type QuizForm,
  type QuizPolicy,
} from './assessmentModel';
import { buildPackage, type PackageManifestV2 } from './packageV2';
import type { QuizQuestion } from './types';

export interface QuizDraftInput {
  quizId: string;
  version: number;
  mode: DeliveryMode | null;
  title: string;
  gradeLevel: number;
  subject: string;
  questions: AssessmentQuestion[];
  policy: QuizPolicy;
  templateId: string;
  alternateForms: number;
  retainScanImages: boolean;
  masterKey: Record<string, { answer: string; acceptedAnswers: string[] }> | null;
  forms: QuizForm[] | null;
}

export const KINDS_FOR_MODE: Record<DeliveryMode, QuestionKind[]> = {
  paper_omr: [...PAPER_QUESTION_KINDS],
  digital_mini_quiz: ['multiple_choice', 'true_false', 'identification', 'fill_in_the_blank'],
};

export const KIND_LABELS: Record<QuestionKind, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  identification: 'Identification',
  fill_in_the_blank: 'Fill in the blank',
};

export function newQuestion(kind: QuestionKind, id: string, defaults: Partial<AssessmentQuestion> = {}): AssessmentQuestion {
  return {
    id,
    kind,
    prompt: kind === 'fill_in_the_blank' ? 'Complete the sentence: ___.' : '',
    choices: kind === 'multiple_choice' ? ['', '', '', ''] : kind === 'true_false' ? [...TRUE_FALSE_CHOICES] : [],
    answer: kind === 'true_false' ? 'True' : '',
    acceptedAnswers: [],
    rationale: '',
    topic: defaults.topic ?? '',
    competency: defaults.competency ?? '',
    difficulty: 'medium',
    points: 1,
    misconception: '',
    intervention: '',
    remediationRef: '',
    ...defaults,
  };
}

/** Converts a module's existing quiz question so it can be reused in a new assessment. */
export function questionFromModule(question: QuizQuestion, id: string, competency: string): AssessmentQuestion {
  const kind: QuestionKind =
    question.type === 'MULTIPLE_CHOICE'
      ? question.choices.length === 2 && question.choices.every((choice) => TRUE_FALSE_CHOICES.includes(choice as 'True'))
        ? 'true_false'
        : 'multiple_choice'
      : question.type === 'FILL_IN_THE_BLANK'
        ? 'fill_in_the_blank'
        : 'identification';
  const prompt = kind === 'fill_in_the_blank' && !/_{3,}/.test(question.questionText) ? `${question.questionText} ___` : question.questionText;
  return newQuestion(kind, id, {
    prompt,
    choices: kind === 'multiple_choice' ? question.choices.slice(0, 5) : kind === 'true_false' ? [...TRUE_FALSE_CHOICES] : [],
    answer: question.correctAnswer,
    topic: question.topicTag || 'General',
    competency: competency || 'Module competency',
  });
}

/** Validates the draft and freezes it into one immutable quiz version. */
export function buildQuizFromDraft(draft: QuizDraftInput, author: string, createdAt: string): QuizDefinition {
  if (!draft.mode) throw new Error('Choose Paper quiz or Digital mini-quiz first.');
  if (!draft.questions.length) throw new Error('Add at least one question.');
  const allowed = KINDS_FOR_MODE[draft.mode];
  const wrongKind = draft.questions.find((question) => !allowed.includes(question.kind));
  if (wrongKind) throw new Error(`Question "${wrongKind.prompt || wrongKind.id}" cannot be used in a ${draft.mode === 'paper_omr' ? 'paper quiz' : 'mini-quiz'}.`);
  const questions = draft.questions.map((question) => {
    const keyed = draft.masterKey?.[question.id];
    return keyed ? { ...question, answer: keyed.answer, acceptedAnswers: keyed.acceptedAnswers } : question;
  });
  const formA: QuizForm = { code: 'A', questionOrder: questions.map((question) => question.id), choiceOrders: {} };
  const alternates =
    draft.mode === 'paper_omr'
      ? draft.forms?.slice(1) ??
        Array.from({ length: Math.min(3, draft.alternateForms) }, (_, index) =>
          createAlternateForm({ questions }, (['B', 'C', 'D'] as const)[index]!, hashSeed(`${draft.quizId}@${draft.version}#${index}`)),
        )
      : [];
  return parseQuizDefinition({
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    quizId: draft.quizId,
    version: draft.version,
    mode: draft.mode,
    title: draft.title.trim(),
    gradeLevel: draft.gradeLevel,
    subject: draft.subject.trim(),
    author,
    createdAt,
    questions,
    forms: [formA, ...alternates],
    policy: draft.mode === 'digital_mini_quiz' ? draft.policy ?? DEFAULT_QUIZ_POLICY : null,
    paper: draft.mode === 'paper_omr' ? { templateId: draft.templateId, retainScanImages: draft.retainScanImages } : null,
  });
}

/** The student package for a digital mini-quiz authored on a teacher device. */
export function buildMiniQuizPackage(args: {
  quiz: QuizDefinition;
  author: { id: string; name: string };
  createdAt: string;
  signerSecretKeyHex?: string;
  studentToStudent?: boolean;
}): { archive: Uint8Array; manifest: PackageManifestV2 } {
  const studentQuiz = buildStudentQuiz(args.quiz);
  return buildPackage({
    manifest: {
      packageId: args.quiz.quizId,
      version: args.quiz.version,
      packageType: 'quiz',
      audience: 'student',
      title: args.quiz.title,
      author: args.author,
      source: 'pavo-android',
      gradeLevel: args.quiz.gradeLevel,
      subject: args.quiz.subject,
      competencies: [...new Set(args.quiz.questions.map((question) => question.competency))],
      assessment: {
        quizId: args.quiz.quizId,
        quizVersion: args.quiz.version,
        mode: args.quiz.mode,
        canonicalOrder: args.quiz.questions.map((question) => question.id),
        forms: [{ code: 'A', fingerprint: studentQuiz.fingerprint }],
      },
      createdAt: args.createdAt,
      attribution: { authors: [args.author.name], license: 'School-Internal', sourceUrl: null, notice: 'Teacher-authored mini-quiz.' },
      redistribution: { studentToStudent: args.studentToStudent ?? false, teacherToTeacher: true, expiresAt: null },
      provenance: null,
    },
    files: { 'quiz.json': strToU8(JSON.stringify(studentQuiz, null, 2)) },
    signerSecretKeyHex: args.signerSecretKeyHex,
  });
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
