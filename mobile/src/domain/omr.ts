import { z } from 'zod';
import {
  CHOICE_LABELS,
  formFor,
  gradeAnswer,
  stableIdSchema,
  summarizeItems,
  type ItemOutcome,
  type QuizDefinition,
  type ScoredAttempt,
} from './assessmentModel';

/* ── Answer-sheet templates ──────────────────────────────────────────── */

export const OMR_TEMPLATE_SCHEMA_VERSION = 1 as const;
export const OMR_LAYOUT_VERSION = 1;
export const SHEET_CODE_PREFIX = 'PVS1';

export interface Point {
  x: number;
  y: number;
}

/**
 * Geometry of a printable PAVO answer sheet, in PDF points with the origin at
 * the top-left of the page. The scanner warps a photo so the four marker
 * centers land on `markers.centers`, then samples every bubble center.
 */
export interface AnswerSheetTemplate {
  schemaVersion: typeof OMR_TEMPLATE_SCHEMA_VERSION;
  kind: 'pavo-answer-sheet-template';
  templateId: string;
  layoutVersion: number;
  title: string;
  page: { name: 'A4' | 'LETTER'; width: number; height: number };
  markers: { size: number; centers: [Point, Point, Point, Point] };
  orientationMarker: { size: number; center: Point };
  sheetCode: { x: number; y: number; size: number };
  bubbleRadius: number;
  questionCount: number;
  choiceCount: number;
  questions: Array<{ number: number; bubbles: Point[] }>;
  classIdDigits: number;
  classIdBubbleRadius: number;
  classIdBubbles: Point[][];
  answerArea: { top: number; bottom: number };
  instructionsTop: number;
}

const PAGES = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
} as const;

export const templateOptionsSchema = z.object({
  questionCount: z.number().int().min(1).max(100),
  choiceCount: z.number().int().min(2).max(5),
  classIdDigits: z.number().int().min(2).max(6).default(3),
  page: z.enum(['A4', 'LETTER']).default('A4'),
  templateId: stableIdSchema.optional(),
  title: z.string().trim().min(1).max(60).optional(),
});
export type TemplateOptions = z.input<typeof templateOptionsSchema>;

export const STANDARD_TEMPLATE_OPTIONS: Array<TemplateOptions & { templateId: string; title: string }> = [
  { templateId: 'pavo-std-20x4', title: 'Standard 20 questions, A–D', questionCount: 20, choiceCount: 4 },
  { templateId: 'pavo-std-30x5', title: 'Standard 30 questions, A–E', questionCount: 30, choiceCount: 5 },
  { templateId: 'pavo-std-50x5', title: 'Standard 50 questions, A–E', questionCount: 50, choiceCount: 5 },
  { templateId: 'pavo-std-100x5', title: 'Standard 100 questions, A–E', questionCount: 100, choiceCount: 5 },
];

const ROWS_PER_COLUMN = 25;
const MARKER = { size: 24, inset: 36 };

