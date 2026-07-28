import { requireTeacherUser } from '../_shared/auth.ts';
import { generateStructuredJson } from '../_shared/gemini.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJsonObject,
} from '../_shared/http.ts';
import { assertNoDirectIdentifiers } from '../_shared/privacy.ts';

const SUBJECTS = new Set(['SCIENCE', 'MATH', 'ENGLISH', 'ADDED_MATERIALS']);
const SCORE_BANDS = new Set(['LOW', 'DEVELOPING', 'PROFICIENT', 'ADVANCED']);
const DURATION_BANDS = new Set(['FAST', 'EXPECTED', 'SLOW']);
const TRENDS = new Set(['FIRST_ATTEMPT', 'IMPROVING', 'STEADY', 'DECLINING']);
const STYLES = new Set([
  'visual',
  'auditory',
  'reading',
  'kinesthetic',
  'balanced',
]);

interface DiagnosticResult {
  summary: string;
  actions: string[];
  monitoringPlan: string;
}

Deno.serve(async (request) => {
  try {
    await requireTeacherUser(request);
    const body = await readJsonObject(request);
    assertNoDirectIdentifiers(body);
    const input = validateDiagnostic(body);
    const result = await generateStructuredJson<DiagnosticResult>({
      systemInstruction:
        'You support a Philippine elementary-school teacher. Analyze only the de-identified performance bands and aggregate topic counts supplied. Never diagnose disability, intelligence, or medical conditions. Use tentative educational language and practical low-resource actions. Return only the requested JSON.',
      prompt: JSON.stringify(input),
      responseSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          monitoringPlan: { type: 'string' },
        },
        required: ['summary', 'actions', 'monitoringPlan'],
      },
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});

function validateDiagnostic(value: Record<string, unknown>) {
  const gradeLevel = integer(value.gradeLevel, 'gradeLevel', 1, 12);
  const subject = member(value.subject, 'subject', SUBJECTS);
  const scoreBand = member(value.scoreBand, 'scoreBand', SCORE_BANDS);
  const durationBand = member(
    value.durationBand,
    'durationBand',
    DURATION_BANDS,
  );
  const attemptTrend = member(value.attemptTrend, 'attemptTrend', TRENDS);
  const learningStyleTag = member(
    value.learningStyleTag,
    'learningStyleTag',
    STYLES,
  );
  if (
    !Array.isArray(value.topicOutcomeCounts) ||
    value.topicOutcomeCounts.length > 20
  ) {
    throw new HttpError(400, 'topicOutcomeCounts is invalid.');
  }
  const topicOutcomeCounts = value.topicOutcomeCounts.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'Each topic outcome must be an object.');
    }
    const outcome = item as Record<string, unknown>;
    return {
      topic: text(outcome.topic, 'topic', 120),
      correct: integer(outcome.correct, 'correct', 0, 500),
      incorrect: integer(outcome.incorrect, 'incorrect', 0, 500),
    };
  });
  return {
    gradeLevel,
    subject,
    competencyCode: text(value.competencyCode, 'competencyCode', 160),
    scoreBand,
    durationBand,
    topicOutcomeCounts,
    attemptTrend,
    learningStyleTag,
  };
}

function member(value: unknown, field: string, options: Set<string>): string {
  if (typeof value !== 'string' || !options.has(value)) {
    throw new HttpError(400, `${field} is invalid.`);
  }
  return value;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpError(400, `${field} must be a non-empty string up to ${max} characters.`);
  }
  return value.trim();
}

function integer(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new HttpError(400, `${field} must be an integer from ${min} to ${max}.`);
  }
  return value as number;
}
