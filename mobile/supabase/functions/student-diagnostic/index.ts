import { requireTeacherUser } from '../_shared/auth.ts';
import { generateStructuredJson } from '../_shared/gemini.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJsonObject,
} from '../_shared/http.ts';
import { assertNoDirectIdentifiers } from '../_shared/privacy.ts';
import { assertSafeEducationalOutput } from '../_shared/safety.ts';

const TIMING_PATTERNS = new Set([
  'fast-and-wrong',
  'slow-and-wrong',
  'mixed',
  'no-misses',
]);
const FORMATS = new Set(['text', 'audio', 'visual', 'kinesthetic']);

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
    assertSafeEducationalOutput(result);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});

function validateDiagnostic(value: Record<string, unknown>) {
  const timingPattern = member(
    value.timingPattern,
    'timingPattern',
    TIMING_PATTERNS,
  );
  const learningFormatUsed = member(
    value.learningFormatUsed,
    'learningFormatUsed',
    FORMATS,
  );
  return {
    moduleId: text(value.moduleId, 'moduleId', 160),
    missedQuestionTopics: stringArray(
      value.missedQuestionTopics,
      'missedQuestionTopics',
      30,
      120,
    ),
    timingPattern,
    learningFormatUsed,
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

function stringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some(
      (item) =>
        typeof item !== 'string' ||
        !item.trim() ||
        item.length > maxLength,
    )
  ) {
    throw new HttpError(400, `${field} is invalid.`);
  }
  return value.map((item) => (item as string).trim());
}
