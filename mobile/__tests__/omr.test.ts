import { describe, expect, it } from '@jest/globals';
import { PDFDocument } from 'pdf-lib';
import {
  STANDARD_TEMPLATE_OPTIONS,
  answerKeyFromMasterSheet,
  applyCorrection,
  assessFrame,
  buildAnswerSheetTemplate,
  classifyBubbles,
  encodeSheetCode,
  gradePaperSheet,
  isStable,
  paperDuplicateKey,
  parseSheetCode,
  pendingReview,
  readClassId,
  sheetMismatch,
  shouldRetainScanImage,
  standardTemplate,
  templateFitIssue,
  type FrameMetrics,
} from '../src/domain/omr';
import { renderAnswerSheetPdf, renderQuizPaperPdf } from '../src/domain/paperPdf';
import { questionsForForm } from '../src/domain/assessmentModel';
import { paperQuiz } from './fixtures/quizzes';

const BLANK = 0.03;
const FULL = 0.92;

/** Fill ratios for a sheet where `answers[i]` is the shaded sheet choice for question i+1. */
function sheetFills(answers: Array<number | null>, choiceCount = 4): number[][] {
  return answers.map((answer) =>
    Array.from({ length: choiceCount }, (_, choice) => (choice === answer ? FULL : BLANK)),
  );
}

describe('answer-sheet templates', () => {
  it('generates every standard template inside the marker rectangle without overlaps', () => {
    for (const options of STANDARD_TEMPLATE_OPTIONS) {
      const template = buildAnswerSheetTemplate(options);
      const [topLeft, , bottomRight] = template.markers.centers;
      const bubbles = template.questions.flatMap((question) => question.bubbles);
      expect(template.questions).toHaveLength(options.questionCount);
      for (const bubble of bubbles) {
        expect(bubble.x - template.bubbleRadius).toBeGreaterThan(topLeft.x + template.markers.size / 2);
        expect(bubble.x + template.bubbleRadius).toBeLessThan(bottomRight.x - template.markers.size / 2);
        expect(bubble.y).toBeGreaterThan(template.answerArea.top);
        expect(bubble.y).toBeLessThan(template.instructionsTop);
      }
      const minimumGap = Math.min(
        ...template.questions.flatMap((question) =>
          question.bubbles.slice(1).map((bubble, index) => bubble.x - question.bubbles[index]!.x),
        ),
        ...template.questions.flatMap((question, index) => {
          const next = template.questions[index + 1];
          return next && (index + 1) % 25 !== 0 ? [next.bubbles[0]!.y - question.bubbles[0]!.y] : [];
        }),
      );
      expect(minimumGap).toBeGreaterThan(template.bubbleRadius * 2 + 2);
    }
  });

  it('is deterministic and recoverable from its ID, including custom layouts', () => {
    expect(standardTemplate('pavo-std-50x5')).toEqual(buildAnswerSheetTemplate(STANDARD_TEMPLATE_OPTIONS[2]!));
    const custom = buildAnswerSheetTemplate({ questionCount: 15, choiceCount: 3, classIdDigits: 2 });
    expect(custom.templateId).toBe('pavo-custom-15x3-id2');
    expect(standardTemplate(custom.templateId)).toEqual(custom);
    expect(standardTemplate('zipgrade-50')).toBeNull();
  });

  it('places the orientation marker only beside the top-left marker', () => {
    const template = buildAnswerSheetTemplate({ questionCount: 20, choiceCount: 4 });
    const distances = template.markers.centers.map((center) =>
      Math.hypot(center.x - template.orientationMarker.center.x, center.y - template.orientationMarker.center.y),
    );
    expect(distances.indexOf(Math.min(...distances))).toBe(0);
    expect(Math.min(...distances)).toBeLessThan(40);
  });

  it('checks that a quiz fits a template', () => {
    const quiz = paperQuiz();
    expect(templateFitIssue(quiz, standardTemplate('pavo-std-20x4')!)).toBeNull();
    expect(templateFitIssue(quiz, buildAnswerSheetTemplate({ questionCount: 5, choiceCount: 4 }))).toContain('5 rows');
    expect(templateFitIssue(quiz, buildAnswerSheetTemplate({ questionCount: 20, choiceCount: 3 }))).toContain('3 choices');
  });
});

