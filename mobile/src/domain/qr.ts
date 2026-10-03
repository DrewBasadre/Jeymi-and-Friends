import { z } from 'zod';
import type {
  AssignmentTask,
  LearningFormat,
  QuizAttempt,
  QuizQuestion,
  Student,
} from './types';
import { formatSectionLabel } from './section';

const isoDateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: 'Expected an ISO-8601 date and time.',
});

export const profileQrSchema = z.object({
  schemaVersion: z.literal('1.0'),
  qrType: z.literal('profile'),
  studentId: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  studentNumber: z.string().min(1).max(80),
  section: z.string().min(1).max(160),
  parentName: z.string().max(160).optional(),
  parentPhone: z.string().max(32).optional(),
  currentLearningFormat: z.enum(['text', 'audio', 'visual', 'kinesthetic']),
  /** Ed25519 public key that signs this learner's result QR codes. */
  devicePublicKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export const assignmentTaskSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('module'),
    moduleId: z.string().min(1).max(160),
    dueDate: z.string().date(),
  }),
  z.object({
    type: z.literal('quiz'),
    quizId: z.string().min(1).max(160),
    dueDate: z.string().date(),
  }),
]);

export const assignmentQrSchema = z.object({
  schemaVersion: z.literal('1.0'),
  qrType: z.literal('assignment'),
  issuedBy: z.string().min(1).max(160),
  issuedAt: isoDateTime,
  classSection: z.string().min(1).max(160),
  tasks: z.array(assignmentTaskSchema).min(1).max(40),
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

const quizReportObjectSchema = z.object({
    schemaVersion: z.literal('1.0'),
    qrType: z.literal('quizReport'),
    reportId: z.string().uuid(),
    studentId: z.string().min(1).max(160),
    moduleId: z.string().min(1).max(160),
    quizId: z.string().min(1).max(160),
    attemptNumber: z.number().int().positive(),
    completedAt: isoDateTime,
    learningFormatUsed: z.enum(['text', 'audio', 'visual', 'kinesthetic']),
    score: z.object({
      correct: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      percentage: z.number().int().min(0).max(100),
    }),
    timing: z.object({
      totalTimeSeconds: z.number().int().nonnegative(),
      perQuestion: z.array(questionTimingSchema).min(1),
    }),
    missedQuestions: z.array(missedQuestionSchema),
  });

function validateQuizReport(
  report: z.infer<typeof quizReportObjectSchema>,
  context: z.RefinementCtx,
  requireAllTiming: boolean,
): void {
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
    if (requireAllTiming && timingIds.length !== report.score.total) {
      context.addIssue({
        code: 'custom',
        path: ['timing', 'perQuestion'],
        message: 'Timing must be captured for every quiz question.',
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
}

export const quizReportSchema = quizReportObjectSchema.superRefine(
  (report, context) => validateQuizReport(report, context, true),
);

const quizReportFragmentSchema = quizReportObjectSchema.superRefine(
  (report, context) => validateQuizReport(report, context, false),
);

export const quizReportPartSchema = z.object({
  schemaVersion: z.literal('1.0'),
  qrType: z.literal('quizReport'),
  reportId: z.string().uuid(),
  part: z.number().int().positive(),
  totalParts: z.number().int().positive(),
  report: quizReportFragmentSchema,
});

export type ProfileQr = z.infer<typeof profileQrSchema>;
export type AssignmentQr = z.infer<typeof assignmentQrSchema>;
export type QuizReport = z.infer<typeof quizReportSchema>;
export type QuizReportPart = z.infer<typeof quizReportPartSchema>;

export type DecodedQrPayload =
  | { kind: 'profile'; data: ProfileQr }
  | { kind: 'assignment'; data: AssignmentQr }
  | { kind: 'quizReport'; data: QuizReport | QuizReportPart };

export function decodeQrPayload(raw: string): DecodedQrPayload {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim());
  } catch {
    throw new Error('QR payload must be valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('QR payload must be a JSON object.');
  }
  const object = value as Record<string, unknown>;
  if (object.schemaVersion !== '1.0') {
    throw new Error('Unsupported PAVO QR schema version.');
  }
  if (object.qrType === 'profile') {
    return { kind: 'profile', data: profileQrSchema.parse(object) };
  }
  if (object.qrType === 'assignment') {
    return { kind: 'assignment', data: assignmentQrSchema.parse(object) };
  }
  if (object.qrType === 'quizReport') {
    const data =
      'part' in object
        ? quizReportPartSchema.parse(object)
        : quizReportSchema.parse(object);
    return { kind: 'quizReport', data };
  }
  throw new Error('Unsupported PAVO QR type.');
}

export function encodeProfileQr(args: {
  student: Student;
  currentLearningFormat: LearningFormat;
  devicePublicKey?: string | null;
}): string {
  return JSON.stringify(
    profileQrSchema.parse({
      schemaVersion: '1.0',
      qrType: 'profile',
      studentId: args.student.id,
      name: args.student.displayName,
      studentNumber: args.student.studentNumber,
      section: formatSectionLabel(
        args.student.gradeLevel,
        args.student.section,
      ),
      parentName: args.student.parentName,
      parentPhone: args.student.parentPhone,
      currentLearningFormat: args.currentLearningFormat,
      ...(args.devicePublicKey ? { devicePublicKey: args.devicePublicKey } : {}),
    }),
  );
}

export function encodeAssignmentQr(args: {
  teacherId: string;
  classSection: string;
  tasks: AssignmentTask[];
  issuedAt?: string;
}): string {
  return JSON.stringify(
    assignmentQrSchema.parse({
      schemaVersion: '1.0',
      qrType: 'assignment',
      issuedBy: args.teacherId,
      issuedAt: args.issuedAt ?? new Date().toISOString(),
      classSection: args.classSection,
      tasks: args.tasks.map((task) =>
        task.type === 'module'
          ? { type: task.type, moduleId: task.moduleId, dueDate: task.dueDate }
          : { type: task.type, quizId: task.quizId, dueDate: task.dueDate },
      ),
    }),
  );
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
  const reportId = reportIdForAttempt(args.attempt.id);
  const report: QuizReport = quizReportSchema.parse({
    schemaVersion: '1.0',
    qrType: 'quizReport',
    reportId,
    studentId: args.student.id,
    moduleId: args.module.id,
    quizId: `${args.module.id}-quiz1`,
    attemptNumber: args.attempt.attemptNumber,
    completedAt: new Date(args.attempt.submittedAt).toISOString(),
    learningFormatUsed: args.learningFormatUsed ?? args.attempt.learningFormatUsed,
    score: {
      correct: args.attempt.score,
      total: args.attempt.totalItems,
      percentage: Math.round(
        (args.attempt.score / Math.max(1, args.attempt.totalItems)) * 100,
      ),
    },
    timing: {
      totalTimeSeconds: args.attempt.durationSeconds,
      perQuestion: args.attempt.responses.map((response) => ({
        questionId: response.questionId,
        timeSeconds: Math.max(0, Math.round(response.elapsedMs / 1_000)),
      })),
    },
    // Never put the answer key or the learner's answer text in a QR code.
    missedQuestions: args.attempt.responses
      .filter((response) => !response.isCorrect)
      .map((response) => ({
        questionId: response.questionId,
        chosenAnswer: '',
        correctAnswer: '',
        timeSeconds: Math.max(0, Math.round(response.elapsedMs / 1_000)),
      })),
  });

  const fullPayload = JSON.stringify(report);
  if (fullPayload.length <= maxPayloadCharacters) return [fullPayload];

  const units = report.timing.perQuestion.map((timing) => ({
    timing,
    missed: report.missedQuestions.find(
      (item) => item.questionId === timing.questionId,
    ),
  }));
  const groups: typeof units[] = [];
  let current: typeof units = [];
  for (const unit of units) {
    const candidate = [...current, unit];
    const candidateReport = reportWithUnits(report, candidate);
    const estimated = JSON.stringify({
      schemaVersion: '1.0',
      qrType: 'quizReport',
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
        qrType: 'quizReport',
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

function reportWithUnits(
  report: QuizReport,
  units: Array<{
    timing: QuizReport['timing']['perQuestion'][number];
    missed: QuizReport['missedQuestions'][number] | undefined;
  }>,
): QuizReport {
  return {
    ...report,
    timing: {
      ...report.timing,
      perQuestion: units.map((unit) => unit.timing),
    },
    missedQuestions: units.flatMap((unit) => (unit.missed ? [unit.missed] : [])),
  };
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
