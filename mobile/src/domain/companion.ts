import { z } from 'zod';
import type {
  LearningModule,
  StudentDashboard,
  StudentTask,
} from './types';

export type CompanionIntent = 'performance_report' | 'review_lessons' | 'ask';
export type CompanionActivity =
  | 'lesson'
  | 'flashcards'
  | 'quiz'
  | 'mixed_practice';

export interface CompanionRequest {
  intent: CompanionIntent;
  activity: CompanionActivity;
  gradeLevel: number;
  question?: string;
  modules: Array<{
    id: string;
    title: string;
    subject: string;
    competencyCode: string;
    summary: string;
    content: string;
  }>;
  performance: {
    completedModules: number;
    totalModules: number;
    averageScore: number;
    totalAttempts: number;
    dueReviews: number;
    weakTopic: string;
    strongTopic: string;
  };
  deadlines: Array<{
    type: StudentTask['type'];
    targetId: string;
    title: string;
    dueDate: string;
  }>;
}

const companionQuestionSchema = z
  .string()
  .trim()
  .min(3, 'Write at least three characters so Pavo can help.')
  .max(500, 'Keep your question under 500 characters.');

const unsafeLocalPatterns = [
  /\b(?:home|street|email|phone|mobile)\s+(?:address|number)\b/i,
  /\b(?:send|share|tell)\s+(?:me\s+)?(?:your|my)\s+(?:address|phone|email|password|pin)\b/i,
  /\b(?:meet\s+me|come\s+to\s+my\s+house)\b/i,
  /\b(?:make|build|hide)\s+(?:a\s+)?(?:bomb|weapon|gun)\b/i,
  /\b(?:nude|porn|explicit\s+sex)\b/i,
] as const;

export function validateCompanionQuestion(question: string): string | null {
  const parsed = companionQuestionSchema.safeParse(question);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Check your question.';
  if (unsafeLocalPatterns.some((pattern) => pattern.test(parsed.data))) {
    return 'That request is not safe to share here. Ask a trusted adult for help.';
  }
  return null;
}

export function buildCompanionRequest(args: {
  intent: CompanionIntent;
  activity: CompanionActivity;
  gradeLevel: number;
  question?: string;
  selectedModuleIds: string[];
  modules: LearningModule[];
  dashboard: StudentDashboard;
  tasks: StudentTask[];
}): CompanionRequest {
  const selected = new Set(args.selectedModuleIds.slice(0, 4));
  const moduleTitles = new Map(
    args.modules.map((module) => [module.id, module.title]),
  );
  return {
    intent: args.intent,
    activity: args.activity,
    gradeLevel: Math.max(1, Math.min(12, Math.round(args.gradeLevel))),
    question: args.question?.trim() || undefined,
    modules: args.modules
      .filter((module) => selected.has(module.id))
      .slice(0, 4)
      .map((module) => ({
        id: module.id,
        title: module.title,
        subject: module.subject,
        competencyCode: module.competencyCode,
        summary: module.summary.slice(0, 800),
        content: module.content.slice(0, 6000),
      })),
    performance: {
      completedModules: args.dashboard.completedModules,
      totalModules: args.dashboard.totalModules,
      averageScore: Math.round(args.dashboard.averageScore),
      totalAttempts: args.dashboard.totalAttempts,
      dueReviews: args.dashboard.dueReviews,
      weakTopic: args.dashboard.weakTopic,
      strongTopic: args.dashboard.strongTopic,
    },
    deadlines: args.tasks
      .filter((task) => !task.completedAt)
      .slice(0, 8)
      .map((task) => ({
        type: task.type,
        targetId: task.targetId,
        title: moduleTitles.get(task.targetId) ?? 'Assigned learning activity',
        dueDate: task.dueDate,
      })),
  };
}

const flashcardSchema = z.object({
  front: z.string().min(1).max(300),
  back: z.string().min(1).max(700),
});

const questionSchema = z
  .object({
    prompt: z.string().min(1).max(600),
    options: z.array(z.string().min(1).max(240)).min(2).max(4),
    correctOption: z.number().int().min(0).max(3),
    explanation: z.string().min(1).max(700),
  })
  .refine((question) => question.correctOption < question.options.length, {
    message: 'Correct option must refer to a provided choice.',
    path: ['correctOption'],
  });

export const companionResponseSchema = z.object({
  kind: z.enum(['report', 'lesson', 'flashcards', 'quiz', 'mixed']),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(900),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(100),
        body: z.string().min(1).max(1200),
      }),
    )
    .max(6),
  flashcards: z.array(flashcardSchema).max(12),
  questions: z.array(questionSchema).max(10),
  nextStep: z.string().min(1).max(300),
});

export type CompanionResponse = z.infer<typeof companionResponseSchema>;