describe('sheet identity code', () => {
  const code = {
    templateId: 'pavo-std-20x4',
    layoutVersion: 1,
    quizId: 'paper-fractions',
    quizVersion: 2,
    formCode: 'B',
    studentId: 'student_ana',
  };

  it('round-trips and rejects foreign codes', () => {
    expect(parseSheetCode(encodeSheetCode(code))).toEqual(code);
    expect(parseSheetCode(encodeSheetCode({ ...code, studentId: null })).studentId).toBeNull();
    expect(() => parseSheetCode('ZG:50:1')).toThrow('not a PAVO answer sheet');
    expect(() => parseSheetCode('PVS1:pavo-std-20x4:1:quiz:x:A')).toThrow('damaged');
  });

  it('rejects wrong forms, quizzes, and versions', () => {
    const quiz = paperQuiz();
    const template = standardTemplate('pavo-std-20x4')!;
    expect(sheetMismatch(code, { quiz, template })).toBeNull();
    expect(sheetMismatch({ ...code, templateId: 'pavo-std-50x5' }, { quiz, template })?.code).toBe('wrong_form');
    expect(sheetMismatch({ ...code, quizId: 'other' }, { quiz, template })?.code).toBe('wrong_quiz');
    expect(sheetMismatch({ ...code, quizVersion: 1 }, { quiz, template })?.code).toBe('wrong_version');
    expect(sheetMismatch({ ...code, formCode: 'C' }, { quiz, template })?.code).toBe('unknown_form_code');
  });
});

describe('frame gating', () => {
  const good: FrameMetrics = {
    markersFound: 4,
    coverage: 0.55,
    touchesEdge: false,
    sharpness: 180,
    glare: 0.005,
    perspective: 0.9,
    cornerSkew: 3,
    lightingEvenness: 0.8,
  };

  it('only allows capture for a framed, sharp, flat, evenly lit sheet', () => {
    expect(assessFrame(good)).toEqual({ ready: true, issues: [] });
    expect(assessFrame({ ...good, markersFound: 3 }).issues).toEqual(['missing_marker']);
    expect(assessFrame({ ...good, markersFound: 0, coverage: 0 }).issues).toContain('outside_frame');
    expect(assessFrame({ ...good, sharpness: 20 }).issues).toEqual(['blurred']);
    expect(assessFrame({ ...good, glare: 0.2 }).issues).toEqual(['glare']);
    expect(assessFrame({ ...good, perspective: 0.5 }).issues).toEqual(['perspective']);
    expect(assessFrame({ ...good, cornerSkew: 20 }).issues).toEqual(['not_flat']);
    expect(assessFrame({ ...good, lightingEvenness: 0.2 }).issues).toEqual(['shadow']);
  });

  it('waits for consecutive still frames before auto-capture', () => {
    const markers = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }];
    const moved = markers.map((marker) => ({ x: marker.x + 0.05, y: marker.y }));
    expect(isStable([{ ready: true, markers }, { ready: true, markers }])).toBe(false);
    expect(isStable([{ ready: true, markers }, { ready: true, markers }, { ready: true, markers }])).toBe(true);
    expect(isStable([{ ready: true, markers }, { ready: true, markers: moved }, { ready: true, markers }])).toBe(false);
    expect(isStable([{ ready: true, markers }, { ready: false, markers }, { ready: true, markers }])).toBe(false);
  });
});

