import { z } from 'zod';
import type {
  BundledQuizQuestion,
  CurriculumModuleManifest,
  LearningPackageManifest,
  ReviewItem,
  StudyPackageManifest,
} from './types';

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

export const moduleManifestSchema: z.ZodType<CurriculumModuleManifest> = z.preprocess(
  (value) =>
    value && typeof value === 'object' && !('contentCategory' in value)
      ? { ...value, contentCategory: 'teacherModule' }
      : value,
  z.object({
  moduleId: z.string().min(1),
  version: z.number().int().positive(),
  contentCategory: z.literal('teacherModule'),
  source: z.enum(['supabase-ota', 'teacher-bluetooth', 'seed-bundle']),
  gradeLevel: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  content: z.object({
    markdown: safePackagePath('.md'),
    audio: safePackagePath('.mp3').optional(),
  }),
  assets: z.array(safePackagePath('.webp')),
  checksums: z.record(z.string(), z.string().regex(/^sha256:[a-f0-9]{64}$/i)),
  quizId: z.string().min(1),
  reviewItems: z.array(reviewItemSchema).optional(),
}).superRefine((manifest, context) => {
  const requiredFiles = [
    manifest.content.markdown,
    ...(manifest.content.audio ? [manifest.content.audio] : []),
    ...manifest.assets,
  ];
  for (const path of requiredFiles) {
    if (!manifest.checksums[path]) {
      context.addIssue({
        code: 'custom',
        message: `Missing checksum for ${path}.`,
        path: ['checksums', path],
      });
    }
  }
}),
);

export const bundledQuizQuestionSchema: z.ZodType<BundledQuizQuestion> =
  z
    .object({
      questionId: z.string().min(1),
      type: z.enum([
        'multiple-choice',
        'fill-in-the-blank',
        'identification',
      ]),
      prompt: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).optional(),
      correctAnswer: z.string().min(1),
      conceptId: z.string().min(1),
    })
    .superRefine((question, context) => {
      if (
        question.type === 'multiple-choice' &&
        !question.options?.includes(question.correctAnswer)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['options'],
          message:
            'Multiple-choice options must include the correct answer.',
        });
      }
      if (
        question.type !== 'multiple-choice' &&
        question.options !== undefined
      ) {
        context.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'Options only apply to multiple-choice questions.',
        });
      }
    });

export const bundledQuizSchema = z.array(bundledQuizQuestionSchema).min(3);

export const studyPackageManifestSchema: z.ZodType<StudyPackageManifest> =
  z
    .object({
      packageId: z.string().min(1),
      version: z.number().int().positive(),
      contentCategory: z.enum([
        'teacherQuiz',
        'teacherReviewer',
        'studentMaterial',
      ]),
      title: z.string().trim().min(1).max(160),
      reviewItems: z.array(reviewItemSchema).max(100),
      quiz: z
        .object({
          questions: z.array(bundledQuizQuestionSchema).min(1).max(40),
        })
        .optional(),
      createdBy: z.string().min(1),
      sharedBy: z.array(z.string().min(1)).max(100),
      createdAt: z.string().datetime(),
    })
    .superRefine((manifest, context) => {
      if (manifest.contentCategory === 'teacherQuiz' && !manifest.quiz) {
        context.addIssue({
          code: 'custom',
          path: ['quiz'],
          message: 'Teacher quiz packages must include quiz questions.',
        });
      }
    });

export function parseModuleManifest(value: unknown): CurriculumModuleManifest {
  return moduleManifestSchema.parse(value);
}

export function parseLearningPackageManifest(
  value: unknown,
): LearningPackageManifest {
  if (
    value &&
    typeof value === 'object' &&
    'contentCategory' in value &&
    value.contentCategory !== 'teacherModule'
  ) {
    return studyPackageManifestSchema.parse(value);
  }
  return parseModuleManifest(value);
}

export function buildMarkdownManifest(args: {
  moduleId: string;
  source: CurriculumModuleManifest['source'];
  gradeLevel: number;
  subject: string;
  markdownPath: string;
  audioPath?: string;
  assetPaths?: string[];
  checksums: Record<string, string>;
  reviewItems?: ReviewItem[];
}): CurriculumModuleManifest {
  return moduleManifestSchema.parse({
    moduleId: args.moduleId,
    version: 1,
    contentCategory: 'teacherModule',
    source: args.source,
    gradeLevel: args.gradeLevel,
    subject: args.subject,
    content: {
      markdown: args.markdownPath,
      ...(args.audioPath ? { audio: args.audioPath } : {}),
    },
    assets: args.assetPaths ?? [],
    checksums: args.checksums,
    quizId: `${args.moduleId}-quiz1`,
    ...(args.reviewItems?.length ? { reviewItems: args.reviewItems } : {}),
  });
}

function safePackagePath(extension: string) {
  return z.string().min(1).refine(
    (value) => {
      const segments = value.split('/');
      return (
        !value.startsWith('/') &&
        !value.includes('\\') &&
        segments.every(
          (segment) =>
            segment.length > 0 &&
            segment !== '.' &&
            segment !== '..' &&
            /^[a-zA-Z0-9._-]+$/.test(segment),
        ) &&
        value.toLocaleLowerCase().endsWith(extension)
      );
    },
    `Expected a safe ${extension} package path.`,
  );
}