export function buildAnswerSheetTemplate(input: TemplateOptions): AnswerSheetTemplate {
  const options = templateOptionsSchema.parse(input);
  const page = { name: options.page, ...PAGES[options.page] };
  const { width, height } = page;
  const inset = MARKER.inset;
  const templateId =
    options.templateId ??
    `pavo-custom-${options.questionCount}x${options.choiceCount}-id${options.classIdDigits}${options.page === 'A4' ? '' : '-letter'}`;

  const answerTop = 236;
  const instructionsTop = height - 138;
  const columns = Math.ceil(options.questionCount / ROWS_PER_COLUMN);
  const rows = Math.min(ROWS_PER_COLUMN, options.questionCount);
  const rowHeight = Math.min(22, (instructionsTop - 14 - answerTop) / rows);
  const usableLeft = inset + 14;
  const usableWidth = width - 2 * usableLeft;
  const columnWidth = usableWidth / columns;
  const numberWidth = 26;
  const spacing = Math.min(24, Math.floor((columnWidth - numberWidth - 12) / options.choiceCount));
  const bubbleRadius = round(Math.min(7, spacing * 0.36, rowHeight * 0.36));
  const blockWidth = numberWidth + spacing * options.choiceCount;

  const questions = Array.from({ length: options.questionCount }, (_, index) => {
    const column = Math.floor(index / ROWS_PER_COLUMN);
    const row = index % ROWS_PER_COLUMN;
    const left = usableLeft + column * columnWidth + (columnWidth - blockWidth) / 2 + numberWidth;
    return {
      number: index + 1,
      bubbles: Array.from({ length: options.choiceCount }, (_, choice) => ({
        x: round(left + spacing * (choice + 0.5)),
        y: round(answerTop + rowHeight * (row + 0.5)),
      })),
    };
  });

  const classIdLeft = 300;
  const classIdTop = 84;
  const classIdBubbles = Array.from({ length: options.classIdDigits }, (_, digit) =>
    Array.from({ length: 10 }, (_, value) => ({
      x: round(classIdLeft + digit * 18),
      y: round(classIdTop + value * 12.5),
    })),
  );

  return {
    schemaVersion: OMR_TEMPLATE_SCHEMA_VERSION,
    kind: 'pavo-answer-sheet-template',
    templateId,
    layoutVersion: OMR_LAYOUT_VERSION,
    title:
      options.title ??
      `${options.questionCount} questions, A–${CHOICE_LABELS[options.choiceCount - 1]}`,
    page,
    markers: {
      size: MARKER.size,
      centers: [
        { x: inset, y: inset },
        { x: round(width - inset), y: inset },
        { x: round(width - inset), y: round(height - inset) },
        { x: inset, y: round(height - inset) },
      ],
    },
    orientationMarker: { size: 12, center: { x: inset + 34, y: inset } },
    sheetCode: { x: round(width - inset - 14 - 92), y: 64, size: 92 },
    bubbleRadius,
    questionCount: options.questionCount,
    choiceCount: options.choiceCount,
    questions,
    classIdDigits: options.classIdDigits,
    classIdBubbleRadius: 4.6,
    classIdBubbles,
    answerArea: { top: answerTop, bottom: round(answerTop + rowHeight * rows) },
    instructionsTop: round(instructionsTop),
  };
}

export function standardTemplate(templateId: string): AnswerSheetTemplate | null {
  const options = STANDARD_TEMPLATE_OPTIONS.find((candidate) => candidate.templateId === templateId);
  if (options) return buildAnswerSheetTemplate(options);
  const custom = /^pavo-custom-(\d+)x(\d)-id(\d)(-letter)?$/.exec(templateId);
  if (!custom) return null;
  const parsed = templateOptionsSchema.safeParse({
    questionCount: Number(custom[1]),
    choiceCount: Number(custom[2]),
    classIdDigits: Number(custom[3]),
    page: custom[4] ? 'LETTER' : 'A4',
  });
  return parsed.success ? buildAnswerSheetTemplate(parsed.data) : null;
}

/** Why a quiz cannot use a template, or null when it fits. */
export function templateFitIssue(
  quiz: Pick<QuizDefinition, 'questions'>,
  template: Pick<AnswerSheetTemplate, 'questionCount' | 'choiceCount'>,
): string | null {
  if (quiz.questions.length > template.questionCount) {
    return `This sheet has ${template.questionCount} rows; the quiz has ${quiz.questions.length} questions.`;
  }
  const widest = Math.max(...quiz.questions.map((question) => question.choices.length));
  if (widest > template.choiceCount) {
    return `This sheet offers ${template.choiceCount} choices; a question needs ${widest}.`;
  }
  return null;
}

/* ── Sheet identity code (printed QR) ────────────────────────────────── */

export interface SheetCode {
  templateId: string;
  layoutVersion: number;
  quizId: string;
  quizVersion: number;
  formCode: string;
  studentId: string | null;
}

export function encodeSheetCode(code: SheetCode): string {
  return [
    SHEET_CODE_PREFIX,
    code.templateId,
    code.layoutVersion,
    code.quizId,
    code.quizVersion,
    code.formCode,
    ...(code.studentId ? [code.studentId] : []),
  ].join(':');
}

export function parseSheetCode(text: string): SheetCode {
  const parts = text.trim().split(':');
  if (parts[0] !== SHEET_CODE_PREFIX || (parts.length !== 6 && parts.length !== 7)) {
    throw new Error('This is not a PAVO answer sheet.');
  }
  const [, templateId, layoutVersion, quizId, quizVersion, formCode, studentId] = parts;
  if (
    !stableIdSchema.safeParse(templateId).success ||
    !stableIdSchema.safeParse(quizId).success ||
    !/^\d{1,4}$/.test(layoutVersion ?? '') ||
    !/^\d{1,6}$/.test(quizVersion ?? '') ||
    !/^[A-D]$/.test(formCode ?? '') ||
    (studentId !== undefined && !/^[A-Za-z0-9._-]{1,80}$/.test(studentId))
  ) {
    throw new Error('The answer-sheet code is damaged.');
  }
  return {
    templateId: templateId!,
    layoutVersion: Number(layoutVersion),
    quizId: quizId!,
    quizVersion: Number(quizVersion),
    formCode: formCode!,
    studentId: studentId ?? null,
  };
}

