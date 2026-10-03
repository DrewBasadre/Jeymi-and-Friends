import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { buildExportBundle } from '@pavo/domain/exportBundle';
import { readPackage } from '@pavo/domain/packageV2';
import { DEFAULT_QUIZ_POLICY } from '@pavo/domain/assessmentModel';
import { newQuestion } from '@pavo/domain/quizAuthoring';
import { importFile, lessonFromAiDraft, questionsFromAiDraft } from './convert';
import { canPublish, exportInput, newProject, newQuizDraft, nextVersion, publishChecklist, rosterEntries } from './project';

const author = { id: 'teacher_demo', name: 'Ms. Reyes' };

function digitalProject() {
  const project = newProject(author, Date.UTC(2026, 9, 4));
  project.title = 'Plant parts';
  const quiz = newQuizDraft(project);
  quiz.mode = 'digital_mini_quiz';
  quiz.questions = [
    { ...newQuestion('multiple_choice', 'q1'), prompt: 'Which part makes food?', choices: ['Root', 'Leaf'], answer: 'Leaf', topic: 'Parts', competency: 'S5-1' },
    { ...newQuestion('identification', 'q2'), prompt: 'Name the green pigment.', answer: 'chlorophyll', topic: 'Parts', competency: 'S5-1' },
  ];
  quiz.policy = DEFAULT_QUIZ_POLICY;
  project.quiz = quiz;
  return project;
}

describe('web project rules', () => {
  it('blocks publishing until AI drafts are approved', () => {
    const project = digitalProject();
    expect(canPublish(project)).toBe(true);
    project.aiDrafts = [{ artifact: 'lesson', model: 'm', generatedAt: '2026-10-04T00:00:00.000Z', sourceIds: ['src-1'], approved: false, approvedAt: null, teacherEdited: false }];
    expect(publishChecklist(project).find((item) => item.label.includes('AI draft'))?.ok).toBe(false);
    expect(canPublish(project)).toBe(false);
  });

  it('reports invalid quizzes and missing images with readable detail', () => {
    const project = digitalProject();
    project.quiz!.questions[0] = { ...project.quiz!.questions[0]!, answer: 'Stem' };
    expect(publishChecklist(project).find((item) => item.label === 'Assessment is valid')?.detail).toContain('question 1');
    project.lesson!.blocks.push({ type: 'visual', id: 'v1', concept: null, markdown: '', image: { path: 'images/leaf.png', alt: 'Leaf', caption: '' } });
    expect(publishChecklist(project).find((item) => item.label.includes('image'))?.ok).toBe(false);
  });

  it('exports a bundle Android can install, with AI provenance and a mode-correct quiz', async () => {
    const project = digitalProject();
    project.aiDrafts = [{ artifact: 'lesson', model: 'gpt-x', generatedAt: '2026-10-04T00:00:00.000Z', sourceIds: ['src-1'], approved: true, approvedAt: '2026-10-04T01:00:00.000Z', teacherEdited: true }];
    const bundle = await buildExportBundle(exportInput(project, '2026-10-04T02:00:00.000Z'));
    const student = readPackage(bundle.studentPackage!.archive, { audience: 'student', now: Date.UTC(2026, 9, 4) });
    expect(student.manifest.provenance).toMatchObject({ aiAssisted: true, model: 'gpt-x', approvedBy: 'Ms. Reyes', teacherEdited: true });
    expect(Object.keys(bundle.files)).toEqual(expect.arrayContaining(['module.pdf', 'assessment-guide.md', 'adaptive-lesson.md', 'manifest.json']));
  });

  it('starts a new version without touching the exported one', () => {
    const project = { ...digitalProject(), status: 'exported' as const, exportedAt: 1 };
    const next = nextVersion(project);
    expect(next.version).toBe(2);
    expect(next.quiz?.version).toBe(2);
    expect(next.status).toBe('draft');
    expect(project.version).toBe(1);
  });

  it('turns a pasted roster into class numbers for class packs', () => {
    expect(rosterEntries('Ana Santos\n\n Ben Reyes ')).toEqual([
      { studentId: 'class-1', name: 'Ana Santos', classNumber: 1 },
      { studentId: 'class-2', name: 'Ben Reyes', classNumber: 2 },
    ]);
  });
});

describe('imports and AI drafts', () => {
  const draft = {
    kind: 'mixed' as const,
    title: 'Photosynthesis',
    summary: 'Plants make food in leaves.',
    sections: [
      { heading: 'Key idea', body: 'Leaves use sunlight.' },
      { heading: 'Worked example', body: 'A plant in the dark.' },
    ],
    flashcards: [],
    questions: [{ prompt: 'Which part makes food?', options: ['Root', 'Leaf'], correctOption: 1, explanation: 'Leaves hold chlorophyll.' }],
    nextStep: 'I can explain photosynthesis.',
  };

  it('converts AI drafts into a valid lesson and questions', () => {
    const lesson = lessonFromAiDraft(draft, { id: 'p1', title: 'Plants', gradeLevel: 5, subject: 'Science', competencies: [] });
    expect(lesson.blocks.map((block) => block.type)).toEqual(['objective', 'concept', 'worked-example', 'check', 'checkpoint']);
    const questions = questionsFromAiDraft(draft, 'p1', 'S5-1');
    expect(questions[0]).toMatchObject({ answer: 'Leaf', competency: 'S5-1', rationale: 'Leaves hold chlorophyll.' });
  });

  it('imports Markdown, quiz JSON, and teacher bundles as the next version', async () => {
    const project = digitalProject();
    const lesson = importFile('notes.md', strToU8('# Fractions\n\n## Parts\n\nEqual parts.'), project);
    expect(lesson.kind === 'lesson' && lesson.lesson.blocks.length).toBe(3);
    const questions = importFile('bank.json', strToU8(JSON.stringify(project.quiz!.questions)), project);
    expect(questions.kind === 'questions' && questions.questions).toHaveLength(2);

    const bundle = await buildExportBundle(exportInput(project, '2026-10-04T02:00:00.000Z'));
    const reopened = importFile('plant.pavo-module', bundle.teacherPackage.archive, project);
    expect(reopened.kind).toBe('project');
    if (reopened.kind === 'project') {
      expect(reopened.version).toBe(2);
      expect(reopened.packageId).toBe(project.id);
      expect(reopened.quiz?.questions).toHaveLength(2);
    }
    expect(() => importFile('student.pavo-module', bundle.studentPackage!.archive, project)).toThrow('teacher bundle');
    expect(() => importFile('slides.pptx', new Uint8Array(1), project)).toThrow('Supported files');
  });
});