describe('bubble classification', () => {
  it('distinguishes marked, blank, multiple, erased, and ambiguous rows', () => {
    const { detections, lowContrast } = classifyBubbles([
      [BLANK, FULL, BLANK, BLANK],
      [BLANK, BLANK, BLANK, BLANK],
      [FULL, BLANK, FULL, BLANK],
      [0.3, BLANK, BLANK, FULL],
      [BLANK, 0.32, BLANK, BLANK],
      [BLANK, 0.62, 0.48, BLANK],
      [BLANK, BLANK, 0.6, BLANK],
      ...sheetFills([0, 1, 2, 3, 0, 1]),
    ]);
    expect(lowContrast).toBe(false);
    const summary = detections.slice(0, 7).map((detection) => [detection.state, detection.choice, detection.needsReview]);
    expect(summary).toEqual([
      ['marked', 1, false],
      ['blank', null, false],
      ['multiple', null, true],
      ['marked', 3, false],
      ['ambiguous', null, true],
      ['ambiguous', null, true],
      ['marked', 2, false],
    ]);
    expect(detections[3]?.reasons).toContain('erasure_residue');
    expect(detections[4]?.reasons).toContain('faint_mark');
  });

  it('adapts to a grey paper baseline and flags low contrast', () => {
    const grey = classifyBubbles(sheetFills([1, 2, null, 0]).map((row) => row.map((fill) => fill + 0.12)));
    expect(grey.detections.map((detection) => detection.choice)).toEqual([1, 2, null, 0]);
    const dark = classifyBubbles(sheetFills([1, 2]).map((row) => row.map(() => 0.6)));
    expect(dark.lowContrast).toBe(true);
    expect(dark.detections.every((detection) => detection.needsReview)).toBe(true);
  });

  it('reads a shaded class number and refuses unreadable ones', () => {
    const digitColumn = (digit: number | null) => Array.from({ length: 10 }, (_, value) => (value === digit ? FULL : BLANK));
    expect(readClassId([digitColumn(0), digitColumn(1), digitColumn(7)], BLANK)).toEqual({
      digits: '017',
      classNumber: 17,
      readable: true,
    });
    expect(readClassId([digitColumn(null), digitColumn(null)], BLANK)).toEqual({ digits: null, classNumber: null, readable: true });
    const doubled = digitColumn(2);
    doubled[5] = FULL;
    expect(readClassId([digitColumn(0), doubled], BLANK).readable).toBe(false);
  });
});

