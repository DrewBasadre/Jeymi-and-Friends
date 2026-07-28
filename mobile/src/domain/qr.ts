import { z } from 'zod';
import type { LearningStyle, QuestionResponse, QuizAttempt, Student } from './types';

const payloadType = <T extends string>(value: T) => z.literal(value).default(value);

export const legacyStudentProfileSchema = z.object({
  payloadType: payloadType('student_profile'),
  studentId: z.string().default(''),
  studentNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  middleInitial: z.string().default(''),
  gradeLevel: z.number().int(),
  section: z.string(),
  birthday: z.string().default(''),
});

export const legacyQuizResultSchema = z.object({
  payloadType: payloadType('quiz_result'),
  attemptId: z.string(),
  studentId: z.string(),
  studentNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  middleInitial: z.string().default(''),
  displayName: z.string(),
  gradeLevel: z.number().int(),
  section: z.string(),
  moduleId: z.string(),
  moduleTitle: z.string(),
  subject: z.string(),
  competencyCode: z.string(),
  score: z.number().int(),
  totalItems: z.number().int(),
  weakTopic: z.string(),
  strongTopic: z.string().default(''),
  masteryLevel: z.string().default('DEVELOPING'),
  durationSeconds: z.number().default(0),
  attemptNumber: z.number().int().default(1),
  submittedAt: z.number(),
});

export const legacyQuizAttemptSchema = z.object({
  attemptId: z.string(),
  moduleId: z.string(),
  score: z.number().int(),
  totalItems: z.number().int(),
  weakTopic: z.string(),
  strongTopic: z.string().default(''),
  masteryLevel: z.string().default('DEVELOPING'),
  durationSeconds: z.number().default(0),
  attemptNumber: z.number().int().default(1),
  submittedAt: z.number(),
});

export const legacyProgressExportSchema = z.object({
  payloadType: payloadType('progress_export'),
  studentId: z.string(),
  displayName: z.string(),
  gradeLevel: z.number().int(),
  section: z.string(),
  schoolYear: z.string(),
  quizAttempts: z.array(legacyQuizAttemptSchema),
  completedModules: z.array(z.string()),
  weakTopics: z.array(z.string()),
  gradeCompletionPercent: z.number().int(),
});

export const legacyTeacherQuestionSchema = z.object({
  id: z.string(),
  type: z.string(),
  questionText: z.string(),
  choices: z.array(z.string()).default([]),
  correctAnswer: z.string(),
  topicTag: z.string(),
});

export const legacyTeacherModuleSchema = z.object({
  payloadType: payloadType('teacher_module'),
  moduleId: z.string(),
  title: z.string(),
  subject: z.string(),
  gradeLevel: z.number().int(),
  quarter: z.number().int(),
  moduleNumber: z.number().int().default(0),
  competencyCode: z.string(),
  content: z.string(),
  questions: z.array(legacyTeacherQuestionSchema).default([]),
});

const responseSchema = z.object({
  questionId: z.string(),
  isCorrect: z.boolean(),
  elapsedMs: z.number().int().nonnegative(),
});

export const quizReportV2Schema = z.object({
  schemaVersion: z.literal(2),
  payloadType: z.literal('quiz_result'),
  report: legacyQuizResultSchema.omit({ payloadType: true }).extend({
    learningStyleTag: z.enum(['visual', 'auditory', 'reading', 'kinesthetic', 'balanced']),
    responses: z.array(responseSchema),
  }),
});

export type LegacyStudentProfile = z.infer<typeof legacyStudentProfileSchema>;
export type LegacyQuizResult = z.infer<typeof legacyQuizResultSchema>;
export type LegacyProgressExport = z.infer<typeof legacyProgressExportSchema>;
export type LegacyTeacherModule = z.infer<typeof legacyTeacherModuleSchema>;
export type QuizReportV2 = z.infer<typeof quizReportV2Schema>;

export type DecodedQrPayload =
  | { kind: 'student_profile'; version: 1; data: LegacyStudentProfile }
  | { kind: 'quiz_result'; version: 1; data: LegacyQuizResult }
  | { kind: 'quiz_result'; version: 2; data: QuizReportV2 }
  | { kind: 'progress_export'; version: 1; data: LegacyProgressExport }
  | { kind: 'teacher_module'; version: 1; data: LegacyTeacherModule };

function unwrapJson(raw: string): unknown {
  let current: unknown = raw.trim();
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === 'string') {
      current = JSON.parse(current);
      continue;
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      const isPayloadObject =
        typeof record.payloadType === 'string' ||
        typeof record.schemaVersion === 'number';
      const wrapped =
        record.payload ??
        record.data ??
        record.json ??
        (!isPayloadObject && Object.keys(record).length <= 2
          ? record.content
          : undefined);
      if (typeof wrapped === 'string') {
        current = wrapped;
        continue;
      }
    }
    break;
  }
  return current;
}

export function decodeQrPayload(raw: string): DecodedQrPayload {
  const value = unwrapJson(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('QR payload must be a JSON object.');
  }
  const object = value as Record<string, unknown>;
  if (object.schemaVersion === 2) {
    return { kind: 'quiz_result', version: 2, data: quizReportV2Schema.parse(object) };
  }

  const type = typeof object.payloadType === 'string' ? object.payloadType : '';
  if (type === 'student_profile') {
    return { kind: type, version: 1, data: legacyStudentProfileSchema.parse(object) };
  }
  if (type === 'quiz_result') {
    return { kind: type, version: 1, data: legacyQuizResultSchema.parse(object) };
  }
  if (type === 'teacher_module') {
    return { kind: type, version: 1, data: legacyTeacherModuleSchema.parse(object) };
  }
  if (type === 'progress_export' || type === '') {
    return {
      kind: 'progress_export',
      version: 1,
      data: legacyProgressExportSchema.parse({ ...object, payloadType: 'progress_export' }),
    };
  }
  throw new Error(`Unsupported WAIS QR payload type: ${type}`);
}

export function encodeQuizReportV2(args: {
  student: Student;
  module: { id: string; title: string; subject: string; competencyCode: string };
  attempt: QuizAttempt;
  learningStyleTag: LearningStyle;
}): string {
  const { student, module, attempt, learningStyleTag } = args;
  const payload: QuizReportV2 = {
    schemaVersion: 2,
    payloadType: 'quiz_result',
    report: {
      attemptId: attempt.id,
      studentId: student.id,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      middleInitial: student.middleInitial,
      displayName: student.displayName,
      gradeLevel: student.gradeLevel,
      section: student.section,
      moduleId: module.id,
      moduleTitle: module.title,
      subject: module.subject,
      competencyCode: module.competencyCode,
      score: attempt.score,
      totalItems: attempt.totalItems,
      weakTopic: attempt.weakTopic,
      strongTopic: attempt.strongTopic,
      masteryLevel: attempt.masteryLevel,
      durationSeconds: attempt.durationSeconds,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
      learningStyleTag,
      responses: attempt.responses.map(minimizeResponse),
    },
  };
  return JSON.stringify(quizReportV2Schema.parse(payload));
}

function minimizeResponse(response: QuestionResponse) {
  return {
    questionId: response.questionId,
    isCorrect: response.isCorrect,
    elapsedMs: response.elapsedMs,
  };
}
