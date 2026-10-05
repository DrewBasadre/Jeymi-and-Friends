import { describe, expect, it } from '@jest/globals';
import { strFromU8 } from 'fflate';
import { scoreQuizResponses } from '../src/domain/assessmentModel';
import { DEMO_PACKAGES, demoResponses } from '../src/domain/demoContent';
import { buildExportBundle } from '../src/domain/exportBundle';
import { standardTemplate } from '../src/domain/omr';
import { buildQuizFromDraft } from '../src/domain/quizAuthoring';

describe('demo content', () => {
  it.each(DEMO_PACKAGES.map((demo) => [demo.title, demo] as const))('%s exports a valid bundle', async (_, demo) => {
    const quiz = demo.quiz ? buildQuizFromDraft(demo.quiz, 'teacher:demo', '2026-10-01T08:00:00.000Z') : null;
    const bundle = await buildExportBundle({
      packageId: demo.id,
      version: 1,
      title: demo.title,
      gradeLevel: demo.gradeLevel,
      subject: demo.subject,
      author: { id: 'demo', name: 'Ms. Reyes' },
      source: 'pavo-demo',
      createdAt: '2026-10-01T08:00:00.000Z',
      attribution: { authors: ['Ms. Reyes'], license: 'CC-BY-4.0', sourceUrl: null, notice: 'Original PAVO demo content.' },
      redistribution: { studentToStudent: true, teacherToTeacher: true, expiresAt: null },
      provenance: null,
      module: { lesson: demo.lesson, images: {} },
      quiz,
      paper: quiz?.mode === 'paper_omr' ? { template: standardTemplate(demo.quiz!.templateId)!, sectionLabel: 'Section Mabini' } : null,
    });
    expect(bundle.files['adaptive-lesson.md']).toBeDefined();
    if (quiz?.mode === 'paper_omr') expect(Object.keys(bundle.files)).toContain('paper/answer-sheet-form-B.pdf');
    if (quiz) expect(strFromU8(bundle.files['assessment-guide.md']!)).toContain(quiz.title);
  });

  it('gives stronger learners higher scores with a repeatable pattern', () => {
    const demo = DEMO_PACKAGES[0]!;
    const quiz = buildQuizFromDraft(demo.quiz!, 'teacher:demo', '2026-10-01T08:00:00.000Z');
    const score = (skill: number, seed: number) => scoreQuizResponses(quiz, 'A', demoResponses(quiz.questions, skill, seed)).percent;
    expect(score(0.9, 7)).toBe(score(0.9, 7));
    const strong = [1, 2, 3, 4].reduce((sum, seed) => sum + score(0.92, seed), 0);
    const weak = [1, 2, 3, 4].reduce((sum, seed) => sum + score(0.35, seed), 0);
    expect(strong).toBeGreaterThan(weak);
  });
});
