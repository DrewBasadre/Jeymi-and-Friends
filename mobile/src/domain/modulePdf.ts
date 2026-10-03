import { PDFDocument, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import { LESSON_BLOCK_LABELS, type AdaptiveLesson, type LessonBlock } from './adaptiveLesson';
import { CHOICE_LABELS } from './assessmentModel';
import { drawText, embedFonts, wrapText, type Fonts } from './paperPdf';

const INK = rgb(0.09, 0.13, 0.11);
const MUTED = rgb(0.33, 0.37, 0.35);
const ACCENT = rgb(0.07, 0.42, 0.3);
const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 56;

export interface ModulePdfMetadata {
  packageId: string;
  version: number;
  authorName: string;
  createdAt: string;
  license: string;
  authors: string[];
  notice: string;
  sourceUrl: string | null;
}

export async function renderModulePdf(args: {
  lesson: AdaptiveLesson;
  images: Record<string, { bytes: Uint8Array; mimeType: string }>;
  metadata: ModulePdfMetadata;
}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(args.lesson.title);
  document.setAuthor(args.metadata.authorName);
  document.setCreator('PAVO');
  const fonts = await embedFonts(document);
  const embedded = new Map<string, PDFImage>();
  for (const [path, image] of Object.entries(args.images)) {
    if (image.mimeType === 'image/png') embedded.set(path, await document.embedPng(image.bytes));
    if (image.mimeType === 'image/jpeg') embedded.set(path, await document.embedJpg(image.bytes));
  }

  const writer = new FlowWriter(document, fonts, args.lesson, args.metadata);
  const { lesson } = args;
  writer.text(lesson.title, fonts.bold, 20, INK, 28);
  writer.text(`Grade ${lesson.gradeLevel} · ${lesson.subject} · about ${lesson.estimatedMinutes} minutes`, fonts.regular, 10, MUTED, 16);
  if (lesson.competencies.length) writer.text(`Competencies: ${lesson.competencies.join('; ')}`, fonts.regular, 10, MUTED, 14);
  writer.space(10);

  const objectives = lesson.blocks.filter((block) => block.type === 'objective');
  writer.heading('Learning objectives');
  for (const block of objectives) writer.markdown(block.markdown, embedded);

  for (const block of lesson.blocks) {
    if (block.type === 'objective' || block.type === 'read-aloud') continue;
    writer.heading(sectionTitle(block));
    writeBlock(writer, block, embedded);
  }

  writer.space(14);
  writer.heading('Attribution and license');
  writer.text(`Authors: ${args.metadata.authors.join(', ')}`, fonts.regular, 9.5, MUTED, 13);
  writer.text(`License: ${args.metadata.license}`, fonts.regular, 9.5, MUTED, 13);
  if (args.metadata.sourceUrl) writer.text(`Source: ${args.metadata.sourceUrl}`, fonts.regular, 9.5, MUTED, 13);
  if (args.metadata.notice) writer.paragraph(args.metadata.notice, 9.5, MUTED);
  writer.text(
    `Package ${args.metadata.packageId} · version ${args.metadata.version} · prepared by ${args.metadata.authorName} · ${args.metadata.createdAt.slice(0, 10)}`,
    fonts.regular,
    9.5,
    MUTED,
    13,
  );
  writer.finish();
  return document.save();
}

function sectionTitle(block: LessonBlock): string {
  if (block.type === 'guided-practice' || block.type === 'practice') return `Activity — ${LESSON_BLOCK_LABELS[block.type]}`;
  if (block.type === 'concept') return 'Explanation';
  return LESSON_BLOCK_LABELS[block.type];
}

function writeBlock(writer: FlowWriter, block: LessonBlock, images: Map<string, PDFImage>): void {
  if (block.image) writer.image(images.get(block.image.path) ?? null, block.image.alt, block.image.caption);
  if (block.hints) block.hints.forEach((hint, index) => writer.paragraph(`Hint ${index + 1}: ${hint}`));
  else if (block.check) {
    writer.paragraph(block.check.prompt);
    block.check.choices.forEach((choice, index) => writer.paragraph(`   ${CHOICE_LABELS[index] ?? index + 1}. ${choice.text}`));
    if (!block.check.choices.length) writer.paragraph('Answer: ______________________');
  } else if (block.items) block.items.forEach((item) => writer.paragraph(`[  ]  ${item}`));
  if (block.markdown && !block.check && !block.hints && !block.items) writer.markdown(block.markdown, images);
}

class FlowWriter {
  private page: PDFPage;
  private top = MARGIN;
  private pageNumber = 1;
  private readonly width = PAGE[0] - MARGIN * 2;

  constructor(
    private readonly document: PDFDocument,
    private readonly fonts: Fonts,
    private readonly lesson: AdaptiveLesson,
    private readonly metadata: ModulePdfMetadata,
  ) {
    this.page = document.addPage(PAGE);
  }

  space(amount: number): void {
    this.top += amount;
  }

  heading(value: string): void {
    this.ensure(40);
    this.top += 8;
    drawText(this.page, this.fonts.bold, value, MARGIN, this.top, 13, ACCENT);
    this.top += 20;
  }

  text(value: string, font = this.fonts.regular, size = 10.5, color = INK, lineHeight = 15): void {
    for (const line of wrapText(font, value, size, this.width)) {
      this.ensure(lineHeight);
      drawText(this.page, font, line, MARGIN, this.top, size, color);
      this.top += lineHeight;
    }
  }

  paragraph(value: string, size = 10.5, color = INK): void {
    this.text(value, this.fonts.regular, size, color, size * 1.45);
    this.top += 4;
  }

  markdown(markdown: string, images: Map<string, PDFImage>): void {
    for (const raw of markdown.split('\n')) {
      const line = raw.trim();
      if (!line) {
        this.top += 4;
        continue;
      }
      const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line);
      if (image) {
        this.image(images.get(image[2]!) ?? null, image[1]!, '');
        continue;
      }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        this.ensure(26);
        this.top += 4;
        drawText(this.page, this.fonts.bold, plain(heading[2]!), MARGIN, this.top, 11.5, INK);
        this.top += 17;
        continue;
      }
      const bullet = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
      this.text(bullet ? `•  ${plain(bullet[1]!)}` : plain(line));
    }
    this.top += 4;
  }

  image(image: PDFImage | null, alt: string, caption: string): void {
    if (!image) {
      this.paragraph(`[Image: ${alt}]`, 9.5, MUTED);
      return;
    }
    const scale = Math.min(1, this.width / image.width, 260 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensure(height + 24);
    this.page.drawImage(image, { x: MARGIN, y: PAGE[1] - this.top - height, width, height });
    this.top += height + 6;
    if (caption) this.text(caption, this.fonts.regular, 9, MUTED, 12);
    this.top += 6;
  }

  finish(): void {
    this.footer();
  }

  private ensure(needed: number): void {
    if (this.top + needed <= PAGE[1] - 70) return;
    this.footer();
    this.page = this.document.addPage(PAGE);
    this.pageNumber += 1;
    this.top = MARGIN;
  }

  private footer(): void {
    drawText(
      this.page,
      this.fonts.regular,
      `${this.lesson.title} · ${this.metadata.packageId} v${this.metadata.version} · ${this.metadata.license} · page ${this.pageNumber}`,
      MARGIN,
      PAGE[1] - 44,
      7.5,
      MUTED,
    );
  }
}

function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
    .replace(/<[^>]+>/g, '');
}
