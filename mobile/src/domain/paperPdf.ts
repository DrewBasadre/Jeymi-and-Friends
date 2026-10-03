import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { CHOICE_LABELS, questionsForForm, type QuizDefinition } from './assessmentModel';
import { encodeSheetCode, type AnswerSheetTemplate } from './omr';

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.35, 0.38, 0.36);
const LIGHT = rgb(0.62, 0.64, 0.63);

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function embedFonts(document: PDFDocument): Promise<Fonts> {
  return {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
}

const encodable = new Map<string, boolean>();
/** Standard PDF fonts only cover WinAnsi; anything else becomes "?". */
export function pdfSafe(font: PDFFont, value: string): string {
  return [...value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')]
    .map((character) => {
      if (!encodable.has(character)) {
        try {
          font.encodeText(character);
          encodable.set(character, true);
        } catch {
          encodable.set(character, false);
        }
      }
      return encodable.get(character) ? character : '?';
    })
    .join('');
}

export function wrapText(font: PDFFont, value: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(font, value).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draws text with a top-left origin (PAVO template coordinates). */
export function drawText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  top: number,
  size: number,
  color = INK,
): void {
  page.drawText(pdfSafe(font, value), { x, y: page.getHeight() - top - size, size, font, color });
}

export function drawQr(page: PDFPage, text: string, x: number, top: number, size: number): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const cell = size / (count + 2);
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.modules.get(row, column)) {
        page.drawRectangle({
          x: x + cell * (column + 1),
          y: page.getHeight() - top - cell * (row + 2),
          width: cell,
          height: cell,
          color: INK,
        });
      }
    }
  }
}

export interface AnswerSheetOptions {
  quiz: Pick<QuizDefinition, 'quizId' | 'version' | 'title' | 'questions'>;
  formCode: string;
  sectionLabel: string;
  /** One page per learner with identity prefilled; omit for a blank sheet. */
  students?: Array<{ studentId: string; name: string; classNumber?: number | null }>;
}

export async function renderAnswerSheetPdf(
  template: AnswerSheetTemplate,
  options: AnswerSheetOptions,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`${options.quiz.title} answer sheet`);
  document.setCreator('PAVO');
  const fonts = await embedFonts(document);
  const learners = options.students?.length ? options.students : [null];
  for (const learner of learners) {
    drawAnswerSheetPage(document.addPage([template.page.width, template.page.height]), fonts, template, options, learner);
  }
  return document.save();
}

