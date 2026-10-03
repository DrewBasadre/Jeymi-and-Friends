import { describe, expect, it } from '@jest/globals';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import {
  LESSON_BLOCK_TYPES,
  checkAnswer,
  lessonFromMarkdown,
  parseAdaptiveLesson,
  renderAdaptiveLesson,
} from '../src/domain/adaptiveLesson';
import { parseAssessmentGuide } from '../src/domain/assessmentGuide';
import { buildExportBundle, type ExportBundleInput } from '../src/domain/exportBundle';
import { standardTemplate } from '../src/domain/omr';
import {
  PackageError,
  buildPackage,
  readPackage,
  redistributionDecision,
  studentPackageIdFor,
  type PackageManifestDraft,
} from '../src/domain/packageV2';
import { createDeviceIdentity } from '../src/domain/resultQr';
import { studentQuizSchema } from '../src/domain/assessmentModel';
import { PHOTOSYNTHESIS_LESSON, TINY_PNG } from './fixtures/lessons';
import { digitalQuiz, paperQuiz } from './fixtures/quizzes';

const NOW = Date.UTC(2026, 9, 4);

const draft: PackageManifestDraft = {
  packageId: 'plants-food',
  version: 1,
  packageType: 'lesson',
  audience: 'student',
  title: 'How plants make food',
  author: { id: 'teacher_demo', name: 'Ms. Reyes' },
  source: 'pavo-web',
  gradeLevel: 5,
  subject: 'Science',
  competencies: ['S5LT-IIa-1'],
  assessment: null,
  createdAt: '2026-10-04T08:00:00.000Z',
  attribution: { authors: ['Ms. Reyes'], license: 'CC-BY-4.0', sourceUrl: null, notice: 'Original PAVO demo content.' },
  redistribution: { studentToStudent: true, teacherToTeacher: true, expiresAt: null },
  provenance: null,
};

const lessonFiles = () => ({ 'adaptive-lesson.md': strToU8(PHOTOSYNTHESIS_LESSON), 'images/leaf.png': TINY_PNG });

function rezip(archive: Uint8Array, edit: (entries: Record<string, Uint8Array>) => void): Uint8Array {
  const entries = unzipSync(archive);
  edit(entries);
  return zipSync(entries);
}

describe('adaptive-lesson.md', () => {
  it('parses every block type and round-trips', () => {
    const lesson = parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON);
    expect(new Set(lesson.blocks.map((block) => block.type))).toEqual(new Set(LESSON_BLOCK_TYPES));
    expect(lesson.competencies).toEqual(['S5LT-IIa-1', 'S5LT-IIa-2']);
    const hints = lesson.blocks.find((block) => block.type === 'hints');
    expect(hints?.hints).toHaveLength(3);
    const check = lesson.blocks.find((block) => block.id === 'check-1')!;
    expect(check.check?.choices.map((choice) => choice.correct)).toEqual([false, true, false]);
    expect(checkAnswer(check, 1)).toBe(true);
    expect(checkAnswer(lesson.blocks.find((block) => block.id === 'check-2')!, ' Carbon  Dioxide ')).toBe(true);
    expect(lesson.blocks.find((block) => block.type === 'remediation')?.concept).toBe('photosynthesis');
    expect(parseAdaptiveLesson(renderAdaptiveLesson(lesson))).toEqual(lesson);
  });

  it('rejects malformed lessons with a precise message', () => {
    expect(() => parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON.replace('::: checkpoint {id="done"}', '::: quiz {id="done"}'))).toThrow('Unknown lesson block "quiz"');
    expect(() => parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON.replace('image="images/leaf.png"', 'image="../secret.png"'))).toThrow('safe image path');
    expect(() => parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON.replace('- [x] Leaf', '- [ ] Leaf'))).toThrow('correct choice');
    expect(() => parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON.replace(/::: checkpoint[\s\S]*$/, ''))).toThrow('completion checkpoint');
    expect(() => parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON.replace('Explain how leaves use sunlight, water, and carbon dioxide to make food.\n:::', 'Explain'))).toThrow();
  });

  it('wraps legacy Markdown modules as a mastery sequence', () => {
    const lesson = lessonFromMarkdown({
      lessonId: 'legacy',
      title: 'Fractions',
      gradeLevel: 4,
      subject: 'Math',
      markdown: '# Fractions\n\n## Parts of a whole\n\nA fraction names equal parts.\n\n## Comparing\n\nUse the same denominator.',
    });
    expect(lesson.blocks.map((block) => block.type)).toEqual(['objective', 'concept', 'concept', 'checkpoint']);
    expect(parseAdaptiveLesson(renderAdaptiveLesson(lesson)).blocks).toHaveLength(4);
  });
});