export type SheetMismatch = 'wrong_form' | 'wrong_quiz' | 'wrong_version' | 'unknown_form_code';

export function sheetMismatch(
  sheet: SheetCode,
  expected: { quiz: Pick<QuizDefinition, 'quizId' | 'version' | 'forms'>; template: Pick<AnswerSheetTemplate, 'templateId' | 'layoutVersion'> },
): { code: SheetMismatch; message: string } | null {
  if (sheet.templateId !== expected.template.templateId || sheet.layoutVersion !== expected.template.layoutVersion) {
    return { code: 'wrong_form', message: `This paper uses answer sheet ${sheet.templateId}, not ${expected.template.templateId}.` };
  }
  if (sheet.quizId !== expected.quiz.quizId) {
    return { code: 'wrong_quiz', message: 'This answer sheet belongs to a different quiz.' };
  }
  if (sheet.quizVersion !== expected.quiz.version) {
    return {
      code: 'wrong_version',
      message: `This sheet was printed for version ${sheet.quizVersion}; the selected quiz is version ${expected.quiz.version}.`,
    };
  }
  if (!expected.quiz.forms.some((form) => form.code === sheet.formCode)) {
    return { code: 'unknown_form_code', message: `Form ${sheet.formCode} is not part of this quiz.` };
  }
  return null;
}

/* ── Frame quality (auto-capture gate) ───────────────────────────────── */

export interface FrameMetrics {
  markersFound: number;
  /** Marker quadrilateral area divided by frame area. */
  coverage: number;
  /** Any marker centre within 2% of the frame edge. */
  touchesEdge: boolean;
  /** Variance of the Laplacian on the sheet region. */
  sharpness: number;
  /** Fraction of sheet pixels at full brightness. */
  glare: number;
  /** Ratio of shortest to longest opposite edge pair (1 = square-on). */
  perspective: number;
  /** Largest offset (points) between printed bubble outlines and the flat-sheet model. */
  gridDrift: number;
  /** Ratio of darkest to brightest paper-region median (1 = even light). */
  lightingEvenness: number;
}

export type FrameIssue =
  | 'missing_marker'
  | 'outside_frame'
  | 'too_far'
  | 'blurred'
  | 'glare'
  | 'perspective'
  | 'not_flat'
  | 'shadow';

export const FRAME_LIMITS = {
  minCoverage: 0.3,
  minSharpness: 60,
  maxGlare: 0.04,
  minPerspective: 0.72,
  maxGridDrift: 3,
  minLightingEvenness: 0.45,
} as const;

export function assessFrame(metrics: FrameMetrics): { ready: boolean; issues: FrameIssue[] } {
  const issues: FrameIssue[] = [];
  if (metrics.markersFound < 4) issues.push(metrics.markersFound === 0 ? 'outside_frame' : 'missing_marker');
  if (metrics.touchesEdge) issues.push('outside_frame');
  if (metrics.markersFound >= 3 && metrics.coverage < FRAME_LIMITS.minCoverage) issues.push('too_far');
  if (metrics.sharpness < FRAME_LIMITS.minSharpness) issues.push('blurred');
  if (metrics.glare > FRAME_LIMITS.maxGlare) issues.push('glare');
  if (metrics.perspective < FRAME_LIMITS.minPerspective) issues.push('perspective');
  if (metrics.gridDrift > FRAME_LIMITS.maxGridDrift) issues.push('not_flat');
  if (metrics.lightingEvenness < FRAME_LIMITS.minLightingEvenness) issues.push('shadow');
  return { ready: issues.length === 0, issues: [...new Set(issues)] };
}

export const FRAME_ISSUE_MESSAGES: Record<FrameIssue, string> = {
  missing_marker: 'One corner marker is hidden or damaged. Show all four black squares.',
  outside_frame: 'Fit the whole sheet inside the frame.',
  too_far: 'Move closer so the sheet fills the guides.',
  blurred: 'Hold steady — the image is blurred.',
  glare: 'Tilt away from the light to remove glare.',
  perspective: 'Hold the phone straight above the sheet.',
  not_flat: 'Flatten the paper; it looks folded or curved.',
  shadow: 'Move out of the shadow or add light.',
};

