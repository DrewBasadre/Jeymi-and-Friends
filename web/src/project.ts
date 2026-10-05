import { lessonImagePaths, parseAdaptiveLesson, renderAdaptiveLesson, type AdaptiveLesson } from '@pavo/domain/adaptiveLesson';
import { DEFAULT_QUIZ_POLICY, stableIdSchema } from '@pavo/domain/assessmentModel';
import type { ExportBundleInput } from '@pavo/domain/exportBundle';
import { buildAnswerSheetTemplate, standardTemplate, templateFitIssue } from '@pavo/domain/omr';
import type { LICENSES } from '@pavo/domain/packageV2';
import { buildQuizFromDraft, type QuizDraftInput } from '@pavo/domain/quizAuthoring';
import { DEMO_PACKAGES } from '@pavo/domain/demoContent';

export type ProjectStatus = 'draft' | 'published' | 'exported';
export type SyncState = 'local' | 'syncing' | 'synced' | 'error';

export interface AiDraftRecord {
  artifact: 'lesson' | 'quiz';
  model: string;
  generatedAt: string;
  sourceIds: string[];
  approved: boolean;
  approvedAt: string | null;
  teacherEdited: boolean;
}

/** One versioned PAVO package being authored in the browser. */
export interface Project {
  id: string;
  version: number;
  title: string;
  gradeLevel: number;
  subject: string;
  competencies: string[];
  author: { id: string; name: string };
  license: (typeof LICENSES)[number];
  authors: string[];
  notice: string;
  sourceUrl: string | null;
  studentToStudent: boolean;
  teacherToTeacher: boolean;
  lesson: AdaptiveLesson | null;
  images: Record<string, { mimeType: string; bytes: Uint8Array }>;
  quiz: QuizDraftInput | null;
  paper: { sectionLabel: string; roster: string };
  aiDrafts: AiDraftRecord[];
  status: ProjectStatus;
  sync: SyncState;
  updatedAt: number;
  publishedAt: number | null;
  exportedAt: number | null;
}

export function newProject(author: { id: string; name: string }, now = Date.now()): Project {
  const id = `lesson-${now.toString(36)}`;
  return {
    id,
    version: 1,
    title: 'Untitled lesson',
    gradeLevel: 5,
    subject: 'Science',
    competencies: [],
    author,
    license: 'CC-BY-4.0',
    authors: [author.name],
    notice: 'Original lesson content written for PAVO.',
    sourceUrl: null,
    studentToStudent: true,
    teacherToTeacher: true,
    lesson: {
      lessonId: id,
      title: 'Untitled lesson',
      gradeLevel: 5,
      subject: 'Science',
      competencies: [],
      estimatedMinutes: 20,
      language: 'en',
      blocks: [
        { type: 'objective', id: 'objective-1', concept: null, markdown: 'Learners will be able to …' },
        { type: 'concept', id: 'concept-1', concept: null, markdown: 'Explain the main idea here.' },
        { type: 'checkpoint', id: 'checkpoint-1', concept: null, markdown: '', items: ['I can explain the main idea.'] },
      ],
    },
    images: {},
    quiz: null,
    paper: { sectionLabel: 'Grade 5', roster: '' },
    aiDrafts: [],
    status: 'draft',
    sync: 'local',
    updatedAt: now,
    publishedAt: null,
    exportedAt: null,
  };
}

/**
 * The shared demo library in three lifecycle states: exported (digital
 * mini-quiz), published (paper quiz), and a draft still being written.
 */
export function demoProjects(author: { id: string; name: string }, now = Date.now()): Project[] {
  const states: Array<Pick<Project, 'status' | 'publishedAt' | 'exportedAt'>> = [
    { status: 'exported', publishedAt: now - 3 * 86_400_000, exportedAt: now - 3 * 86_400_000 },
    { status: 'published', publishedAt: now - 86_400_000, exportedAt: null },
    { status: 'draft', publishedAt: null, exportedAt: null },
  ];
  return DEMO_PACKAGES.map((demo, index) => ({
    ...newProject(author, now),
    id: demo.id,
    title: demo.title,
    gradeLevel: demo.gradeLevel,
    subject: demo.subject,
    competencies: demo.competencies,
    authors: [author.name],
    notice: 'Original PAVO demo content.',
    lesson: demo.lesson,
    quiz: demo.quiz,
    paper: { sectionLabel: 'Grade 5 · Section Mabini', roster: '' },
    updatedAt: now - index * 3_600_000,
    ...states[index]!,
  }));
}

export function newQuizDraft(project: Pick<Project, 'id' | 'version' | 'title' | 'gradeLevel' | 'subject'>): QuizDraftInput {
  return {
    quizId: `${project.id}-quiz`,
    version: project.version,
    mode: null,
    title: `${project.title} check`,
    gradeLevel: project.gradeLevel,
    subject: project.subject,
    questions: [],
    policy: DEFAULT_QUIZ_POLICY,
    templateId: 'pavo-std-20x4',
    alternateForms: 0,
    retainScanImages: false,
    masterKey: null,
    forms: null,
  };
}

export interface ChecklistItem {
  label: string;
  ok: boolean;
  detail?: string;
}