describe('PAVO package v2', () => {
  it('builds, lists checksums for every file, and reads back', () => {
    const { archive, manifest } = buildPackage({ manifest: draft, files: lessonFiles() });
    expect(manifest.files.map((file) => [file.path, file.mimeType])).toEqual([
      ['adaptive-lesson.md', 'text/markdown'],
      ['images/leaf.png', 'image/png'],
    ]);
    expect(manifest.contentBytes).toBe(PHOTOSYNTHESIS_LESSON.length + TINY_PNG.byteLength);
    const read = readPackage(archive, { now: NOW, audience: 'student' });
    expect(read.signature).toBe('unsigned');
    expect(strFromU8(read.files['adaptive-lesson.md']!)).toBe(PHOTOSYNTHESIS_LESSON);
  });

  it('rejects tampering, extra files, traversal, unsupported types, and legacy archives', () => {
    const { archive } = buildPackage({ manifest: draft, files: lessonFiles() });
    const code = (bytes: Uint8Array) => {
      try {
        readPackage(bytes, { now: NOW });
        return 'ok';
      } catch (error) {
        return error instanceof PackageError ? error.code : String(error);
      }
    };
    expect(code(rezip(archive, (entries) => (entries['adaptive-lesson.md'] = strToU8('# changed'))))).toBe('integrity');
    expect(code(rezip(archive, (entries) => (entries['images/extra.png'] = TINY_PNG)))).toBe('integrity');
    expect(code(rezip(archive, (entries) => (entries['../escape.md'] = strToU8('x'))))).toBe('unsafe_path');
    expect(code(rezip(archive, (entries) => (entries['payload.html'] = strToU8('<script>'))))).toBe('unsupported_file');
    expect(code(zipSync({ 'manifest.json': strToU8('{"moduleId":"old"}') }))).toBe('legacy_format');
    expect(code(zipSync({ 'notes.md': strToU8('x') }))).toBe('missing_manifest');
    expect(code(zipSync({ 'big.md': new Uint8Array(3 * 1_024 * 1_024), 'manifest.json': strToU8('{}') }))).toBe('too_large');
  });

  it('enforces expiry, minimum version, and audience', () => {
    const expiring = buildPackage({
      manifest: { ...draft, redistribution: { ...draft.redistribution, expiresAt: '2026-10-01T00:00:00.000Z' } },
      files: lessonFiles(),
    });
    expect(() => readPackage(expiring.archive, { now: NOW })).toThrow('expired');
    const future = buildPackage({ manifest: { ...draft, minPavoVersion: '3.1.0' }, files: lessonFiles() });
    expect(() => readPackage(future.archive, { now: NOW })).toThrow('3.1.0');
    expect(() =>
      buildPackage({
        manifest: { ...draft, audience: 'student' },
        files: { ...lessonFiles(), 'assessment-guide.md': strToU8('key') },
      }),
    ).toThrow('Student packages cannot contain assessment-guide.md');
  });

  it('verifies teacher signatures and rejects signed packages that were altered', () => {
    const teacher = createDeviceIdentity(new Uint8Array(32).fill(3));
    const signed = buildPackage({ manifest: draft, files: lessonFiles(), signerSecretKeyHex: teacher.secretKeyHex });
    const read = readPackage(signed.archive, { now: NOW });
    expect(read.signature).toBe('signed');
    expect(read.signerKeyId).toBe(teacher.keyId);
    const relicensed = rezip(signed.archive, (entries) => {
      const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
      manifest.attribution.license = 'CC0-1.0';
      entries['manifest.json'] = strToU8(JSON.stringify(manifest));
    });
    expect(() => readPackage(relicensed, { now: NOW })).toThrow('signature');
  });

  it('applies redistribution rules for each direction', () => {
    const open = { audience: 'student' as const, packageType: 'lesson' as const, redistribution: draft.redistribution };
    expect(redistributionDecision(open, 'teacher', 'student', NOW)).toEqual({ allowed: true });
    expect(redistributionDecision(open, 'student', 'student', NOW)).toEqual({ allowed: true });
    const closed = { ...open, redistribution: { ...draft.redistribution, studentToStudent: false } };
    expect(redistributionDecision(closed, 'student', 'student', NOW).allowed).toBe(false);
    const bundle = { audience: 'teacher' as const, packageType: 'teacher_bundle' as const, redistribution: { studentToStudent: false, teacherToTeacher: true, expiresAt: null } };
    expect(redistributionDecision(bundle, 'teacher', 'student', NOW).allowed).toBe(false);
    expect(redistributionDecision(bundle, 'teacher', 'teacher', NOW)).toEqual({ allowed: true });
    expect(redistributionDecision(open, 'student', 'teacher', NOW).allowed).toBe(false);
  });
});

