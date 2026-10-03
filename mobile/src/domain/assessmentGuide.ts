import {
  ASSESSMENT_SCHEMA_VERSION,
  CHOICE_LABELS,
  DELIVERY_MODES,
  assessmentFingerprint,
  assessmentQuestionSchema,
  quizFormSchema,
  type AssessmentQuestion,
  type DeliveryMode,
  type QuizDefinition,
  type QuizForm,
} from './assessmentModel';

/**
 * Teacher-facing answer key and remediation guide. It is readable Markdown, but
 * every field sits on a fixed `- Label: value` line so the teacher client can
 * parse it back without the original authoring data.
 */
export interface AssessmentGuide {
  quizId: string;
  version: number;
  mode: DeliveryMode;
  title: string;
  gradeLevel: number;
  subject: string;
  forms: Array<QuizForm & { fingerprint: string }>;
  questions: Array<AssessmentQuestion & { number: number }>;
}

const FIELDS = {
  kind: 'Type',
  prompt: 'Question',
  answer: 'Correct answer',
  rationale: 'Rationale',
  topic: 'Topic',
  competency: 'Competency',
  difficulty: 'Difficulty',
  points: 'Points',
  misconception: 'Likely misconception',
  intervention: 'Recommended intervention',
  remediationRef: 'Remediation block',
} as const;
const EMPTY = '—';