/** Everything that must hold before a version can be published and exported. */
export function publishChecklist(project: Project): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const idCheck = stableIdSchema.safeParse(project.id);
  items.push({ label: 'Package ID uses letters, numbers, dot, dash, or underscore', ok: idCheck.success });
  items.push({ label: 'Title is set', ok: project.title.trim().length > 0 });
  items.push({ label: 'Has a lesson or an assessment', ok: Boolean(project.lesson || project.quiz) });
  if (project.lesson) {
    try {
      const lesson = parseAdaptiveLesson(renderAdaptiveLesson(syncLesson(project)));
      const missing = lessonImagePaths(lesson).filter((path) => !project.images[path]);
      items.push({ label: 'Lesson structure is valid', ok: true });
      items.push({ label: 'Every lesson image is attached', ok: missing.length === 0, detail: missing.join(', ') || undefined });
    } catch (error) {
      items.push({ label: 'Lesson structure is valid', ok: false, detail: error instanceof Error ? error.message : String(error) });
    }
  }
  if (project.quiz) {
    try {
      const quiz = buildQuizFromDraft(project.quiz, `teacher:${project.author.id}`, new Date().toISOString());
      items.push({ label: 'Assessment is valid', ok: true });
      if (quiz.mode === 'paper_omr') {
        const template = resolveTemplate(project.quiz.templateId);
        const issue = template ? templateFitIssue(quiz, template) : 'Choose an answer sheet.';
        items.push({ label: 'Questions fit the answer sheet', ok: !issue, detail: issue ?? undefined });
      }
    } catch (error) {
      items.push({ label: 'Assessment is valid', ok: false, detail: readableError(error) });
    }
  }
  const pending = project.aiDrafts.filter((draft) => !draft.approved);
  items.push({
    label: 'Teacher approved every AI draft',
    ok: pending.length === 0,
    detail: pending.length ? `${pending.length} AI draft${pending.length === 1 ? '' : 's'} still need review` : undefined,
  });
  items.push({ label: 'Attribution and license are set', ok: project.authors.length > 0 && Boolean(project.license) });
  return items;
}

export function canPublish(project: Project): boolean {
  return publishChecklist(project).every((item) => item.ok);
}

/** Keeps lesson metadata in step with the project details. */
export function syncLesson(project: Project): AdaptiveLesson {
  if (!project.lesson) throw new Error('This project has no lesson.');
  return {
    ...project.lesson,
    lessonId: project.id,
    title: project.title,
    gradeLevel: project.gradeLevel,
    subject: project.subject,
    competencies: project.competencies,
  };
}

export function resolveTemplate(templateId: string) {
  return standardTemplate(templateId);
}

export function exportInput(project: Project, createdAt = new Date().toISOString()): ExportBundleInput {
  const quiz = project.quiz
    ? buildQuizFromDraft({ ...project.quiz, version: project.version }, `teacher:${project.author.id}`, createdAt)
    : null;
  const template = quiz?.mode === 'paper_omr' ? resolveTemplate(project.quiz!.templateId) : null;
  const aiDrafts = project.aiDrafts;
  return {
    packageId: project.id,
    version: project.version,
    title: project.title,
    gradeLevel: project.gradeLevel,
    subject: project.subject,
    author: project.author,
    source: 'pavo-web',
    createdAt,
    attribution: { authors: project.authors, license: project.license, sourceUrl: project.sourceUrl, notice: project.notice },
    redistribution: { studentToStudent: project.studentToStudent, teacherToTeacher: project.teacherToTeacher, expiresAt: null },
    provenance: aiDrafts.length
      ? {
          aiAssisted: true,
          model: aiDrafts.at(-1)!.model,
          generatedAt: aiDrafts.at(-1)!.generatedAt,
          sourceIds: [...new Set(aiDrafts.flatMap((draft) => draft.sourceIds))],
          approvedBy: project.author.name,
          approvedAt: aiDrafts.at(-1)!.approvedAt,
          teacherEdited: aiDrafts.some((draft) => draft.teacherEdited),
        }
      : null,
    module: project.lesson ? { lesson: syncLesson(project), images: project.images } : null,
    quiz,
    paper:
      quiz?.mode === 'paper_omr' && template
        ? {
            template,
            sectionLabel: project.paper.sectionLabel || `Grade ${project.gradeLevel}`,
            students: rosterEntries(project.paper.roster),
          }
        : null,
  };
}

/** "Ana Santos" per line, in class-number order. */
export function rosterEntries(roster: string): Array<{ studentId: string; name: string; classNumber: number }> {
  return roster
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name, index) => ({ studentId: `class-${index + 1}`, name, classNumber: index + 1 }));
}

/** Starts the next version from an exported one; the old version stays immutable. */
export function nextVersion(project: Project, now = Date.now()): Project {
  return {
    ...project,
    version: project.version + 1,
    quiz: project.quiz ? { ...project.quiz, version: project.version + 1, forms: null } : null,
    aiDrafts: project.aiDrafts.map((draft) => ({ ...draft })),
    status: 'draft',
    sync: 'local',
    updatedAt: now,
    publishedAt: null,
    exportedAt: null,
  };
}

export function customTemplateId(questions: number, choices: number): string {
  return buildAnswerSheetTemplate({ questionCount: questions, choiceCount: choices }).templateId;
}

export function readableError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray((error as { issues: unknown[] }).issues)) {
    const issue = (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues[0];
    if (issue) {
      const question = issue.path[0] === 'questions' && typeof issue.path[1] === 'number' ? ` (question ${issue.path[1] + 1})` : '';
      return `${issue.message}${question}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}
