import { strToU8, zipSync } from 'fflate';
import { renderAdaptiveLesson, lessonImagePaths, type AdaptiveLesson } from './adaptiveLesson';
import { renderAssessmentGuide } from './assessmentGuide';
import {
  assessmentFingerprint,
  buildStudentQuiz,
  type QuizDefinition,
} from './assessmentModel';
import { renderModulePdf } from './modulePdf';
import { templateFitIssue, type AnswerSheetTemplate } from './omr';
import { renderAnswerSheetPdf, renderQuizPaperPdf } from './paperPdf';
import {
  buildPackage,
  teacherBundleIdFor,
  type PackageManifestDraft,
  type PackageManifestV2,
} from './packageV2';

export interface ModuleDraft {
  lesson: AdaptiveLesson;
  images: Record<string, { bytes: Uint8Array; mimeType: string }>;
}

export interface ExportBundleInput {
  packageId: string;
  version: number;
  title: string;
  gradeLevel: number;
  subject: string;
  author: { id: string; name: string };
  source: string;
  createdAt: string;
  attribution: PackageManifestDraft['attribution'];
  redistribution: PackageManifestDraft['redistribution'];
  provenance: PackageManifestDraft['provenance'];
  module?: ModuleDraft | null;
  quiz?: QuizDefinition | null;
  paper?: {
    template: AnswerSheetTemplate;
    sectionLabel: string;
    students?: Array<{ studentId: string; name: string; classNumber?: number | null }>;
  } | null;
  signerSecretKeyHex?: string;
}

export interface ExportBundle {
  fileName: string;
  zip: Uint8Array;
  files: Record<string, Uint8Array>;
  studentPackage: { fileName: string; archive: Uint8Array; manifest: PackageManifestV2 } | null;
  teacherPackage: { fileName: string; archive: Uint8Array; manifest: PackageManifestV2 };
}

/**
 * One versioned export per published module or assessment: printable and
 * Markdown artifacts for the teacher, a teacher bundle with the answer key,
 * and (for lessons and digital quizzes) a separate student package.
 */