function drawAnswerSheetPage(
  page: PDFPage,
  fonts: Fonts,
  template: AnswerSheetTemplate,
  options: AnswerSheetOptions,
  learner: NonNullable<AnswerSheetOptions['students']>[number] | null,
): void {
  const height = template.page.height;
  for (const center of template.markers.centers) {
    const half = template.markers.size / 2;
    page.drawRectangle({ x: center.x - half, y: height - center.y - half, width: half * 2, height: half * 2, color: INK });
  }
  const orientation = template.orientationMarker;
  page.drawRectangle({
    x: orientation.center.x - orientation.size / 2,
    y: height - orientation.center.y - orientation.size / 2,
    width: orientation.size,
    height: orientation.size,
    color: INK,
  });

  const left = template.markers.centers[0].x + 14;
  drawText(page, fonts.bold, 'PAVO ANSWER SHEET', left, 62, 13);
  drawText(page, fonts.regular, `${options.quiz.title}`.slice(0, 48), left, 80, 10);
  drawText(page, fonts.regular, `Quiz ${options.quiz.quizId} · v${options.quiz.version} · Form ${options.formCode}`, left, 94, 8, MUTED);
  drawText(page, fonts.regular, `Section: ${options.sectionLabel}`.slice(0, 50), left, 106, 8, MUTED);
  drawText(page, fonts.regular, `Sheet ${template.templateId} · layout ${template.layoutVersion}`, left, 118, 7, LIGHT);

  const lineY = (top: number) => height - top;
  drawText(page, fonts.bold, 'Name', left, 140, 8);
  page.drawLine({ start: { x: left + 30, y: lineY(149) }, end: { x: 280, y: lineY(149) }, thickness: 0.6, color: MUTED });
  if (learner) drawText(page, fonts.regular, learner.name, left + 34, 136, 10);
  drawText(page, fonts.bold, 'Date', left, 166, 8);
  page.drawLine({ start: { x: left + 30, y: lineY(175) }, end: { x: 170, y: lineY(175) }, thickness: 0.6, color: MUTED });

  const idColumns = template.classIdBubbles;
  const idLeft = idColumns[0]![0]!.x - 9;
  drawText(page, fonts.bold, 'Class no.', idLeft - 2, 64, 7);
  const prefilledDigits =
    learner?.classNumber ? String(learner.classNumber).padStart(idColumns.length, '0') : null;
  idColumns[0]!.forEach((center, value) =>
    drawText(page, fonts.regular, String(value), idLeft - 8, center.y - 3, 6, MUTED),
  );
  idColumns.forEach((column, digit) => {
    column.forEach((center, value) =>
      drawBubble(page, center, template.classIdBubbleRadius, prefilledDigits?.[digit] === String(value)),
    );
  });

  drawQr(
    page,
    encodeSheetCode({
      templateId: template.templateId,
      layoutVersion: template.layoutVersion,
      quizId: options.quiz.quizId,
      quizVersion: options.quiz.version,
      formCode: options.formCode,
      studentId: learner?.studentId ?? null,
    }),
    template.sheetCode.x,
    template.sheetCode.y,
    template.sheetCode.size,
  );
  drawText(page, fonts.bold, `FORM ${options.formCode}`, template.sheetCode.x + 22, template.sheetCode.y + template.sheetCode.size + 4, 10);

  page.drawLine({
    start: { x: left, y: lineY(template.answerArea.top - 22) },
    end: { x: template.page.width - left, y: lineY(template.answerArea.top - 22) },
    thickness: 0.6,
    color: LIGHT,
  });

  const used = options.quiz.questions.length;
  template.questions.forEach((question, index) => {
    const active = question.number <= used;
    const first = question.bubbles[0]!;
    if (index % 25 === 0) {
      question.bubbles.forEach((bubble, choice) =>
        drawText(page, fonts.bold, CHOICE_LABELS[choice]!, bubble.x - 3, first.y - template.bubbleRadius - 13, 7, MUTED),
      );
    }
    drawText(
      page,
      active ? fonts.bold : fonts.regular,
      String(question.number),
      first.x - template.bubbleRadius - 6 - fonts.bold.widthOfTextAtSize(String(question.number), 8),
      first.y - 4,
      8,
      active ? INK : LIGHT,
    );
    for (const bubble of question.bubbles) drawBubble(page, bubble, template.bubbleRadius, false, active);
  });

  drawInstructions(page, fonts, template);
}

/** Bubble interiors stay ink-free so the scanner's blank baseline is clean paper. */
function drawBubble(
  page: PDFPage,
  center: { x: number; y: number },
  radius: number,
  filled: boolean,
  active = true,
): void {
  page.drawCircle({
    x: center.x,
    y: page.getHeight() - center.y,
    size: radius,
    borderColor: active ? INK : LIGHT,
    borderWidth: 0.7,
    color: filled ? INK : undefined,
  });
}

