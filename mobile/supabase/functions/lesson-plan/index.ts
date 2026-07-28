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
const STYLES = new Set([
  'visual',
  'auditory',
  'reading',
  'kinesthetic',
  'balanced',
]);

interface LessonPlan {
  title: string;
  objectives: string[];
  lessonFlow: string[];
  assessment: string[];
  remediation: string[];
}

Deno.serve(async (request) => {
  try {
    await requireTeacherUser(request);
    const body = await readJsonObject(request);
    assertNoDirectIdentifiers(body);
    const input = validateLessonInput(body);
    const result = await generateStructuredJson<LessonPlan>({
      systemInstruction:
        'You are a Philippine elementary-school lesson planning assistant. Produce practical, culturally respectful, low-resource classroom activities. Do not infer or request student identity. Avoid ability labels. Return only the requested JSON.',
      prompt: JSON.stringify(input),
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          objectives: { type: 'array', items: { type: 'string' } },
          lessonFlow: { type: 'array', items: { type: 'string' } },
          assessment: { type: 'array', items: { type: 'string' } },
          remediation: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'title',
          'objectives',
          'lessonFlow',
          'assessment',
          'remediation',
        ],
      },
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});

function validateLessonInput(value: Record<string, unknown>) {
  const gradeLevel = integer(value.gradeLevel, 'gradeLevel', 1, 12);
  const quarter = integer(value.quarter, 'quarter', 1, 4);
  const subject = text(value.subject, 'subject', 40);
  const learningStyle = text(value.learningStyle, 'learningStyle', 30);
  if (!SUBJECTS.has(subject)) throw new HttpError(400, 'subject is invalid.');
  if (!STYLES.has(learningStyle)) {
    throw new HttpError(400, 'learningStyle is invalid.');
  }
  const availableMaterials = stringArray(
    value.availableMaterials,
    'availableMaterials',
    12,
    80,
  );
  return {
    gradeLevel,
    subject,
    quarter,
    competencyCode: text(value.competencyCode, 'competencyCode', 160),
    topic: text(value.topic, 'topic', 160),
    learningStyle,
    availableMaterials,
  };
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

function stringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some((item) => typeof item !== 'string' || item.length > maxLength)
  ) {
    throw new HttpError(400, `${field} is invalid.`);
  }
  return value.map((item) => (item as string).trim()).filter(Boolean);
}
