import type { FrameIssue } from '../../src/domain/omr';

/**
 * PAVO OMR fixture suite v1. Every sheet is an original PAVO layout rendered
 * from the shared template geometry; transforms emulate phone photos.
 */
export const OMR_FIXTURE_VERSION = 1;

export type MarkStyle = 'solid' | 'pencil' | 'faint' | 'erasure' | 'check' | 'dot';

export interface OmrFixtureCase {
  name: string;
  templateId: 'pavo-std-20x4' | 'pavo-std-50x5';
  sheetCode: { templateId?: string; quizVersion?: number; studentId?: string | null };
  marks: Array<{ question: number; choice: number; style: MarkStyle }>;
  blank?: number[];
  classId: number[];
  transform: {
    rotate?: 0 | 90 | 180 | 270;
    tilt?: number;
    perspective?: number;
    scale?: number;
    shiftX?: number;
    lighting?: number;
    shadow?: number;
    glare?: boolean;
    blur?: number;
    noise?: number;
    jpegQuality?: number;
    occludeMarker?: 'BR';
    curl?: number;
  };
  expect: {
    located: boolean;
    inferredMarker?: boolean;
    issuesInclude?: FrameIssue[];
    ready?: boolean;
    sheetCode?: 'match' | 'unreadable-ok';
    sheetMismatch?: 'wrong_form' | 'wrong_version';
    classNumber?: number;
    /** Defaults to "every standard mark detected exactly". */
    questions?: Record<number, { state: 'marked' | 'blank' | 'multiple' | 'ambiguous' | 'not-marked'; choice?: number }>;
    allStandardMarks?: boolean;
  };
}

export const FIXTURE_QUIZ = { quizId: 'omr-fixture', quizVersion: 2, formCode: 'A' } as const;

/** Default answer per question: a fixed, varied pattern. */
export function standardChoice(question: number, choiceCount: number): number {
  return (question * 7 + 3) % choiceCount;
}

const solid = (questions: number, choiceCount: number) =>
  Array.from({ length: questions }, (_, index) => ({
    question: index + 1,
    choice: standardChoice(index + 1, choiceCount),
    style: 'solid' as MarkStyle,
  }));

const base = (name: string, transform: OmrFixtureCase['transform'], expect: OmrFixtureCase['expect']): OmrFixtureCase => ({
  name,
  templateId: 'pavo-std-20x4',
  sheetCode: {},
  marks: solid(20, 4),
  classId: [0, 1, 7],
  transform: { noise: 4, jpegQuality: 85, ...transform },
  expect: { allStandardMarks: true, ...expect },
});

const located = { located: true } as const;

export const OMR_FIXTURE_CASES: OmrFixtureCase[] = [
  base('clean-upright', {}, { ...located, ready: true, sheetCode: 'match', classNumber: 17 }),
  {
    ...base('clean-50x5', {}, { ...located, ready: true, sheetCode: 'match' }),
    templateId: 'pavo-std-50x5',
    marks: solid(50, 5),
  },
  base('rotated-90', { rotate: 90 }, { ...located, ready: true, sheetCode: 'match', classNumber: 17 }),
  base('rotated-180', { rotate: 180 }, { ...located, ready: true, sheetCode: 'match' }),
  base('rotated-270', { rotate: 270 }, { ...located, sheetCode: 'match' }),
  base('tilted-9deg', { tilt: 9 }, { ...located, ready: true, sheetCode: 'match' }),
  base('perspective-moderate', { perspective: 0.14 }, { ...located, ready: true, sheetCode: 'match' }),
  base('perspective-steep', { perspective: 0.36 }, { ...located, issuesInclude: ['perspective'] }),
  base('uneven-lighting', { lighting: 0.45 }, { ...located, sheetCode: 'match' }),
  base('shadow-band', { shadow: 0.5 }, { ...located }),
  base('shadow-heavy', { shadow: 0.78 }, { ...located, issuesInclude: ['shadow'], allStandardMarks: false }),
  base('blur-mild', { blur: 1.1 }, { ...located, ready: true }),
  base('blur-heavy', { blur: 6 }, { located: false, issuesInclude: ['blurred'], allStandardMarks: false }),
  base('glare-spot', { glare: true }, { ...located, issuesInclude: ['glare'], allStandardMarks: false }),
  base('curled-paper', { curl: 14 }, { ...located, issuesInclude: ['not_flat'], allStandardMarks: false }),
  base('far-away', { scale: 0.42 }, { ...located, issuesInclude: ['too_far'] }),
  base('marker-occluded', { occludeMarker: 'BR' }, { ...located, inferredMarker: true, issuesInclude: ['missing_marker'] }),
  base('off-frame', { shiftX: 0.55 }, { located: false, issuesInclude: ['outside_frame'], allStandardMarks: false }),
  {
    ...base('pencil-marks', {}, { ...located, ready: true }),
    marks: solid(20, 4).map((mark) => ({ ...mark, style: 'pencil' as MarkStyle })),
  },
  {
    ...base('faint-and-partial', {}, {
      ...located,
      allStandardMarks: false,
      questions: {
        1: { state: 'ambiguous' },
        2: { state: 'not-marked' },
        3: { state: 'not-marked' },
        4: { state: 'marked', choice: standardChoice(4, 4) },
      },
    }),
    marks: [
      { question: 1, choice: 1, style: 'faint' },
      { question: 2, choice: 2, style: 'dot' },
      { question: 3, choice: 0, style: 'check' },
      ...solid(20, 4).slice(3),
    ],
  },
  {
    ...base('erasure-and-change', {}, {
      ...located,
      allStandardMarks: false,
      questions: {
        1: { state: 'marked', choice: 2 },
        2: { state: 'not-marked' },
        3: { state: 'multiple' },
        4: { state: 'blank' },
      },
    }),
    marks: [
      { question: 1, choice: 0, style: 'erasure' },
      { question: 1, choice: 2, style: 'solid' },
      { question: 2, choice: 3, style: 'erasure' },
      { question: 3, choice: 1, style: 'solid' },
      { question: 3, choice: 3, style: 'solid' },
      ...solid(20, 4).slice(4),
    ],
    blank: [4],
  },
  {
    ...base('class-pack-prefilled', {}, { ...located, sheetCode: 'match', classNumber: 17 }),
    sheetCode: { studentId: 'student_ana' },
  },
  {
    ...base('wrong-form', {}, { ...located, sheetCode: 'match', sheetMismatch: 'wrong_form' }),
    sheetCode: { templateId: 'pavo-std-30x5' },
  },
  {
    ...base('wrong-version', {}, { ...located, sheetCode: 'match', sheetMismatch: 'wrong_version' }),
    sheetCode: { quizVersion: 1 },
  },
];