describe('paper grading', () => {
  const quiz = paperQuiz();

  it('grades each alternate form against its own answer mapping', () => {
    for (const formCode of ['A', 'B']) {
      const shaded = questionsForForm(quiz, formCode).map(({ question, displayChoices }) =>
        displayChoices.indexOf(question.answer),
      );
      const { detections } = classifyBubbles(sheetFills(shaded));
      const graded = gradePaperSheet(quiz, formCode, detections);
      expect(graded.scored.percent).toBe(100);
      expect(graded.items.every((item) => item.selectedChoice === quiz.questions.find((q) => q.id === item.questionId)!.choices.indexOf(quiz.questions.find((q) => q.id === item.questionId)!.answer))).toBe(true);
    }
    const formAKeyOnFormB = questionsForForm(quiz, 'A').map(({ question, displayChoices }) => displayChoices.indexOf(question.answer));
    const crossed = gradePaperSheet(quiz, 'B', classifyBubbles(sheetFills(formAKeyOnFormB)).detections);
    expect(crossed.scored.percent).toBeLessThan(100);
  });

  it('treats blanks as unanswered and multiples as incorrect after review', () => {
    const shaded: Array<number | null> = questionsForForm(quiz, 'A').map(({ question, displayChoices }) => displayChoices.indexOf(question.answer));
    shaded[0] = null;
    let { detections } = classifyBubbles(sheetFills(shaded));
    detections = detections.map((detection) =>
      detection.number === 2 ? { ...detection, state: 'multiple' as const, choice: null, marked: [0, 1], needsReview: true } : detection,
    );
    expect(() => gradePaperSheet(quiz, 'A', detections)).toThrow('Review question 2');
    const reviewed = applyCorrection(detections, {
      scanId: 'scan-1',
      questionNumber: 2,
      corrected: { state: 'multiple', choice: null },
      teacherId: 'teacher_demo',
      at: '2026-10-04T09:00:00.000Z',
    });
    const graded = gradePaperSheet(quiz, 'A', reviewed.detections);
    expect(graded.items[0]?.outcome).toBe('unanswered');
    expect(graded.items[1]?.outcome).toBe('incorrect');
    expect(graded.scored.correctCount).toBe(8);
  });

  it('records every teacher correction as an audit event', () => {
    const { detections } = classifyBubbles([[BLANK, 0.33, BLANK, BLANK], ...sheetFills([0, 1])]);
    expect(pendingReview(detections, 3)).toEqual([1]);
    const { event, detections: corrected } = applyCorrection(detections, {
      scanId: 'scan-9',
      questionNumber: 1,
      corrected: { state: 'marked', choice: 1 },
      teacherId: 'teacher_demo',
      at: '2026-10-04T09:30:00.000Z',
    });
    expect(event).toEqual({
      scanId: 'scan-9',
      questionNumber: 1,
      original: { state: 'ambiguous', choice: null },
      corrected: { state: 'marked', choice: 1 },
      at: '2026-10-04T09:30:00.000Z',
      teacherId: 'teacher_demo',
    });
    expect(corrected[0]).toMatchObject({ state: 'marked', choice: 1, needsReview: false });
    expect(corrected[0]?.reasons).toContain('teacher_corrected');
    expect(() =>
      applyCorrection(detections, { scanId: 's', questionNumber: 1, corrected: { state: 'marked', choice: null }, teacherId: 't', at: 'x' }),
    ).toThrow('exactly one choice');
  });

  it('builds an answer key from a master sheet, including alternate answers', () => {
    const shaded = questionsForForm(quiz, 'B').map(({ question, displayChoices }) => displayChoices.indexOf(question.answer));
    const fills = sheetFills(shaded);
    const second = questionsForForm(quiz, 'B')[0]!;
    const alternateIndex = second.displayChoices.findIndex((choice) => choice !== second.question.answer);
    fills[0]![alternateIndex] = FULL;
    const key = answerKeyFromMasterSheet(quiz, 'B', classifyBubbles(fills).detections.map((detection) => ({ ...detection, needsReview: false })));
    const entry = key[second.question.id]!;
    expect([entry.answer, ...entry.acceptedAnswers].sort()).toEqual(
      [second.question.answer, second.displayChoices[alternateIndex]!].sort(),
    );
    for (const question of quiz.questions) {
      if (question.id !== second.question.id) expect(key[question.id]?.answer).toBe(question.answer);
    }
    const blank = sheetFills(shaded);
    blank[3] = [BLANK, BLANK, BLANK, BLANK];
    expect(() => answerKeyFromMasterSheet(quiz, 'B', classifyBubbles(blank).detections)).toThrow('question 4');
  });

  it('detects duplicate papers and honours image retention', () => {
    const key = paperDuplicateKey({ quizId: 'paper-fractions', quizVersion: 2, studentId: 'student_ana' });
    expect(key).toBe(paperDuplicateKey({ quizId: 'paper-fractions', quizVersion: 2, studentId: 'student_ana' }));
    expect(key).not.toBe(paperDuplicateKey({ quizId: 'paper-fractions', quizVersion: 3, studentId: 'student_ana' }));
    expect(shouldRetainScanImage(quiz.paper)).toBe(false);
    expect(shouldRetainScanImage({ templateId: 'x', retainScanImages: true })).toBe(true);
    expect(shouldRetainScanImage(null, true)).toBe(true);
  });
});

describe('printable PDFs', () => {
  const quiz = paperQuiz();
  const template = standardTemplate('pavo-std-20x4')!;

  it('renders a blank answer sheet and a prefilled class pack', async () => {
    const blank = await renderAnswerSheetPdf(template, { quiz, formCode: 'A', sectionLabel: 'Grade 5 - Sampaguita' });
    expect(new TextDecoder().decode(blank.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(blank)).getPageCount()).toBe(1);
    const pack = await renderAnswerSheetPdf(template, {
      quiz,
      formCode: 'B',
      sectionLabel: 'Grade 5 - Sampaguita',
      students: [
        { studentId: 'student_ana', name: 'Ana Santos', classNumber: 1 },
        { studentId: 'student_ben', name: 'Ben Reyes', classNumber: 2 },
      ],
    });
    const document = await PDFDocument.load(pack);
    expect(document.getPageCount()).toBe(2);
    expect(document.getPage(0).getSize()).toEqual({ width: template.page.width, height: template.page.height });
  });

  it('renders a quiz paper per form with its version', async () => {
    const pdf = await renderQuizPaperPdf(quiz, 'B', { sectionLabel: 'Grade 5' });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
