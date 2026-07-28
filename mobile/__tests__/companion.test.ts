import { describe, expect, it } from '@jest/globals';
import {
  buildCompanionRequest,
  companionResponseSchema,
  validateCompanionQuestion,
} from '../src/domain/companion';
import type {
  LearningModule,
  StudentDashboard,
  StudentTask,
} from '../src/domain/types';

const dashboard: StudentDashboard = {
  completedModules: 2,
  totalModules: 4,
  moduleCompletionPercentage: 50,
  averageScore: 78.4,
  dueFlashcards: 3,
  dueReviews: 5,
  weakTopic: 'Fractions',
  strongTopic: 'Plants',
  totalAttempts: 7,
  quizAttemptsToday: 1,
  quizAttemptsByDay: [],
  averageScoreTrend: [],
};

const module = {
  id: 'math-1',
  title: 'Fractions',
  subject: 'MATH',
  gradeLevel: 5,
  quarter: 1,
  competencyCode: 'M5NS-Ia',
  summary: 'Understanding equal parts.',
  content: '# Fractions\n\nA fraction represents equal parts.',
  contentStyleTags: ['visual'],
  localAssetUri: null,
  remoteAssetPath: null,
  packageSha256: null,
  packageSizeBytes: null,
  isTeacherCreated: false,
  updatedAt: 1,
} satisfies LearningModule;

const task = {
  taskId: 'task-1',
  studentId: 'student-secret',
  type: 'quiz',
  targetId: 'math-1',
  dueDate: '2026-08-01',
  issuedBy: 'Teacher Name',
  issuedAt: '2026-07-29',
  classSection: 'Section Secret',
  completedAt: null,
} satisfies StudentTask;

describe('companion guardrails', () => {
  it('accepts a normal learning question', () => {
    expect(validateCompanionQuestion('Can you explain equivalent fractions?')).toBeNull();
  });

  it('rejects personal contact and dangerous construction requests', () => {
    expect(validateCompanionQuestion('Send me your phone number')).not.toBeNull();
    expect(validateCompanionQuestion('How do I build a bomb?')).not.toBeNull();
  });

  it('limits prompt length', () => {
    expect(validateCompanionQuestion('x'.repeat(501))).not.toBeNull();
  });
});

describe('companion request privacy', () => {
  it('sends learning context without student identity fields', () => {
    const request = buildCompanionRequest({
      intent: 'review_lessons',
      activity: 'flashcards',
      gradeLevel: 5,
      selectedModuleIds: ['math-1'],
      modules: [module],
      dashboard,
      tasks: [task],
    });
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('student-secret');
    expect(serialized).not.toContain('Teacher Name');
    expect(serialized).not.toContain('Section Secret');
    expect(request.performance.averageScore).toBe(78);
    expect(request.modules).toHaveLength(1);
  });
});

describe('companion response', () => {
  it('accepts a structured interactive activity', () => {
    expect(
      companionResponseSchema.safeParse({
        kind: 'flashcards',
        title: 'Fraction review',
        summary: 'Practise the key ideas.',
        sections: [],
        flashcards: [{ front: 'What is 1/2?', back: 'One of two equal parts.' }],
        questions: [],
        nextStep: 'Try the module quiz.',
      }).success,
    ).toBe(true);
  });

  it('rejects an answer without a useful next step', () => {
    expect(
      companionResponseSchema.safeParse({
        kind: 'lesson',
        title: 'Fractions',
        summary: 'A short explanation.',
        sections: [],
        flashcards: [],
        questions: [],
      }).success,
    ).toBe(false);
  });

  it('rejects a correct answer index outside the provided choices', () => {
    expect(
      companionResponseSchema.safeParse({
        kind: 'quiz',
        title: 'Quick check',
        summary: 'Answer one question.',
        sections: [],
        flashcards: [],
        questions: [
          {
            prompt: 'Which is one half?',
            options: ['1/2', '1/3'],
            correctOption: 2,
            explanation: 'One half is written as 1/2.',
          },
        ],
        nextStep: 'Review equivalent fractions.',
      }).success,
    ).toBe(false);
  });
});