/** Auto-capture once enough consecutive ready frames keep the markers still. */
export function isStable(
  history: Array<{ ready: boolean; markers: Point[] }>,
  options = { frames: 3, maxDrift: 0.012 },
): boolean {
  const recent = history.slice(-options.frames);
  if (recent.length < options.frames || recent.some((frame) => !frame.ready || frame.markers.length !== 4)) {
    return false;
  }
  const first = recent[0]!.markers;
  return recent.every((frame) =>
    frame.markers.every(
      (marker, index) => Math.hypot(marker.x - first[index]!.x, marker.y - first[index]!.y) <= options.maxDrift,
    ),
  );
}

/** What the native OpenCV engine returns for one photo. */
export const omrAnalysisSchema = z.object({
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  located: z.boolean(),
  markersFound: z.number().int().min(0).max(4),
  inferredMarker: z.boolean(),
  orientationFound: z.boolean(),
  corners: z.array(z.object({ x: z.number(), y: z.number() })).max(4),
  rotationDegrees: z.number(),
  metrics: z.object({
    markersFound: z.number().int().min(0).max(4),
    coverage: z.number(),
    touchesEdge: z.boolean(),
    sharpness: z.number(),
    glare: z.number(),
    perspective: z.number(),
    gridDrift: z.number(),
    lightingEvenness: z.number(),
  }),
  sheetCode: z.string().max(400).nullable(),
  bubbleFill: z.array(z.array(z.number().min(0).max(1)).max(5)).max(100),
  classIdFill: z.array(z.array(z.number().min(0).max(1)).max(10)).max(6),
  rowOffsets: z.array(z.object({ x: z.number(), y: z.number() })),
  warpedImageUri: z.string().nullable().optional(),
});
export type OmrAnalysis = z.infer<typeof omrAnalysisSchema>;

/** Frame issues plus warnings that only a full analysis can reveal. */
export function analysisIssues(analysis: OmrAnalysis): FrameIssue[] {
  if (!analysis.located) {
    const issues: FrameIssue[] = [analysis.markersFound < 3 ? 'outside_frame' : 'missing_marker'];
    if (analysis.metrics.sharpness < FRAME_LIMITS.minSharpness) issues.push('blurred');
    return issues;
  }
  return assessFrame(analysis.metrics).issues;
}

/* ── Bubble classification ───────────────────────────────────────────── */

export type DetectionState = 'marked' | 'blank' | 'multiple' | 'ambiguous';
export type DetectionReason =
  | 'faint_mark'
  | 'erasure_residue'
  | 'multiple_marks'
  | 'low_contrast'
  | 'teacher_corrected';

export interface QuestionDetection {
  number: number;
  state: DetectionState;
  /** Selected bubble index on the printed sheet (0 = A), when single. */
  choice: number | null;
  marked: number[];
  fills: number[];
  confidence: number;
  reasons: DetectionReason[];
  needsReview: boolean;
}

export const OMR_THRESHOLDS = {
  marked: 0.62,
  faint: 0.2,
  separation: 0.3,
  reviewConfidence: 0.6,
  maxBaseline: 0.25,
} as const;

/**
 * Classifies measured fill ratios (0 = clean paper, 1 = fully dark inner
 * circle). Fills are relative to the sheet's blank-bubble baseline so uneven
 * toner or light shifts the threshold rather than every decision.
 */
export function classifyBubbles(fills: number[][]): {
  detections: QuestionDetection[];
  baseline: number;
  lowContrast: boolean;
} {
  const all = fills.flat().filter(Number.isFinite).sort((a, b) => a - b);
  const median = all.length ? all[Math.floor(all.length / 2)]! : 0;
  const lowContrast = median > OMR_THRESHOLDS.maxBaseline;
  const baseline = Math.min(median, OMR_THRESHOLDS.maxBaseline);
  return {
    baseline,
    lowContrast,
    detections: fills.map((row, index) => classifyRow(index + 1, row, baseline, lowContrast)),
  };
}

