import { isSafePath } from './packageV2';

/**
 * adaptive-lesson.md — front matter plus fenced blocks:
 *
 *   ::: concept {id="photosynthesis"}
 *   Markdown body…
 *   :::
 *
 * Attributes use key="value". Blocks do not nest. Block-specific bodies:
 * - hints: an ordered list, revealed one rung at a time
 * - check: prompt text, then `- [ ]` / `- [x]` choices, or attribute answer="…"
 * - checkpoint: `- [ ] I can …` items the learner confirms
 */
export const LESSON_BLOCK_TYPES = [
  'objective',
  'concept',
  'worked-example',
  'visual',
  'read-aloud',
  'guided-practice',
  'hints',
  'check',
  'practice',
  'reflection',
  'remediation',
  'extension',
  'checkpoint',
] as const;
export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

export interface LessonBlock {
  type: LessonBlockType;
  id: string;
  /** Concept this block teaches, checks, or remediates. */
  concept: string | null;
  markdown: string;
  image?: { path: string; alt: string; caption: string };
  hints?: string[];
  check?: {
    prompt: string;
    choices: Array<{ text: string; correct: boolean }>;
    answer: string | null;
    explanation: string;
  };
  items?: string[];
}

export interface AdaptiveLesson {
  lessonId: string;
  title: string;
  gradeLevel: number;
  subject: string;
  competencies: string[];
  estimatedMinutes: number;
  language: string;
  blocks: LessonBlock[];
}

export const LESSON_BLOCK_LABELS: Record<LessonBlockType, string> = {
  objective: 'Learning objective',
  concept: 'Concept',
  'worked-example': 'Worked example',
  visual: 'Visual explanation',
  'read-aloud': 'Read aloud',
  'guided-practice': 'Guided practice',
  hints: 'Hints',
  check: 'Knowledge check',
  practice: 'Independent practice',
  reflection: 'Reflection',
  remediation: 'Review',
  extension: 'Extension',
  checkpoint: 'Completion checkpoint',
};

const MAX_BLOCKS = 80;

