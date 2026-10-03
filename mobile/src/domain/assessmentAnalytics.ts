import { CHOICE_LABELS, type ItemOutcome } from './assessmentModel';
import type { AssessmentGuide } from './assessmentGuide';

/** One graded attempt, from a result QR, a paper scan, or a local attempt. */
export interface GradedResult {
  resultId: string;
  studentId: string;
  quizId: string;
  quizVersion: number;
  formCode: string;
  attemptNumber: number;
  source: 'result_qr' | 'paper_scan' | 'local';
  completedAt: number;
  score: number;
  total: number;
  items: Array<{
    questionId: string;
    outcome: ItemOutcome;
    /** Canonical choice index the learner selected, when known (paper scans). */
    selectedChoice?: number | null;
  }>;
}

type GuideQuestion = AssessmentGuide['questions'][number];

export interface ItemStatistics {
  questionId: string;
  number: number;
  topic: string;
  competency: string;
  attempts: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  correctRate: number;
  difficulty: 'easy' | 'moderate' | 'hard';
  distractors: Array<{ label: string; choice: string; count: number; isKey: boolean }> | null;
}

export interface GroupStatistics {
  name: string;
  questions: number;
  correctRate: number;
}

export interface AssessmentAnalytics {
  resultCount: number;
  rosterSize: number | null;
  completionRate: number | null;
  meanPercent: number;
  scoreDistribution: Array<{ range: string; count: number }>;
  items: ItemStatistics[];
  commonlyMissed: ItemStatistics[];
  topics: GroupStatistics[];
  competencies: GroupStatistics[];
  strongTopics: string[];
  weakTopics: string[];
  misconceptions: Array<{ questionId: string; number: number; misconception: string; missCount: number }>;
  needsRemediation: Array<{ studentId: string; percent: number; missedCompetencies: string[] }>;
  forms: Array<{ code: string; resultCount: number; meanPercent: number }>;
  attempts: Array<{ attemptNumber: number; resultCount: number; meanPercent: number }>;
}

const STRONG = 0.8;
const WEAK = 0.6;

/**
 * Class analytics for one quiz version. Item statistics use each learner's
 * latest attempt; questions are matched by stable ID so alternate forms with
 * different orders and answer letters are never mixed.
 */
export function analyzeAssessment(
  guide: AssessmentGuide,
  results: GradedResult[],
  options: { rosterSize?: number; masteryPercent?: number } = {},
): AssessmentAnalytics {
  const masteryPercent = options.masteryPercent ?? 75;
  const sameVersion = results.filter(
    (result) => result.quizId === guide.quizId && result.quizVersion === guide.version,
  );
  const latest = latestPerStudent(sameVersion);
  const percents = latest.map(percentOf);

  const items = guide.questions.map((question) => itemStatistics(question, latest));
  const groups = (key: 'topic' | 'competency') => {
    const names = [...new Set(guide.questions.map((question) => question[key]))];
    return names.map((name) => {
      const related = items.filter((item) => item[key] === name);
      const attempts = related.reduce((sum, item) => sum + item.attempts, 0);
      const correct = related.reduce((sum, item) => sum + item.correct, 0);
      return {
        name,
        questions: related.length,
        correctRate: attempts ? round(correct / attempts) : 0,
      };
    });
  };
  const topics = groups('topic');
  const competencies = groups('competency');
  const byId = new Map(guide.questions.map((question) => [question.id, question]));

  return {
    resultCount: latest.length,
    rosterSize: options.rosterSize ?? null,
    completionRate: options.rosterSize
      ? round(Math.min(1, latest.length / options.rosterSize))
      : null,
    meanPercent: mean(percents),
    scoreDistribution: [0, 20, 40, 60, 80].map((low) => ({
      range: low === 80 ? '80–100%' : `${low}–${low + 19}%`,
      count: percents.filter((percent) => (low === 80 ? percent >= 80 : percent >= low && percent < low + 20)).length,
    })),
    items,
    commonlyMissed: items
      .filter((item) => item.attempts > 0 && 1 - item.correctRate >= 0.4)
      .sort((left, right) => left.correctRate - right.correctRate || left.number - right.number)
      .slice(0, 5),
    topics,
    competencies,
    strongTopics: topics.filter((topic) => hasEvidence(topic, items) && topic.correctRate >= STRONG).map((topic) => topic.name),
    weakTopics: topics.filter((topic) => hasEvidence(topic, items) && topic.correctRate < WEAK).map((topic) => topic.name),
    misconceptions: items
      .map((item) => ({
        questionId: item.questionId,
        number: item.number,
        misconception: byId.get(item.questionId)?.misconception ?? '',
        missCount: item.incorrect + item.unanswered,
      }))
      .filter((entry) => entry.misconception && entry.missCount > 0)
      .sort((left, right) => right.missCount - left.missCount),
    needsRemediation: latest
      .filter((result) => percentOf(result) < masteryPercent)
      .map((result) => ({
        studentId: result.studentId,
        percent: percentOf(result),
        missedCompetencies: [
          ...new Set(
            result.items
              .filter((item) => item.outcome !== 'correct')
              .map((item) => byId.get(item.questionId)?.competency)
              .filter((value): value is string => Boolean(value)),
          ),
        ],
      }))
      .sort((left, right) => left.percent - right.percent),
    forms: guide.forms.map((form) => {
      const formResults = latest.filter((result) => result.formCode === form.code);
      return { code: form.code, resultCount: formResults.length, meanPercent: mean(formResults.map(percentOf)) };
    }),
    attempts: [...new Set(sameVersion.map((result) => result.attemptNumber))]
      .sort((a, b) => a - b)
      .map((attemptNumber) => {
        const attemptResults = sameVersion.filter((result) => result.attemptNumber === attemptNumber);
        return {
          attemptNumber,
          resultCount: attemptResults.length,
          meanPercent: mean(attemptResults.map(percentOf)),
        };
      }),
  };
}