function classifyRow(number: number, raw: number[], baseline: number, lowContrast: boolean): QuestionDetection {
  const fills = raw.map((fill) => round(Math.max(0, (Number.isFinite(fill) ? fill : 0) - baseline)));
  const strong = indicesWhere(fills, (fill) => fill >= OMR_THRESHOLDS.marked);
  const weak = indicesWhere(fills, (fill) => fill >= OMR_THRESHOLDS.faint && fill < OMR_THRESHOLDS.marked);
  const sorted = [...fills].sort((a, b) => b - a);
  const [top = 0, second = 0] = sorted;
  const reasons: DetectionReason[] = lowContrast ? ['low_contrast'] : [];
  const result = (state: DetectionState, choice: number | null, marked: number[], confidence: number): QuestionDetection => {
    const bounded = round(Math.max(0, Math.min(1, confidence)));
    return {
      number,
      state,
      choice,
      marked,
      fills,
      confidence: bounded,
      reasons,
      needsReview: state === 'ambiguous' || state === 'multiple' || bounded < OMR_THRESHOLDS.reviewConfidence || lowContrast,
    };
  };

  if (strong.length >= 2) {
    reasons.push('multiple_marks');
    return result('multiple', null, strong, 1 - (top - second));
  }
  if (strong.length === 1) {
    const choice = strong[0]!;
    if (weak.length) {
      reasons.push('erasure_residue');
      const separation = top - second;
      if (separation < OMR_THRESHOLDS.separation) return result('ambiguous', null, [choice, ...weak], separation);
      return result('marked', choice, [choice], separation / 0.5);
    }
    return result('marked', choice, [choice], (top - second) / 0.4);
  }
  if (weak.length) {
    reasons.push('faint_mark');
    return result('ambiguous', null, weak, 0.3);
  }
  return result('blank', null, [], 1 - top / OMR_THRESHOLDS.faint);
}

export interface ClassIdReading {
  digits: string | null;
  classNumber: number | null;
  readable: boolean;
}

/** Reads the shaded class number; each digit column needs one clean mark. */
export function readClassId(fills: number[][], baseline: number): ClassIdReading {
  if (!fills.length) return { digits: null, classNumber: null, readable: false };
  const columns = fills.map((column, index) => classifyRow(index + 1, column, baseline, false));
  if (columns.every((column) => column.state === 'blank')) return { digits: null, classNumber: null, readable: true };
  if (columns.some((column) => column.state !== 'marked' && column.state !== 'blank')) {
    return { digits: null, classNumber: null, readable: false };
  }
  const digits = columns.map((column) => (column.state === 'blank' ? '0' : String(column.choice))).join('');
  return { digits, classNumber: Number(digits) || null, readable: Number(digits) > 0 };
}

/* ── Teacher review and audit ────────────────────────────────────────── */

export interface CorrectionEvent {
  scanId: string;
  questionNumber: number;
  original: { state: DetectionState; choice: number | null };
  corrected: { state: Exclude<DetectionState, 'ambiguous'>; choice: number | null };
  at: string;
  teacherId: string;
}

export function applyCorrection(
  detections: QuestionDetection[],
  args: {
    scanId: string;
    questionNumber: number;
    corrected: CorrectionEvent['corrected'];
    teacherId: string;
    at: string;
  },
): { detections: QuestionDetection[]; event: CorrectionEvent } {
  const target = detections.find((detection) => detection.number === args.questionNumber);
  if (!target) throw new Error(`Question ${args.questionNumber} is not on this sheet.`);
  if ((args.corrected.state === 'marked') !== (args.corrected.choice !== null)) {
    throw new Error('A marked answer needs exactly one choice; other states have none.');
  }
  if (!args.teacherId) throw new Error('Corrections must record the teacher.');
  const event: CorrectionEvent = {
    scanId: args.scanId,
    questionNumber: args.questionNumber,
    original: { state: target.state, choice: target.choice },
    corrected: args.corrected,
    at: args.at,
    teacherId: args.teacherId,
  };
  return {
    event,
    detections: detections.map((detection) =>
      detection.number === args.questionNumber
        ? {
            ...detection,
            state: args.corrected.state,
            choice: args.corrected.choice,
            marked: args.corrected.choice === null ? (args.corrected.state === 'multiple' ? detection.marked : []) : [args.corrected.choice],
            confidence: 1,
            reasons: [...detection.reasons.filter((reason) => reason !== 'teacher_corrected'), 'teacher_corrected'],
            needsReview: false,
          }
        : detection,
    ),
  };
}

