import { z } from 'zod';
import type {
  LearningFormat,
  LearningStyle,
  QuestionResponse,
  QuizAttempt,
  QuizQuestion,
  Student,
} from './types';

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

const questionTimingSchema = z.object({
  questionId: z.string().min(1).max(160),
  timeSeconds: z.number().int().nonnegative(),
});

const missedQuestionSchema = z.object({
  questionId: z.string().min(1).max(160),
  chosenAnswer: z.string().max(240),
  correctAnswer: z.string().max(240),
  timeSeconds: z.number().int().nonnegative(),
});

export const quizReportSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    reportId: z.string().uuid(),
    studentId: z.string().min(1).max(160),
    moduleId: z.string().min(1).max(160),
    quizId: z.string().min(1).max(160),
    attemptNumber: z.number().int().positive(),
    completedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), {
      message: 'completedAt must be an ISO-8601 date.',
    }),
    learningFormatUsed: z.enum(['text', 'audio', 'visual', 'kinesthetic']),
    score: z.object({
      correct: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      percentage: z.number().int().min(0).max(100),
    }),
    timing: z.object({
      totalTimeSeconds: z.number().int().nonnegative(),
      perQuestion: z.array(questionTimingSchema),
    }),
    missedQuestions: z.array(missedQuestionSchema),
  })
  .superRefine((report, context) => {
    if (report.score.correct > report.score.total) {
      context.addIssue({
        code: 'custom',
        path: ['score', 'correct'],
        message: 'Correct answers cannot exceed the total.',
      });
    }
    const expected = Math.round((report.score.correct / report.score.total) * 100);
    if (report.score.percentage !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['score', 'percentage'],
        message: 'Score percentage does not match correct and total.',
      });
    }
    const timingIds = report.timing.perQuestion.map((item) => item.questionId);
    if (new Set(timingIds).size !== timingIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['timing', 'perQuestion'],
        message: 'Question timing entries must be unique.',
      });
    }
    for (const miss of report.missedQuestions) {
      if (!timingIds.includes(miss.questionId)) {
        context.addIssue({
          code: 'custom',
          path: ['missedQuestions'],
          message: `Missing timing for ${miss.questionId}.`,
        });
      }
    }
  });

export const quizReportPartSchema = z.object({
  schemaVersion: z.literal('1.0'),
  reportId: z.string().uuid(),
  part: z.number().int().positive(),
  totalParts: z.number().int().positive(),
  report: quizReportSchema,
});

export type LegacyStudentProfile = z.infer<typeof legacyStudentProfileSchema>;
export type LegacyQuizResult = z.infer<typeof legacyQuizResultSchema>;
export type LegacyProgressExport = z.infer<typeof legacyProgressExportSchema>;
export type LegacyTeacherModule = z.infer<typeof legacyTeacherModuleSchema>;
export type QuizReportV2 = z.infer<typeof quizReportV2Schema>;
export type QuizReport = z.infer<typeof quizReportSchema>;
export type QuizReportPart = z.infer<typeof quizReportPartSchema>;

export type DecodedQrPayload =
  | { kind: 'student_profile'; version: 1; data: LegacyStudentProfile }
  | { kind: 'quiz_result'; version: 1; data: LegacyQuizResult }
  | { kind: 'quiz_result'; version: 2; data: QuizReportV2 }
  | { kind: 'quiz_report'; version: '1.0'; data: QuizReport | QuizReportPart }
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
  if (object.schemaVersion === '1.0') {
    if ('part' in object || 'report' in object) {
      return {
        kind: 'quiz_report',
        version: '1.0',
        data: quizReportPartSchema.parse(object),
      };
    }
    return {
      kind: 'quiz_report',
      version: '1.0',
      data: quizReportSchema.parse(object),
    };
  }
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

