import { z } from 'zod';
import type { CurriculumModuleManifest, ReviewItem } from './types';

const reviewItemSchema: z.ZodType<ReviewItem> = z.object({
  itemId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleVersion: z.number().int().positive(),
  conceptId: z.string().min(1),
  type: z.enum(['flashcard', 'quiz-question', 'concept-summary']),
  importance: z.enum(['core', 'supplementary', 'stretch']),
  prompt: z.string().min(1),
  answer: z.string().min(1),
  formats: z.object({
    text: z.string().optional(),
    audio: z.string().optional(),
    visual: z.string().optional(),
  }),
  authoredBy: z.string().min(1),
  tags: z.array(z.string()),
});

export const moduleManifestSchema: z.ZodType<CurriculumModuleManifest> = z.object({
  moduleId: z.string().min(1),
  version: z.number().int().positive(),
  source: z.enum(['supabase-ota', 'teacher-bluetooth', 'bundled']),
  gradeLevel: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  formats: z.object({
    text: z.string().optional(),
    audio: z.string().optional(),
    visual: z.string().optional(),
  }),
  checksums: z.record(z.string(), z.string().regex(/^sha256:[a-f0-9]{64}$/i)),
  quizId: z.string().min(1),
  reviewItems: z.array(reviewItemSchema),
});

export function parseModuleManifest(value: unknown): CurriculumModuleManifest {
  return moduleManifestSchema.parse(value);
}

export function buildPdfManifest(args: {
  moduleId: string;
  fileName: string;
  sha256: string;
  source: CurriculumModuleManifest['source'];
  gradeLevel: number;
  subject: string;
  reviewItems?: ReviewItem[];
}): CurriculumModuleManifest {
  return moduleManifestSchema.parse({
    moduleId: args.moduleId,
    version: 1,
    source: args.source,
    gradeLevel: args.gradeLevel,
    subject: args.subject,
    formats: { text: args.fileName },
    checksums: { [args.fileName]: `sha256:${args.sha256.toLocaleLowerCase()}` },
    quizId: `${args.moduleId}-quiz1`,
    reviewItems: args.reviewItems ?? [],
  });
}