function drawInstructions(page: PDFPage, fonts: Fonts, template: AnswerSheetTemplate): void {
  const top = template.instructionsTop;
  const left = template.markers.centers[0].x + 14;
  const right = template.page.width - left;
  page.drawRectangle({
    x: left,
    y: page.getHeight() - top - 76,
    width: right - left,
    height: 76,
    borderColor: LIGHT,
    borderWidth: 0.6,
  });
  drawText(page, fonts.bold, 'How to mark this sheet', left + 10, top + 8, 9);
  drawText(page, fonts.regular, 'Use a dark pencil or black/blue pen. Shade one circle per question completely.', left + 10, top + 21, 7.5, MUTED);
  const samples: Array<{ label: string; draw: (x: number, y: number) => void }> = [
    {
      label: 'Correct:\nfully shaded',
      draw: (x, y) => page.drawCircle({ x, y, size: 6, color: INK, borderColor: INK, borderWidth: 0.7 }),
    },
    {
      label: 'Erase fully;\nsmudges get flagged',
      draw: (x, y) => page.drawCircle({ x, y, size: 6, color: rgb(0.8, 0.8, 0.8), borderColor: INK, borderWidth: 0.7 }),
    },
    {
      label: 'Invalid: ticks,\ndots, or crosses',
      draw: (x, y) => {
        page.drawCircle({ x, y, size: 6, borderColor: INK, borderWidth: 0.7 });
        page.drawLine({ start: { x: x - 3, y }, end: { x: x - 1, y: y - 3 }, thickness: 1.2, color: INK });
        page.drawLine({ start: { x: x - 1, y: y - 3 }, end: { x: x + 4, y: y + 4 }, thickness: 1.2, color: INK });
      },
    },
  ];
  const width = (right - left - 20) / 4;
  samples.forEach((sample, index) => {
    const x = left + 18 + index * width;
    sample.draw(x, page.getHeight() - top - 46);
    sample.label.split('\n').forEach((line, row) =>
      drawText(page, fonts.regular, line, x + 10, top + 38 + row * 8, 6.5, MUTED),
    );
  });
  drawText(page, fonts.bold, 'To change an answer:', left + 18 + 3 * width, top + 36, 6.5);
  drawText(page, fonts.regular, 'erase the old mark fully,', left + 18 + 3 * width, top + 45, 6.5, MUTED);
  drawText(page, fonts.regular, 'then shade the new circle.', left + 18 + 3 * width, top + 54, 6.5, MUTED);
  drawText(page, fonts.regular, 'Keep the four black corner squares clean and uncovered.', left + 10, top + 63, 6.5, MUTED);
}

export async function renderQuizPaperPdf(
  quiz: QuizDefinition,
  formCode: string,
  options: { sectionLabel?: string } = {},
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`${quiz.title} — Form ${formCode}`);
  document.setCreator('PAVO');
  const fonts = await embedFonts(document);
  const size: [number, number] = [595.28, 841.89];
  const margin = 56;
  const width = size[0] - margin * 2;
  let page = document.addPage(size);
  let top = margin;
  const footer = (target: PDFPage, number: number) =>
    drawText(target, fonts.regular, `${quiz.quizId} · version ${quiz.version} · Form ${formCode} · page ${number}`, margin, size[1] - 40, 7, LIGHT);
  let pageNumber = 1;
  const ensure = (needed: number) => {
    if (top + needed <= size[1] - 64) return;
    footer(page, pageNumber);
    page = document.addPage(size);
    pageNumber += 1;
    top = margin;
  };

  drawText(page, fonts.bold, quiz.title, margin, top, 16);
  top += 24;
  drawText(page, fonts.regular, `Grade ${quiz.gradeLevel} · ${quiz.subject} · Quiz version ${quiz.version} · FORM ${formCode}`, margin, top, 9, MUTED);
  top += 14;
  if (options.sectionLabel) {
    drawText(page, fonts.regular, `Section: ${options.sectionLabel}`, margin, top, 9, MUTED);
    top += 14;
  }
  drawText(page, fonts.regular, `Mark each answer on the PAVO answer sheet for Form ${formCode}. Do not write on this paper.`, margin, top, 9);
  top += 26;

  for (const { position, question, displayChoices } of questionsForForm(quiz, formCode)) {
    const lines = wrapText(fonts.regular, question.prompt, 10.5, width - 24);
    ensure(lines.length * 14 + displayChoices.length * 13 + 16);
    drawText(page, fonts.bold, `${position}.`, margin, top, 10.5);
    lines.forEach((line, index) => drawText(page, fonts.regular, line, margin + 24, top + index * 14, 10.5));
    top += lines.length * 14 + 3;
    displayChoices.forEach((choice, index) => {
      drawText(page, fonts.regular, `${CHOICE_LABELS[index]}.  ${choice}`, margin + 34, top, 10);
      top += 13;
    });
    top += 10;
  }
  footer(page, pageNumber);
  return document.save();
}