export function renderAssessmentGuide(quiz: QuizDefinition): string {
  const lines: string[] = [
    '---',
    'pavo: assessment-guide',
    `schemaVersion: ${ASSESSMENT_SCHEMA_VERSION}`,
    `quizId: ${quiz.quizId}`,
    `quizVersion: ${quiz.version}`,
    `mode: ${quiz.mode}`,
    `title: ${oneLine(quiz.title)}`,
    `gradeLevel: ${quiz.gradeLevel}`,
    `subject: ${oneLine(quiz.subject)}`,
    `questionCount: ${quiz.questions.length}`,
    '---',
    '',
    `# ${oneLine(quiz.title)} — assessment guide`,
    '',
    '> Teacher only. This guide contains the answer key. Never share it with students.',
    '',
    '## Forms',
    '',
    '| Form | Fingerprint | Question order |',
    '| --- | --- | --- |',
    ...quiz.forms.map(
      (form) =>
        `| ${form.code} | ${assessmentFingerprint(quiz, form)} | ${form.questionOrder
          .map((id) => (form.choiceOrders[id] ? `${id}[${form.choiceOrders[id]!.join(',')}]` : id))
          .join(', ')} |`,
    ),
    '',
  ];
  quiz.questions.forEach((question, index) => {
    lines.push(`## Question ${index + 1} · \`${question.id}\``, '');
    lines.push(`- ${FIELDS.kind}: ${question.kind}`);
    lines.push(`- ${FIELDS.prompt}: ${field(question.prompt)}`);
    if (question.choices.length) {
      lines.push('- Choices:');
      question.choices.forEach((choice, choiceIndex) =>
        lines.push(`  - ${CHOICE_LABELS[choiceIndex]}. ${oneLine(choice)}`),
      );
    }
    lines.push(`- ${FIELDS.answer}: ${field(question.answer)}`);
    lines.push(
      `- Also accept: ${
        question.acceptedAnswers.length
          ? question.acceptedAnswers.map(oneLine).join(' ;; ')
          : EMPTY
      }`,
    );
    for (const key of [
      'rationale',
      'topic',
      'competency',
      'difficulty',
      'points',
      'misconception',
      'intervention',
      'remediationRef',
    ] as const) {
      lines.push(`- ${FIELDS[key]}: ${field(String(question[key]))}`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

export function parseAssessmentGuide(markdown: string): AssessmentGuide {
  const text = markdown.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('The assessment guide has no front matter.');
  const meta = Object.fromEntries(
    match[1]!.split('\n').map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  if (meta.pavo !== 'assessment-guide') throw new Error('This file is not a PAVO assessment guide.');
  if (Number(meta.schemaVersion) !== ASSESSMENT_SCHEMA_VERSION) {
    throw new Error('Unsupported assessment guide version.');
  }
  if (!(DELIVERY_MODES as readonly string[]).includes(meta.mode ?? '')) {
    throw new Error('The assessment guide has an unknown delivery mode.');
  }
  const body = text.slice(match[0].length).split('\n');

  const forms: AssessmentGuide['forms'] = [];
  const questions: AssessmentGuide['questions'] = [];
  let current: Record<string, string | string[]> | null = null;
  let listTarget: 'choices' | null = null;
  const flush = () => {
    if (!current) return;
    questions.push(parseQuestion(current, questions.length + 1));
    current = null;
  };

  for (const line of body) {
    const formRow = /^\| ([A-D]) \| ([a-f0-9]{32}) \| (.+) \|$/.exec(line);
    if (formRow) {
      const choiceOrders: Record<string, number[]> = {};
      const questionOrder = formRow[3]!.split(', ').map((entry) => {
        const parsed = /^([A-Za-z0-9._-]+)(?:\[([\d,]+)\])?$/.exec(entry.trim());
        if (!parsed) throw new Error(`Unreadable form entry "${entry}".`);
        if (parsed[2]) choiceOrders[parsed[1]!] = parsed[2].split(',').map(Number);
        return parsed[1]!;
      });
      forms.push({
        ...quizFormSchema.parse({ code: formRow[1], questionOrder, choiceOrders }),
        fingerprint: formRow[2]!,
      });
      continue;
    }
    const heading = /^## Question (\d+) · `([^`]+)`$/.exec(line);
    if (heading) {
      flush();
      if (Number(heading[1]) !== questions.length + 1) {
        throw new Error(`Question ${heading[1]} is out of order.`);
      }
      current = { id: heading[2]!, choices: [] };
      listTarget = null;
      continue;
    }
    if (!current) continue;
    const choice = /^ {2}- ([A-E])\. (.*)$/.exec(line);
    if (choice && listTarget === 'choices') {
      (current.choices as string[]).push(choice[2]!);
      continue;
    }
    const bullet = /^- ([^:]+):\s?(.*)$/.exec(line);
    if (!bullet) continue;
    const [, label, value] = bullet as unknown as [string, string, string];
    listTarget = label === 'Choices' ? 'choices' : null;
    if (label === 'Also accept') {
      current.acceptedAnswers = value === EMPTY ? [] : value.split(' ;; ');
      continue;
    }
    const key = (Object.keys(FIELDS) as Array<keyof typeof FIELDS>).find(
      (candidate) => FIELDS[candidate] === label,
    );
    if (key) current[key] = value === EMPTY ? '' : value;
  }
  flush();

  if (questions.length !== Number(meta.questionCount)) {
    throw new Error('The assessment guide question count does not match its entries.');
  }
  if (!forms.length || forms[0]!.code !== 'A') throw new Error('The assessment guide lists no Form A.');

  const guide: AssessmentGuide = {
    quizId: meta.quizId ?? '',
    version: Number(meta.quizVersion),
    mode: meta.mode as DeliveryMode,
    title: meta.title ?? '',
    gradeLevel: Number(meta.gradeLevel),
    subject: meta.subject ?? '',
    forms,
    questions,
  };
  for (const form of forms) {
    if (assessmentFingerprint(guide, form) !== form.fingerprint) {
      throw new Error(`Form ${form.code} fingerprint does not match its questions.`);
    }
  }
  return guide;
}

/** Resolve 1-based form positions to the guide's stable questions. */
export function resolveFormPositions(
  guide: AssessmentGuide,
  formCode: string,
  positions: number[],
): AssessmentGuide['questions'] {
  const form = guide.forms.find((candidate) => candidate.code === formCode);
  if (!form) throw new Error(`Form ${formCode} is not in the local assessment guide.`);
  const byId = new Map(guide.questions.map((question) => [question.id, question]));
  return positions.map((position) => {
    const id = form.questionOrder[position - 1];
    if (!id) throw new Error(`Question position ${position} is outside the quiz.`);
    return byId.get(id)!;
  });
}

function parseQuestion(
  raw: Record<string, string | string[]>,
  number: number,
): AssessmentGuide['questions'][number] {
  const parsed = assessmentQuestionSchema.safeParse({
    ...raw,
    points: Number(raw.points),
  });
  if (!parsed.success) {
    throw new Error(
      `Question ${number} in the assessment guide is invalid: ${parsed.error.issues[0]?.message ?? 'unknown field'}.`,
    );
  }
  return { ...parsed.data, number };
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function field(value: string): string {
  return oneLine(value) || EMPTY;
}
