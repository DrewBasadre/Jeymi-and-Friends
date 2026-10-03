import { strFromU8 } from 'fflate';
import { lessonFromMarkdown, parseAdaptiveLesson, type AdaptiveLesson, type LessonBlock } from '@pavo/domain/adaptiveLesson';
import { assessmentQuestionSchema, parseQuizDefinition, type AssessmentQuestion } from '@pavo/domain/assessmentModel';
import type { CompanionResponse } from '@pavo/domain/companion';
import { readPackage, studentPackageIdFor } from '@pavo/domain/packageV2';
import type { QuizDraftInput } from '@pavo/domain/quizAuthoring';
import { newQuizDraft, type Project } from './project';

/** AI output becomes an editable lesson; nothing is published until the teacher approves it. */
export function lessonFromAiDraft(draft: CompanionResponse, project: Pick<Project, 'id' | 'title' | 'gradeLevel' | 'subject' | 'competencies'>): AdaptiveLesson {
  const blocks: LessonBlock[] = [
    { type: 'objective', id: 'objective-1', concept: null, markdown: draft.summary || `Learn about ${draft.title}.` },
    ...draft.sections.map((section, index): LessonBlock => ({
      type: /example/i.test(section.heading) ? 'worked-example' : /practice|activity|try/i.test(section.heading) ? 'practice' : 'concept',
      id: `section-${index + 1}`,
      concept: null,
      markdown: `### ${section.heading}\n\n${section.body}`,
    })),
    ...draft.questions.slice(0, 3).map((question, index): LessonBlock => ({
      type: 'check',
      id: `check-${index + 1}`,
      concept: null,
      markdown: '',
      check: {
        prompt: question.prompt,
        choices: question.options.map((text, choice) => ({ text, correct: choice === question.correctOption })),
        answer: null,
        explanation: question.explanation,
      },
    })),
    { type: 'checkpoint', id: 'checkpoint-1', concept: null, markdown: '', items: [draft.nextStep || `I can explain ${draft.title}.`] },
  ];
  return {
    lessonId: project.id,
    title: project.title,
    gradeLevel: project.gradeLevel,
    subject: project.subject,
    competencies: project.competencies,
    estimatedMinutes: 20,
    language: 'en',
    blocks,
  };
}

export function questionsFromAiDraft(draft: CompanionResponse, prefix: string, competency: string): AssessmentQuestion[] {
  return draft.questions.map((question, index) =>
    assessmentQuestionSchema.parse({
      id: `${prefix}-ai-${index + 1}`,
      kind: 'multiple_choice',
      prompt: question.prompt,
      choices: question.options,
      answer: question.options[question.correctOption] ?? question.options[0],
      acceptedAnswers: [],
      rationale: question.explanation,
      topic: draft.title.slice(0, 120) || 'General',
      competency: competency || 'Teacher competency',
      difficulty: 'medium',
      points: 1,
    }),
  );
}

export type ImportResult =
  | { kind: 'lesson'; lesson: AdaptiveLesson; message: string }
  | { kind: 'quiz'; quiz: QuizDraftInput; message: string }
  | { kind: 'questions'; questions: AssessmentQuestion[]; message: string }
  | {
      kind: 'project';
      lesson: AdaptiveLesson | null;
      images: Project['images'];
      quiz: QuizDraftInput | null;
      packageId: string;
      version: number;
      title: string;
      message: string;
    };

/** Supported imports: Markdown or text lessons, quiz JSON, and PAVO teacher bundles. */
export function importFile(name: string, bytes: Uint8Array, project: Project): ImportResult {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
    const text = strFromU8(bytes);
    if (text.startsWith('---\npavo: adaptive-lesson')) {
      return { kind: 'lesson', lesson: parseAdaptiveLesson(text), message: 'Imported an adaptive lesson.' };
    }
    const markdown = lower.endsWith('.txt') ? text.split(/\n{2,}/).map((paragraph, index) => (index === 0 ? `# ${paragraph.trim()}` : paragraph)).join('\n\n') : text;
    return {
      kind: 'lesson',
      lesson: lessonFromMarkdown({ lessonId: project.id, title: project.title, gradeLevel: project.gradeLevel, subject: project.subject, markdown }),
      message: 'Imported the text as lesson sections. Review the objective and checkpoint.',
    };
  }
  if (lower.endsWith('.json')) {
    const value: unknown = JSON.parse(strFromU8(bytes));
    if (Array.isArray(value)) {
      const questions = value.map((item) => assessmentQuestionSchema.parse(item));
      return { kind: 'questions', questions, message: `Imported ${questions.length} questions.` };
    }
    const quiz = parseQuizDefinition(value);
    return {
      kind: 'quiz',
      quiz: {
        ...newQuizDraft(project),
        quizId: quiz.quizId,
        mode: quiz.mode,
        title: quiz.title,
        questions: quiz.questions,
        policy: quiz.policy ?? newQuizDraft(project).policy,
        templateId: quiz.paper?.templateId ?? 'pavo-std-20x4',
        alternateForms: quiz.forms.length - 1,
        retainScanImages: quiz.paper?.retainScanImages ?? false,
      },
      message: `Imported quiz ${quiz.title} (version ${quiz.version}). It will be saved as version ${project.version}.`,
    };
  }
  if (lower.endsWith('.pavo-module')) {
    const read = readPackage(bytes);
    if (read.manifest.packageType !== 'teacher_bundle') {
      throw new Error('Import the teacher bundle (it holds the answer key); student packages cannot be edited.');
    }
    const lessonText = read.files['adaptive-lesson.md'];
    const definition = read.files['quiz-definition.json'];
    const images: Project['images'] = {};
    for (const file of read.manifest.files) {
      if (file.mimeType.startsWith('image/')) images[file.path] = { mimeType: file.mimeType, bytes: read.files[file.path]! };
    }
    const quiz = definition ? parseQuizDefinition(JSON.parse(strFromU8(definition))) : null;
    return {
      kind: 'project',
      packageId: studentPackageIdFor(read.manifest.packageId),
      version: read.manifest.version + 1,
      title: read.manifest.title,
      lesson: lessonText ? parseAdaptiveLesson(strFromU8(lessonText)) : null,
      images,
      quiz: quiz
        ? {
            ...newQuizDraft(project),
            quizId: quiz.quizId,
            version: read.manifest.version + 1,
            mode: quiz.mode,
            title: quiz.title,
            questions: quiz.questions,
            policy: quiz.policy ?? newQuizDraft(project).policy,
            templateId: quiz.paper?.templateId ?? 'pavo-std-20x4',
            alternateForms: quiz.forms.length - 1,
            retainScanImages: quiz.paper?.retainScanImages ?? false,
          }
        : null,
      message: `Opened ${read.manifest.title} as a draft of version ${read.manifest.version + 1}. Version ${read.manifest.version} stays unchanged.`,
    };
  }
  throw new Error('Supported files: .md, .txt, .json (quiz or questions), and .pavo-module teacher bundles.');
}