export interface LearnerPlan {
  incorrect: GuideQuestion[];
  unanswered: GuideQuestion[];
  competencies: Array<{
    competency: string;
    topics: string[];
    questionNumbers: number[];
    misconceptions: string[];
    interventions: string[];
    remediation: string[];
  }>;
  summary: string;
}

/** Turns one learner's missed questions into an ordered, guide-grounded plan. */
export function buildLearnerPlan(
  guide: AssessmentGuide,
  result: Pick<GradedResult, 'items'>,
): LearnerPlan {
  const byId = new Map(guide.questions.map((question) => [question.id, question]));
  const pick = (outcome: ItemOutcome) =>
    result.items
      .filter((item) => item.outcome === outcome)
      .map((item) => byId.get(item.questionId))
      .filter((question): question is GuideQuestion => Boolean(question))
      .sort((left, right) => left.number - right.number);
  const incorrect = pick('incorrect');
  const unanswered = pick('unanswered');
  const missed = [...incorrect, ...unanswered];

  const grouped = new Map<string, GuideQuestion[]>();
  for (const question of missed) {
    grouped.set(question.competency, [...(grouped.get(question.competency) ?? []), question]);
  }
  const competencies = [...grouped.entries()]
    .sort((left, right) => right[1].length - left[1].length)
    .map(([competency, questions]) => ({
      competency,
      topics: unique(questions.map((question) => question.topic)),
      questionNumbers: questions.map((question) => question.number).sort((a, b) => a - b),
      misconceptions: unique(questions.map((question) => question.misconception)),
      interventions: unique(questions.map((question) => question.intervention)),
      remediation: unique(questions.map((question) => question.remediationRef)),
    }));
  const first = competencies[0];
  return {
    incorrect,
    unanswered,
    competencies,
    summary: !missed.length
      ? 'Every question was answered correctly. Offer an extension activity.'
      : `Start with ${first!.competency}${
          first!.remediation.length ? ` using ${first!.remediation[0]}` : ''
        }, then review ${competencies.length > 1 ? `${competencies.length - 1} more competenc${competencies.length === 2 ? 'y' : 'ies'}` : 'the missed items'} before a short re-check.`,
  };
}

