import {
  DEFAULT_QUIZ_POLICY,
  createAlternateForm,
  parseQuizDefinition,
  type AssessmentQuestionInput,
  type QuizDefinition,
} from '../../src/domain/assessmentModel';

const base = {
  rationale: 'Explained in the lesson.',
  difficulty: 'medium' as const,
  points: 1,
  misconception: '',
  intervention: '',
  remediationRef: '',
};

export const plantQuestions: AssessmentQuestionInput[] = [
  {
    ...base,
    id: 'q-leaf',
    kind: 'multiple_choice',
    prompt: 'Which plant part makes food?',
    choices: ['Root', 'Leaf', 'Stem', 'Flower'],
    answer: 'Leaf',
    topic: 'Plant parts',
    competency: 'S5LT-IIa-1',
    misconception: 'Thinks roots make food because they absorb nutrients.',
    intervention: 'Contrast absorbing water with making glucose.',
    remediationRef: 'adaptive-lesson#photosynthesis',
  },
  {
    ...base,
    id: 'q-sun',
    kind: 'true_false',
    prompt: 'Plants need sunlight to make food.',
    choices: ['True', 'False'],
    answer: 'True',
    topic: 'Photosynthesis',
    competency: 'S5LT-IIa-2',
  },
  {
    ...base,
    id: 'q-gas',
    kind: 'identification',
    prompt: 'Name the gas plants take in for photosynthesis.',
    choices: [],
    answer: 'Carbon dioxide',
    acceptedAnswers: ['CO2'],
    topic: 'Photosynthesis',
    competency: 'S5LT-IIa-2',
    points: 2,
    misconception: 'Confuses oxygen intake with carbon dioxide intake.',
  },
  {
    ...base,
    id: 'q-blank',
    kind: 'fill_in_the_blank',
    prompt: 'The green pigment in leaves is ___.',
    choices: [],
    answer: 'chlorophyll',
    topic: 'Plant parts',
    competency: 'S5LT-IIa-1',
  },
];

export function digitalQuiz(overrides: Partial<QuizDefinition> = {}): QuizDefinition {
  return parseQuizDefinition({
    schemaVersion: 1,
    quizId: 'plants-check',
    version: 1,
    mode: 'digital_mini_quiz',
    title: 'Plants check',
    gradeLevel: 5,
    subject: 'Science',
    author: 'teacher:demo',
    createdAt: '2026-10-04T08:00:00.000Z',
    questions: plantQuestions,
    forms: [{ code: 'A', questionOrder: plantQuestions.map((q) => q.id), choiceOrders: {} }],
    policy: DEFAULT_QUIZ_POLICY,
    paper: null,
    ...overrides,
  });
}

export function paperQuiz(): QuizDefinition {
  const questions = Array.from({ length: 10 }, (_, index): AssessmentQuestionInput => ({
    ...base,
    id: `p${index + 1}`,
    kind: index % 4 === 3 ? 'true_false' : 'multiple_choice',
    prompt: `Paper question ${index + 1}`,
    choices: index % 4 === 3 ? ['True', 'False'] : ['Alpha', 'Beta', 'Gamma', 'Delta'],
    answer: index % 4 === 3 ? 'False' : ['Alpha', 'Beta', 'Gamma', 'Delta'][index % 4]!,
    topic: index < 5 ? 'Fractions' : 'Decimals',
    competency: index < 5 ? 'M5NS-Ia' : 'M5NS-Ib',
    misconception: index === 1 ? 'Adds denominators.' : '',
  }));
  const draft = {
    schemaVersion: 1 as const,
    quizId: 'paper-fractions',
    version: 2,
    mode: 'paper_omr' as const,
    title: 'Fractions paper quiz',
    gradeLevel: 5,
    subject: 'Math',
    author: 'teacher:demo',
    createdAt: '2026-10-04T08:00:00.000Z',
    questions,
    forms: [{ code: 'A', questionOrder: questions.map((q) => q.id), choiceOrders: {} }],
    policy: null,
    paper: { templateId: 'pavo-std-20x4', retainScanImages: false },
  };
  const parsed = parseQuizDefinition(draft);
  return parseQuizDefinition({
    ...draft,
    forms: [...parsed.forms, createAlternateForm(parsed, 'B', 42)],
  });
}