export async function buildExportBundle(input: ExportBundleInput): Promise<ExportBundle> {
  const { module, quiz, paper } = input;
  if (!module && !quiz) throw new Error('Export a module, a quiz, or both.');
  if (quiz?.mode === 'paper_omr') {
    if (!paper) throw new Error('Choose an answer sheet for the paper quiz.');
    const issue = templateFitIssue(quiz, paper.template);
    if (issue) throw new Error(issue);
  }
  if (module) {
    for (const path of lessonImagePaths(module.lesson)) {
      if (!module.images[path]) throw new Error(`The lesson uses ${path}, which was not added.`);
    }
  }

  const competencies = [
    ...new Set([...(module?.lesson.competencies ?? []), ...(quiz?.questions.map((question) => question.competency) ?? [])]),
  ];
  const base = {
    title: input.title,
    author: input.author,
    source: input.source,
    gradeLevel: input.gradeLevel,
    subject: input.subject,
    competencies,
    createdAt: input.createdAt,
    attribution: input.attribution,
    provenance: input.provenance,
  };
  const assessmentFor = (forms: QuizDefinition['forms']) =>
    quiz
      ? {
          quizId: quiz.quizId,
          quizVersion: quiz.version,
          mode: quiz.mode,
          canonicalOrder: quiz.questions.map((question) => question.id),
          forms: forms.map((form) => ({ code: form.code, fingerprint: assessmentFingerprint(quiz, form) })),
        }
      : null;

  const lessonMarkdown = module ? strToU8(renderAdaptiveLesson(module.lesson)) : null;
  const imageFiles = Object.fromEntries(Object.entries(module?.images ?? {}).map(([path, image]) => [path, image.bytes]));
  const digital = quiz?.mode === 'digital_mini_quiz' ? quiz : null;

  let studentPackage: ExportBundle['studentPackage'] = null;
  if (module || digital) {
    const files: Record<string, Uint8Array> = { ...imageFiles };
    if (lessonMarkdown) files['adaptive-lesson.md'] = lessonMarkdown;
    if (digital) files['quiz.json'] = strToU8(JSON.stringify(buildStudentQuiz(digital), null, 2));
    const built = buildPackage({
      manifest: {
        ...base,
        packageId: input.packageId,
        version: input.version,
        packageType: module ? 'lesson' : 'quiz',
        audience: 'student',
        assessment: digital ? assessmentFor(digital.forms.slice(0, 1)) : null,
        redistribution: input.redistribution,
      },
      files,
      signerSecretKeyHex: input.signerSecretKeyHex,
    });
    studentPackage = { fileName: `${input.packageId}-v${input.version}.pavo-module`, ...built };
  }

  const modulePdf = module
    ? await renderModulePdf({
        lesson: module.lesson,
        images: module.images,
        metadata: {
          packageId: input.packageId,
          version: input.version,
          authorName: input.author.name,
          createdAt: input.createdAt,
          license: input.attribution.license,
          authors: input.attribution.authors,
          notice: input.attribution.notice,
          sourceUrl: input.attribution.sourceUrl,
        },
      })
    : null;
  const guide = quiz ? strToU8(renderAssessmentGuide(quiz)) : null;

  const teacherFiles: Record<string, Uint8Array> = { ...imageFiles };
  if (lessonMarkdown) teacherFiles['adaptive-lesson.md'] = lessonMarkdown;
  if (modulePdf) teacherFiles['module.pdf'] = modulePdf;
  if (guide && quiz) {
    teacherFiles['assessment-guide.md'] = guide;
    teacherFiles['quiz-definition.json'] = strToU8(JSON.stringify(quiz, null, 2));
  }
  if (paper) teacherFiles['answer-sheet-template.json'] = strToU8(JSON.stringify(paper.template, null, 2));
  const teacherBuilt = buildPackage({
    manifest: {
      ...base,
      packageId: teacherBundleIdFor(input.packageId),
      version: input.version,
      packageType: 'teacher_bundle',
      audience: 'teacher',
      assessment: quiz ? assessmentFor(quiz.forms) : null,
      redistribution: { studentToStudent: false, teacherToTeacher: input.redistribution.teacherToTeacher, expiresAt: null },
    },
    files: teacherFiles,
    signerSecretKeyHex: input.signerSecretKeyHex,
  });
  const teacherPackage = { fileName: `${input.packageId}-teacher-v${input.version}.pavo-module`, ...teacherBuilt };

  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(teacherBuilt.manifest, null, 2)),
    [`packages/${teacherPackage.fileName}`]: teacherPackage.archive,
  };
  if (lessonMarkdown) files['adaptive-lesson.md'] = lessonMarkdown;
  if (modulePdf) files['module.pdf'] = modulePdf;
  if (guide) files['assessment-guide.md'] = guide;
  if (studentPackage) files[`packages/${studentPackage.fileName}`] = studentPackage.archive;
  if (quiz?.mode === 'paper_omr' && paper) {
    files['answer-sheet-template.json'] = strToU8(JSON.stringify(paper.template, null, 2));
    for (const form of quiz.forms) {
      files[`paper/quiz-paper-form-${form.code}.pdf`] = await renderQuizPaperPdf(quiz, form.code, { sectionLabel: paper.sectionLabel });
      files[`paper/answer-sheet-form-${form.code}.pdf`] = await renderAnswerSheetPdf(paper.template, {
        quiz,
        formCode: form.code,
        sectionLabel: paper.sectionLabel,
      });
      if (paper.students?.length) {
        files[`paper/class-pack-form-${form.code}.pdf`] = await renderAnswerSheetPdf(paper.template, {
          quiz,
          formCode: form.code,
          sectionLabel: paper.sectionLabel,
          students: paper.students,
        });
      }
    }
    files['quiz-paper.pdf'] = files['paper/quiz-paper-form-A.pdf']!;
    files['answer-sheet.pdf'] = files['paper/answer-sheet-form-A.pdf']!;
  }

  return {
    fileName: `${input.packageId}-v${input.version}-export.zip`,
    zip: zipSync(files, { level: 6, mtime: new Date(Date.UTC(2020, 0, 1)) }),
    files,
    studentPackage,
    teacherPackage,
  };
}