export function encodeQuizReportParts(args: {
  student: Student;
  module: { id: string };
  attempt: QuizAttempt;
  questions: QuizQuestion[];
  learningFormatUsed?: LearningFormat;
  maxPayloadCharacters?: number;
}): string[] {
  const maxPayloadCharacters = args.maxPayloadCharacters ?? 1_800;
  const questionById = new Map(args.questions.map((question) => [question.id, question]));
  const reportId = reportIdForAttempt(args.attempt.id);
  const timing = args.attempt.responses.map((response) => ({
    questionId: response.questionId,
    timeSeconds: Math.max(0, Math.round(response.elapsedMs / 1_000)),
  }));
  const missedQuestions = args.attempt.responses
    .filter((response) => !response.isCorrect)
    .map((response) => ({
      questionId: response.questionId,
      chosenAnswer: response.answer,
      correctAnswer: questionById.get(response.questionId)?.correctAnswer ?? '',
      timeSeconds: Math.max(0, Math.round(response.elapsedMs / 1_000)),
    }));
  const report: QuizReport = quizReportSchema.parse({
    schemaVersion: '1.0',
    reportId,
    studentId: args.student.id,
    moduleId: args.module.id,
    quizId: `${args.module.id}-quiz1`,
    attemptNumber: args.attempt.attemptNumber,
    completedAt: new Date(args.attempt.submittedAt).toISOString(),
    learningFormatUsed:
      args.learningFormatUsed ?? args.attempt.learningFormatUsed,
    score: {
      correct: args.attempt.score,
      total: args.attempt.totalItems,
      percentage: Math.round(
        (args.attempt.score / Math.max(1, args.attempt.totalItems)) * 100,
      ),
    },
    timing: {
      totalTimeSeconds: args.attempt.durationSeconds,
      perQuestion: timing,
    },
    missedQuestions,
  });

  const fullPayload = JSON.stringify(report);
  if (fullPayload.length <= maxPayloadCharacters) return [fullPayload];

  const units = report.timing.perQuestion.map((timingItem) => ({
    timing: timingItem,
    missed: report.missedQuestions.find(
      (item) => item.questionId === timingItem.questionId,
    ),
  }));
  const groups: typeof units[] = [];
  let current: typeof units = [];
  for (const unit of units) {
    const candidate = [...current, unit];
    const candidateReport = reportWithUnits(report, candidate);
    const estimated = JSON.stringify({
      schemaVersion: '1.0',
      reportId,
      part: 99,
      totalParts: 99,
      report: candidateReport,
    }).length;
    if (current.length > 0 && estimated > maxPayloadCharacters) {
      groups.push(current);
      current = [unit];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group, index) =>
    JSON.stringify(
      quizReportPartSchema.parse({
        schemaVersion: '1.0',
        reportId,
        part: index + 1,
        totalParts: groups.length,
        report: reportWithUnits(report, group),
      }),
    ),
  );
}

export function mergeQuizReportParts(parts: QuizReportPart[]): QuizReport {
  if (parts.length === 0) throw new Error('No QR report parts were supplied.');
  const first = parts[0]!;
  if (parts.some((part) => part.reportId !== first.reportId)) {
    throw new Error('These QR codes belong to different reports.');
  }
  if (parts.some((part) => part.totalParts !== first.totalParts)) {
    throw new Error('QR report part counts do not match.');
  }
  const byPart = new Map(parts.map((part) => [part.part, part]));
  if (byPart.size !== first.totalParts) {
    throw new Error(`Scan all ${first.totalParts} QR codes before importing.`);
  }
  const ordered = [...byPart.values()].sort((left, right) => left.part - right.part);
  const common = JSON.stringify({
    ...first.report,
    timing: { ...first.report.timing, perQuestion: [] },
    missedQuestions: [],
  });
  for (const part of ordered.slice(1)) {
    const candidate = JSON.stringify({
      ...part.report,
      timing: { ...part.report.timing, perQuestion: [] },
      missedQuestions: [],
    });
    if (candidate !== common) {
      throw new Error('QR report parts contain conflicting data.');
    }
  }
  return quizReportSchema.parse({
    ...first.report,
    timing: {
      ...first.report.timing,
      perQuestion: ordered.flatMap((part) => part.report.timing.perQuestion),
    },
    missedQuestions: ordered.flatMap((part) => part.report.missedQuestions),
  });
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

function reportWithUnits(
  report: QuizReport,
  units: Array<{
    timing: QuizReport['timing']['perQuestion'][number];
    missed: QuizReport['missedQuestions'][number] | undefined;
  }>,
): QuizReport {
  return quizReportSchema.parse({
    ...report,
    timing: {
      ...report.timing,
      perQuestion: units.map((unit) => unit.timing),
    },
    missedQuestions: units.flatMap((unit) =>
      unit.missed ? [unit.missed] : [],
    ),
  });
}

function reportIdForAttempt(attemptId: string): string {
  const match = attemptId.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  if (match) return match[0]!.toLocaleLowerCase();
  return randomUuidV4();
}

function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const digit = value === 'x' ? random : (random & 0x3) | 0x8;
    return digit.toString(16);
  });
}