describe('teacher export bundle', () => {
  const baseInput = (): ExportBundleInput => ({
    packageId: 'plants-food',
    version: 3,
    title: 'How plants make food',
    gradeLevel: 5,
    subject: 'Science',
    author: { id: 'teacher_demo', name: 'Ms. Reyes' },
    source: 'pavo-web',
    createdAt: '2026-10-04T08:00:00.000Z',
    attribution: draft.attribution,
    redistribution: draft.redistribution,
    provenance: null,
    module: {
      lesson: parseAdaptiveLesson(PHOTOSYNTHESIS_LESSON),
      images: { 'images/leaf.png': { bytes: TINY_PNG, mimeType: 'image/png' } },
    },
  });

  it('exports module.pdf, both Markdown files, a manifest, and separate student and teacher packages', async () => {
    const bundle = await buildExportBundle({ ...baseInput(), quiz: digitalQuiz() });
    expect(bundle.fileName).toBe('plants-food-v3-export.zip');
    expect(Object.keys(bundle.files).sort()).toEqual([
      'adaptive-lesson.md',
      'assessment-guide.md',
      'manifest.json',
      'module.pdf',
      'packages/plants-food-teacher-v3.pavo-module',
      'packages/plants-food-v3.pavo-module',
    ]);
    expect((await PDFDocument.load(bundle.files['module.pdf']!)).getPageCount()).toBeGreaterThanOrEqual(1);
    expect(parseAssessmentGuide(strFromU8(bundle.files['assessment-guide.md']!)).questions).toHaveLength(4);

    const student = readPackage(bundle.studentPackage!.archive, { now: NOW, audience: 'student' });
    expect(student.manifest.assessment?.forms).toHaveLength(1);
    const studentQuiz = studentQuizSchema.parse(JSON.parse(strFromU8(student.files['quiz.json']!)));
    expect(JSON.stringify(studentQuiz)).not.toContain('Carbon dioxide');
    expect(Object.keys(student.files)).not.toContain('assessment-guide.md');

    const teacher = readPackage(bundle.teacherPackage.archive, { now: NOW, audience: 'teacher' });
    expect(teacher.manifest.packageType).toBe('teacher_bundle');
    expect(studentPackageIdFor(teacher.manifest.packageId)).toBe('plants-food');
    expect(Object.keys(teacher.files)).toEqual(
      expect.arrayContaining(['assessment-guide.md', 'quiz-definition.json', 'module.pdf', 'adaptive-lesson.md']),
    );
    expect(() => readPackage(bundle.teacherPackage.archive, { now: NOW, audience: 'student' })).toThrow('teacher-only');
  });

  it('exports paper artifacts for every alternate form and a class pack', async () => {
    const bundle = await buildExportBundle({
      ...baseInput(),
      module: null,
      packageId: 'fractions-paper',
      quiz: paperQuiz(),
      paper: {
        template: standardTemplate('pavo-std-20x4')!,
        sectionLabel: 'Grade 5 - Sampaguita',
        students: [{ studentId: 'student_ana', name: 'Ana Santos', classNumber: 1 }],
      },
    });
    expect(bundle.studentPackage).toBeNull();
    expect(Object.keys(bundle.files)).toEqual(
      expect.arrayContaining([
        'quiz-paper.pdf',
        'answer-sheet.pdf',
        'answer-sheet-template.json',
        'paper/answer-sheet-form-B.pdf',
        'paper/quiz-paper-form-B.pdf',
        'paper/class-pack-form-A.pdf',
      ]),
    );
    const teacher = readPackage(bundle.teacherPackage.archive, { now: NOW });
    expect(teacher.manifest.assessment?.forms.map((form) => form.code)).toEqual(['A', 'B']);
    expect(Object.keys(teacher.files)).toContain('answer-sheet-template.json');
  });

  it('refuses incomplete exports', async () => {
    await expect(buildExportBundle({ ...baseInput(), module: null })).rejects.toThrow('module, a quiz, or both');
    await expect(buildExportBundle({ ...baseInput(), quiz: paperQuiz() })).rejects.toThrow('answer sheet');
    const missingImage = baseInput();
    missingImage.module!.images = {};
    await expect(buildExportBundle(missingImage)).rejects.toThrow('images/leaf.png');
  });
});