export function parseAdaptiveLesson(markdown: string): AdaptiveLesson {
  const text = markdown.replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!front) throw new Error('adaptive-lesson.md needs front matter.');
  const meta = Object.fromEntries(
    front[1]!.split('\n').filter(Boolean).map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  if (meta.pavo !== 'adaptive-lesson' || meta.schemaVersion !== '1') {
    throw new Error('This is not a version 1 PAVO adaptive lesson.');
  }
  const gradeLevel = Number(meta.gradeLevel);
  if (!meta.lessonId || !meta.title || !Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) {
    throw new Error('The lesson front matter needs lessonId, title, and gradeLevel 1–12.');
  }

  const blocks: LessonBlock[] = [];
  const lines = text.slice(front[0].length).split('\n');
  let open: { type: LessonBlockType; attributes: Record<string, string>; body: string[]; line: number } | null = null;
  lines.forEach((line, index) => {
    const opener = /^:::\s*([a-z-]+)\s*(\{.*\})?\s*$/.exec(line);
    if (opener && !open) {
      const type = opener[1] as LessonBlockType;
      if (!(LESSON_BLOCK_TYPES as readonly string[]).includes(type)) {
        throw new Error(`Unknown lesson block "${opener[1]}" on line ${index + 1}.`);
      }
      open = { type, attributes: parseAttributes(opener[2] ?? ''), body: [], line: index + 1 };
      return;
    }
    if (/^:::\s*$/.test(line)) {
      if (!open) throw new Error(`Unexpected ::: on line ${index + 1}.`);
      blocks.push(buildBlock(open.type, open.attributes, open.body.join('\n').trim(), blocks.length));
      open = null;
      return;
    }
    if (opener && open) throw new Error(`Blocks cannot nest (line ${index + 1}).`);
    if (open) open.body.push(line);
  });
  if (open) throw new Error(`The ${(open as { type: string }).type} block starting on line ${(open as { line: number }).line} is not closed.`);
  if (blocks.length > MAX_BLOCKS) throw new Error(`A lesson can have at most ${MAX_BLOCKS} blocks.`);
  for (const required of ['objective', 'concept', 'checkpoint'] as const) {
    if (!blocks.some((block) => block.type === required)) {
      throw new Error(`The lesson needs at least one ${LESSON_BLOCK_LABELS[required].toLowerCase()} block.`);
    }
  }
  const ids = blocks.map((block) => block.id);
  if (new Set(ids).size !== ids.length) throw new Error('Lesson block IDs must be unique.');

  return {
    lessonId: meta.lessonId,
    title: meta.title,
    gradeLevel,
    subject: meta.subject ?? '',
    competencies: (meta.competencies ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    estimatedMinutes: Number(meta.estimatedMinutes) || 15,
    language: meta.language || 'en',
    blocks,
  };
}

export function renderAdaptiveLesson(lesson: AdaptiveLesson): string {
  const lines = [
    '---',
    'pavo: adaptive-lesson',
    'schemaVersion: 1',
    `lessonId: ${lesson.lessonId}`,
    `title: ${oneLine(lesson.title)}`,
    `gradeLevel: ${lesson.gradeLevel}`,
    `subject: ${oneLine(lesson.subject)}`,
    `competencies: ${lesson.competencies.map(oneLine).join(', ')}`,
    `estimatedMinutes: ${lesson.estimatedMinutes}`,
    `language: ${lesson.language}`,
    '---',
    '',
    `# ${oneLine(lesson.title)}`,
    '',
  ];
  for (const block of lesson.blocks) {
    const attributes: Record<string, string> = { id: block.id };
    if (block.concept) attributes[block.type === 'remediation' ? 'for' : 'concept'] = block.concept;
    if (block.image) Object.assign(attributes, { image: block.image.path, alt: block.image.alt, caption: block.image.caption });
    if (block.check?.answer) attributes.answer = block.check.answer;
    if (block.check?.explanation) attributes.explain = block.check.explanation;
    lines.push(`::: ${block.type} ${renderAttributes(attributes)}`);
    if (block.hints) lines.push(...block.hints.map((hint, index) => `${index + 1}. ${oneLine(hint)}`));
    else if (block.check) {
      lines.push(block.check.prompt);
      if (block.check.choices.length) {
        lines.push('', ...block.check.choices.map((choice) => `- [${choice.correct ? 'x' : ' '}] ${oneLine(choice.text)}`));
      }
    } else if (block.items) lines.push(...block.items.map((item) => `- [ ] ${oneLine(item)}`));
    else if (block.markdown) lines.push(block.markdown);
    lines.push(':::', '');
  }
  return lines.join('\n');
}

/** Image paths a lesson references; each must exist in its package. */
export function lessonImagePaths(lesson: AdaptiveLesson): string[] {
  return [...new Set(lesson.blocks.flatMap((block) => (block.image ? [block.image.path] : [])))];
}

/** Grades a knowledge check (formative only; never recorded as a quiz score). */
export function checkAnswer(block: LessonBlock, response: string | number): boolean {
  if (!block.check) return false;
  if (typeof response === 'number') return block.check.choices[response]?.correct === true;
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
  return block.check.answer !== null && normalize(response) === normalize(block.check.answer);
}

/** Wraps a plain Markdown module so legacy lessons still open as a mastery sequence. */
export function lessonFromMarkdown(args: {
  lessonId: string;
  title: string;
  gradeLevel: number;
  subject: string;
  markdown: string;
}): AdaptiveLesson {
  const sections = args.markdown
    .replace(/^# .*\n?/, '')
    .split(/\n(?=## )/)
    .map((section) => section.trim())
    .filter(Boolean);
  const firstParagraph = sections[0]?.replace(/^## .*\n?/, '').split(/\n\n/)[0]?.trim() ?? args.title;
  return {
    lessonId: args.lessonId,
    title: args.title,
    gradeLevel: Math.min(12, Math.max(1, args.gradeLevel || 1)),
    subject: args.subject,
    competencies: [],
    estimatedMinutes: 15,
    language: 'en',
    blocks: [
      { type: 'objective', id: 'objective-1', concept: null, markdown: firstParagraph },
      ...sections.map((section, index): LessonBlock => ({
        type: 'concept',
        id: `concept-${index + 1}`,
        concept: null,
        markdown: section,
      })),
      { type: 'checkpoint', id: 'checkpoint-1', concept: null, markdown: '', items: [`I can explain the main ideas of ${args.title}.`] },
    ],
  };
}

function buildBlock(type: LessonBlockType, attributes: Record<string, string>, body: string, index: number): LessonBlock {
  const block: LessonBlock = {
    type,
    id: attributes.id ?? `${type}-${index + 1}`,
    concept: attributes.concept ?? attributes.for ?? null,
    markdown: body,
  };
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(block.id)) throw new Error(`Invalid block id "${block.id}".`);
  switch (type) {
    case 'visual': {
      const path = attributes.image ?? '';
      if (!isSafePath(path)) throw new Error(`Visual block ${block.id} needs a safe image path.`);
      if (!attributes.alt) throw new Error(`Visual block ${block.id} needs alt text.`);
      block.image = { path, alt: attributes.alt, caption: attributes.caption ?? '' };
      break;
    }
    case 'hints': {
      const hints = body.split('\n').map((line) => /^\d+\.\s+(.*)$/.exec(line.trim())?.[1]).filter((hint): hint is string => Boolean(hint));
      if (!hints.length) throw new Error(`Hint block ${block.id} needs a numbered list.`);
      block.hints = hints;
      break;
    }
    case 'check': {
      const choiceLines = body.split('\n').filter((line) => /^- \[[ xX]\] /.test(line.trim()));
      const choices = choiceLines.map((line) => ({
        text: line.trim().slice(6).trim(),
        correct: /^- \[[xX]\]/.test(line.trim()),
      }));
      const prompt = body
        .split('\n')
        .filter((line) => !/^- \[[ xX]\] /.test(line.trim()))
        .join('\n')
        .trim();
      const answer = attributes.answer ?? null;
      if (!prompt) throw new Error(`Knowledge check ${block.id} needs a question.`);
      if (choices.length && !choices.some((choice) => choice.correct)) {
        throw new Error(`Knowledge check ${block.id} needs a correct choice.`);
      }
      if (!choices.length && !answer) throw new Error(`Knowledge check ${block.id} needs choices or an answer.`);
      block.check = { prompt, choices, answer, explanation: attributes.explain ?? '' };
      break;
    }
    case 'checkpoint': {
      const items = body.split('\n').map((line) => /^- \[[ xX]\]\s+(.*)$/.exec(line.trim())?.[1]).filter((item): item is string => Boolean(item));
      if (!items.length) throw new Error(`Checkpoint ${block.id} needs "- [ ] I can …" items.`);
      block.items = items;
      break;
    }
    default:
      if (!body) throw new Error(`The ${type} block ${block.id} is empty.`);
  }
  return block;
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const inner = source.replace(/^\{|\}$/g, '');
  const pattern = /([a-zA-Z]+)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(inner))) attributes[match[1]!] = match[2]!.replace(/\\"/g, '"');
  return attributes;
}

function renderAttributes(attributes: Record<string, string>): string {
  return `{${Object.entries(attributes)
    .map(([key, value]) => `${key}="${oneLine(value).replace(/"/g, '\\"')}"`)
    .join(' ')}}`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