export function renderAssessmentReport(
  guide: AssessmentGuide,
  analytics: AssessmentAnalytics,
  learnerNames: Record<string, string> = {},
): string {
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return [
    `# ${guide.title} — assessment report`,
    '',
    `Quiz ${guide.quizId} · version ${guide.version} · ${guide.mode === 'paper_omr' ? 'Paper quiz' : 'Digital mini-quiz'}`,
    '',
    `- Results: ${analytics.resultCount}${analytics.rosterSize ? ` of ${analytics.rosterSize} learners` : ''}`,
    `- Mean score: ${analytics.meanPercent}%`,
    ...(analytics.completionRate !== null ? [`- Completion: ${percent(analytics.completionRate)}`] : []),
    '',
    '## Score distribution',
    '',
    ...analytics.scoreDistribution.map((bucket) => `- ${bucket.range}: ${bucket.count}`),
    '',
    '## Items',
    '',
    '| # | Question ID | Topic | Correct | Difficulty |',
    '| --- | --- | --- | --- | --- |',
    ...analytics.items.map(
      (item) =>
        `| ${item.number} | ${item.questionId} | ${item.topic} | ${percent(item.correctRate)} | ${item.difficulty} |`,
    ),
    '',
    '## Competencies',
    '',
    ...analytics.competencies.map((group) => `- ${group.name}: ${percent(group.correctRate)}`),
    '',
    '## Likely misconceptions',
    '',
    ...(analytics.misconceptions.length
      ? analytics.misconceptions.map((entry) => `- Q${entry.number} (${entry.missCount} missed): ${entry.misconception}`)
      : ['- None recorded.']),
    '',
    '## Learners needing remediation',
    '',
    ...(analytics.needsRemediation.length
      ? analytics.needsRemediation.map(
          (entry) =>
            `- ${learnerNames[entry.studentId] ?? entry.studentId}: ${entry.percent}% — ${entry.missedCompetencies.join(', ') || 'review'}`,
        )
      : ['- None below the mastery threshold.']),
    '',
    ...(analytics.forms.length > 1
      ? [
          '## Alternate forms',
          '',
          ...analytics.forms.map((form) => `- Form ${form.code}: ${form.resultCount} results, mean ${form.meanPercent}%`),
          '',
        ]
      : []),
  ].join('\n');
}

function itemStatistics(question: GuideQuestion, results: GradedResult[]): ItemStatistics {
  const entries = results
    .map((result) => result.items.find((item) => item.questionId === question.id))
    .filter((item): item is GradedResult['items'][number] => Boolean(item));
  const correct = entries.filter((item) => item.outcome === 'correct').length;
  const incorrect = entries.filter((item) => item.outcome === 'incorrect').length;
  const unanswered = entries.filter((item) => item.outcome === 'unanswered').length;
  const correctRate = entries.length ? round(correct / entries.length) : 0;
  const choiceEvidence = entries.some((item) => typeof item.selectedChoice === 'number');
  const keyIndex = question.choices.indexOf(question.answer);
  return {
    questionId: question.id,
    number: question.number,
    topic: question.topic,
    competency: question.competency,
    attempts: entries.length,
    correct,
    incorrect,
    unanswered,
    correctRate,
    difficulty: correctRate >= 0.8 ? 'easy' : correctRate >= 0.5 ? 'moderate' : 'hard',
    distractors:
      question.choices.length && choiceEvidence
        ? question.choices.map((choice, index) => ({
            label: CHOICE_LABELS[index]!,
            choice,
            count: entries.filter((item) => item.selectedChoice === index).length,
            isKey: index === keyIndex || question.acceptedAnswers.includes(choice),
          }))
        : null,
  };
}

function latestPerStudent(results: GradedResult[]): GradedResult[] {
  const latest = new Map<string, GradedResult>();
  for (const result of results) {
    const current = latest.get(result.studentId);
    if (
      !current ||
      result.attemptNumber > current.attemptNumber ||
      (result.attemptNumber === current.attemptNumber && result.completedAt > current.completedAt)
    ) {
      latest.set(result.studentId, result);
    }
  }
  return [...latest.values()];
}

function hasEvidence(group: GroupStatistics, items: ItemStatistics[]): boolean {
  return items.some((item) => item.topic === group.name && item.attempts > 0);
}

function percentOf(result: Pick<GradedResult, 'score' | 'total'>): number {
  return result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
}

function mean(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