export function pendingReview(detections: QuestionDetection[], questionCount: number): number[] {
  return detections
    .filter((detection) => detection.number <= questionCount && detection.needsReview)
    .map((detection) => detection.number);
}

/* ── Grading ─────────────────────────────────────────────────────────── */

export interface PaperGradedItem {
  position: number;
  questionId: string;
  outcome: ItemOutcome;
  detected: DetectionState;
  sheetChoice: number | null;
  /** Canonical choice index after undoing this form's choice shuffle. */
  selectedChoice: number | null;
}

/** Grades detections with the form's own answer mapping. Requires review to be complete. */
export function gradePaperSheet(
  quiz: Pick<QuizDefinition, 'forms' | 'questions'>,
  formCode: string,
  detections: QuestionDetection[],
): { items: PaperGradedItem[]; scored: ScoredAttempt } {
  const form = formFor(quiz, formCode);
  const pending = pendingReview(detections, form.questionOrder.length);
  if (pending.length) throw new Error(`Review question${pending.length === 1 ? '' : 's'} ${pending.join(', ')} first.`);
  const byId = new Map(quiz.questions.map((question) => [question.id, question]));
  const items = form.questionOrder.map((questionId, index): PaperGradedItem => {
    const question = byId.get(questionId)!;
    const detection = detections.find((candidate) => candidate.number === index + 1);
    const order = form.choiceOrders[questionId] ?? question.choices.map((_, choice) => choice);
    const sheetChoice = detection?.state === 'marked' ? detection.choice : null;
    const selectedChoice = sheetChoice !== null ? (order[sheetChoice] ?? null) : null;
    let outcome: ItemOutcome;
    if (!detection || detection.state === 'blank') outcome = 'unanswered';
    else if (detection.state === 'multiple' || selectedChoice === null) outcome = 'incorrect';
    else outcome = gradeAnswer(question, question.choices[selectedChoice]);
    return {
      position: index + 1,
      questionId,
      outcome,
      detected: detection?.state ?? 'blank',
      sheetChoice,
      selectedChoice,
    };
  });
  return {
    items,
    scored: summarizeItems(
      items.map((item) => {
        const points = byId.get(item.questionId)!.points;
        return {
          position: item.position,
          questionId: item.questionId,
          outcome: item.outcome,
          pointsEarned: item.outcome === 'correct' ? points : 0,
          pointsPossible: points,
        };
      }),
    ),
  };
}

/** Builds an answer key from a correctly completed master sheet. */
export function answerKeyFromMasterSheet(
  quiz: Pick<QuizDefinition, 'forms' | 'questions'>,
  formCode: string,
  detections: QuestionDetection[],
): Record<string, { answer: string; acceptedAnswers: string[] }> {
  const form = formFor(quiz, formCode);
  const byId = new Map(quiz.questions.map((question) => [question.id, question]));
  const problems: number[] = [];
  const key: Record<string, { answer: string; acceptedAnswers: string[] }> = {};
  form.questionOrder.forEach((questionId, index) => {
    const question = byId.get(questionId)!;
    const detection = detections.find((candidate) => candidate.number === index + 1);
    const order = form.choiceOrders[questionId] ?? question.choices.map((_, choice) => choice);
    const sheetChoices =
      detection?.state === 'marked' ? [detection.choice!] : detection?.state === 'multiple' ? detection.marked : [];
    const texts = sheetChoices.map((choice) => question.choices[order[choice] ?? -1]);
    if (!texts.length || texts.some((textValue) => textValue === undefined) || detection?.needsReview) {
      problems.push(index + 1);
      return;
    }
    key[questionId] = { answer: texts[0]!, acceptedAnswers: texts.slice(1) as string[] };
  });
  if (problems.length) {
    throw new Error(`The master sheet needs one clear mark on question${problems.length === 1 ? '' : 's'} ${problems.join(', ')}.`);
  }
  return key;
}

export function paperDuplicateKey(args: { quizId: string; quizVersion: number; studentId: string }): string {
  return `${args.quizId}@${args.quizVersion}:${args.studentId}`;
}

/** Scan images are kept only when the teacher opted in for this quiz. */
export function shouldRetainScanImage(
  paper: QuizDefinition['paper'],
  teacherDefault = false,
): boolean {
  return paper?.retainScanImages ?? teacherDefault;
}

function indicesWhere(values: number[], predicate: (value: number) => boolean): number[] {
  return values.flatMap((value, index) => (predicate(value) ? [index] : []));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
