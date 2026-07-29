import type { CompanionRequest, CompanionResponse } from '@/domain/companion';

/**
 * On-device demo/offline simulation of a Pavo companion answer.
 *
 * The real backend (the `pavo-companion` edge function) is not modified. When
 * it is not configured or not reachable, this produces a believable, clearly
 * demo-labelled response so the full experience — the process steps and the
 * typewriter reveal — can be seen and simulated without a network or a
 * deployed function.
 *
 * It is grounded in the actual request (the learner's question, the selected
 * modules, the grade level) — it never invents external sources or data.
 */

const DEMO_NOTE = 'This is an on-device demo response, so you can preview how Pavo answers.';

function clampWords(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function titleCaseSubject(subject?: string): string {
  if (!subject) return 'Your lessons';
  const clean = subject.replace(/_/g, ' ').toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function simulateCompanionResponse(request: CompanionRequest): CompanionResponse {
  const modules = request.modules ?? [];
  const primary = modules[0];
  const subjectLabel = titleCaseSubject(primary?.subject);
  const focus = request.question?.trim() || primary?.title || 'your recent lessons';
  const isTeacher = request.intent.startsWith('teacher_');

  if (isTeacher) {
    return teacherResponse(request, subjectLabel, focus);
  }
  return learnerResponse(request, primary?.title, subjectLabel, focus);
}

function learnerResponse(
  request: CompanionRequest,
  moduleTitle: string | undefined,
  subjectLabel: string,
  focus: string,
): CompanionResponse {
  const asking = request.intent === 'ask';
  const anchor = moduleTitle ?? subjectLabel;

  const sections = [
    {
      heading: 'The main idea',
      body: clampWords(
        `Think of ${focus} as one clear idea you can explain in a sentence. Start from what you already ` +
          `know in ${anchor}, then add one new detail at a time. If you can teach it to a friend, you have it.`,
        1000,
      ),
    },
    {
      heading: 'A quick example',
      body: clampWords(
        `Picture a real situation from ${subjectLabel.toLowerCase()} and walk through it step by step. Say each ` +
          `step out loud. Naming the steps is what moves the idea from "I recognise it" to "I can use it".`,
        1000,
      ),
    },
    {
      heading: 'Try it yourself',
      body: clampWords(
        `Cover your notes and write two sentences about ${focus} from memory. Check them against ${anchor}, then ` +
          `fix only what you missed. That small retrieval is worth more than re-reading the whole lesson.`,
        1000,
      ),
    },
  ];

  const flashcards = [
    { front: `In your own words, what is ${clampWords(focus, 120)}?`, back: `A short, clear idea from ${anchor} that you can explain and give one example of.` },
    { front: `Give one example of ${clampWords(focus, 120)}.`, back: 'Any real case where the idea applies — the more everyday, the easier it sticks.' },
  ];

  const questions = [
    {
      prompt: `Which is the best first step when you review ${clampWords(focus, 120)}?`,
      options: ['Recall it from memory, then check', 'Re-read the lesson twice', 'Skip to the quiz', 'Copy the notes out'],
      correctOption: 0,
      explanation: 'Pulling the answer from memory first (active recall) strengthens it far more than re-reading.',
    },
  ];

  return {
    kind: asking ? 'report' : 'mixed',
    title: asking ? `About ${clampWords(focus, 90)}` : `Review: ${clampWords(anchor, 90)}`,
    summary: clampWords(
      `${DEMO_NOTE} Here is a friendly, grade ${request.gradeLevel} way to think about ${focus}. Read the idea, ` +
        `try the example, then use the recall prompts below to make it stick.`,
      880,
    ),
    sections,
    flashcards: asking ? [] : flashcards,
    questions: asking ? [] : questions,
    nextStep: clampWords(`Do one recall prompt about ${focus}, then take the module quiz when it feels easy.`, 280),
  };
}

function teacherResponse(
  request: CompanionRequest,
  subjectLabel: string,
  focus: string,
): CompanionResponse {
  const grade = request.gradeLevel;
  const plan = request.intent === 'teacher_lesson_plan';
  const summaryIntent = request.intent === 'teacher_class_summary';

  const sections = summaryIntent
    ? [
        {
          heading: 'Where the class stands',
          body: clampWords(
            `Most learners are steady on the core idea of ${focus}; a smaller group needs another pass. Group by ` +
              `who can already explain it versus who can only recognise it, and pitch the next session to the second group.`,
            1000,
          ),
        },
        {
          heading: 'What to reteach',
          body: clampWords(
            `Target the one step learners skip most often. A five-minute worked example plus a quick recall check ` +
              `usually closes the gap without reteaching the whole topic.`,
            1000,
          ),
        },
      ]
    : [
        {
          heading: 'Objective',
          body: clampWords(`By the end, grade ${grade} learners can explain ${focus} and give one example unprompted.`, 1000),
        },
        {
          heading: 'Flow (about 45 minutes)',
          body: clampWords(
            `Warm-up recall (5 min) → guided example on ${focus} (15 min) → paired practice (15 min) → exit check ` +
              `where each learner writes one sentence and one example (10 min).`,
            1000,
          ),
        },
        {
          heading: 'Check for understanding',
          body: clampWords(
            `Use a short retrieval question rather than "any questions?". Anyone who cannot produce an example ` +
              `joins a quick small-group reteach while others extend.`,
            1000,
          ),
        },
      ];

  const questions =
    request.intent === 'teacher_author_quiz'
      ? [
          {
            prompt: `Which best shows a learner understands ${focus}?`,
            options: ['They explain it and give a new example', 'They repeat the definition', 'They circle the keyword', 'They copy the notes'],
            correctOption: 0,
            explanation: 'Producing a fresh example is stronger evidence of transfer than restating a definition.',
          },
        ]
      : [];

  return {
    kind: plan ? 'lesson' : summaryIntent ? 'report' : request.intent === 'teacher_author_quiz' ? 'quiz' : 'mixed',
    title: summaryIntent ? `${subjectLabel} class summary` : `Draft: ${clampWords(focus, 90)}`,
    summary: clampWords(
      `${DEMO_NOTE} An editable ${subjectLabel.toLowerCase()} draft for grade ${grade}. Review and adjust it before ` +
        `anything reaches learners.`,
      880,
    ),
    sections,
    flashcards: [],
    questions,
    nextStep: clampWords('Review the draft, edit for your class, then decide what to share.', 280),
  };
}
