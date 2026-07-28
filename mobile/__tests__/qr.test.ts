import { describe, expect, it } from '@jest/globals';
import {
  decodeQrPayload,
  encodeQuizReportParts,
  encodeQuizReportV2,
  mergeQuizReportParts,
  type QuizReportPart,
} from '../src/domain/qr';
import type { QuizAttempt, Student } from '../src/domain/types';

const legacyStudent = {
  payloadType: 'student_profile',
  studentId: 'student-1',
  studentNumber: '2026-001',
  firstName: 'Ari',
  lastName: 'Santos',
  middleInitial: 'D',
  gradeLevel: 5,
  section: 'Mabini',
  birthday: '2015-03-04',
};

const legacyAttempt = {
  attemptId: 'attempt-1',
  moduleId: 'module-1',
  score: 4,
  totalItems: 5,
  weakTopic: 'Mixtures',
  strongTopic: 'Solids',
  masteryLevel: 'PROFICIENT',
  durationSeconds: 90,
  attemptNumber: 1,
  submittedAt: 1_700_000_000_000,
};

describe('WAIS QR compatibility', () => {
  it('decodes the legacy student profile shape', () => {
    const result = decodeQrPayload(JSON.stringify(legacyStudent));

    expect(result.kind).toBe('student_profile');
    expect(result.version).toBe(1);
    if (result.kind !== 'student_profile') throw new Error('Expected student profile.');
    expect(result.data.studentNumber).toBe('2026-001');
  });

  it('decodes the legacy quiz result shape', () => {
    const result = decodeQrPayload(
      JSON.stringify({
        payloadType: 'quiz_result',
        ...legacyAttempt,
        studentId: 'student-1',
        studentNumber: '2026-001',
        firstName: 'Ari',
        lastName: 'Santos',
        middleInitial: 'D',
        displayName: 'Ari Santos',
        gradeLevel: 5,
        section: 'Mabini',
        moduleTitle: 'Properties of Materials',
        subject: 'SCIENCE',
        competencyCode: 'S5MT-Ia-b-1',
      }),
    );

    expect(result.kind).toBe('quiz_result');
    expect(result.version).toBe(1);
    if (result.kind !== 'quiz_result' || result.version !== 1) {
      throw new Error('Expected legacy quiz result.');
    }
    expect(result.data.score).toBe(4);
  });

  it('accepts progress exports without a payloadType like the legacy importer', () => {
    const result = decodeQrPayload(
      JSON.stringify({
        studentId: 'student-1',
        displayName: 'Ari Santos',
        gradeLevel: 5,
        section: 'Mabini',
        schoolYear: '2026-2027',
        quizAttempts: [legacyAttempt],
        completedModules: ['module-1'],
        weakTopics: ['Mixtures'],
        gradeCompletionPercent: 33,
      }),
    );

    expect(result.kind).toBe('progress_export');
    if (result.kind !== 'progress_export') throw new Error('Expected progress export.');
    expect(result.data.payloadType).toBe('progress_export');
    expect(result.data.quizAttempts).toHaveLength(1);
  });

  it('unwraps a stringified teacher module payload', () => {
    const payload = JSON.stringify({
      payloadType: 'teacher_module',
      moduleId: 'teacher-science-1',
      title: 'Local Materials',
      subject: 'SCIENCE',
      gradeLevel: 5,
      quarter: 1,
      moduleNumber: 1,
      competencyCode: 'S5MT-Ia-b-1',
      content: 'Observe the objects in your classroom.',
      questions: [],
    });
    const result = decodeQrPayload(JSON.stringify({ payload }));

    expect(result.kind).toBe('teacher_module');
    if (result.kind !== 'teacher_module') throw new Error('Expected teacher module.');
    expect(result.data.title).toBe('Local Materials');
  });

  it('encodes a versioned report without raw student answers', () => {
    const student: Student = {
      id: 'student-1',
      studentNumber: '2026-001',
      firstName: 'Ari',
      lastName: 'Santos',
      middleInitial: 'D',
      displayName: 'Ari Santos',
      gradeLevel: 5,
      section: 'Mabini',
      birthday: '2015-03-04',
      pin: '1234',
      isArchived: false,
    };
    const attempt: QuizAttempt = {
      id: 'attempt-1',
      studentId: student.id,
      moduleId: 'module-1',
      score: 1,
      totalItems: 1,
      weakTopic: 'Ready for next challenge',
      strongTopic: 'Materials',
      masteryLevel: 'ADVANCED',
      durationSeconds: 12,
      attemptNumber: 1,
      submittedAt: 1_700_000_000_000,
      learningFormatUsed: 'visual',
      responses: [
        {
          questionId: 'question-1',
          answer: 'private free-text answer',
          isCorrect: true,
          elapsedMs: 12_000,
        },
      ],
    };

    const encoded = encodeQuizReportV2({
      student,
      module: {
        id: 'module-1',
        title: 'Properties of Materials',
        subject: 'SCIENCE',
        competencyCode: 'S5MT-Ia-b-1',
      },
      attempt,
      learningStyleTag: 'visual',
    });
    const result = decodeQrPayload(encoded);

    expect(result.version).toBe(2);
    expect(encoded).not.toContain('private free-text answer');
    if (result.version === 2) {
      expect(result.data.report.responses).toEqual([
        { questionId: 'question-1', isCorrect: true, elapsedMs: 12_000 },
      ]);
    }
  });

  it('encodes the locked report with timing for all questions and answers only for misses', () => {
    const student: Student = {
      id: 'student-1',
      studentNumber: '2026-001',
      firstName: 'Ari',
      lastName: 'Santos',
      middleInitial: '',
      displayName: 'Ari Santos',
      gradeLevel: 5,
      section: 'Mabini',
      birthday: '',
      pin: '1234',
      isArchived: false,
    };
    const attempt: QuizAttempt = {
      id: 'attempt_36b8f84d-df4e-4d49-b662-bcde71a8764f',
      studentId: student.id,
      moduleId: 'math-1',
      score: 1,
      totalItems: 2,
      weakTopic: 'Fractions',
      strongTopic: 'Addition',
      masteryLevel: 'BEGINNER',
      durationSeconds: 25,
      attemptNumber: 1,
      submittedAt: 1_700_000_000_000,
      learningFormatUsed: 'audio',
      responses: [
        { questionId: 'q1', answer: '5/8', isCorrect: true, elapsedMs: 10_000 },
        { questionId: 'q2', answer: 'B', isCorrect: false, elapsedMs: 15_000 },
      ],
    };
    const payloads = encodeQuizReportParts({
      student,
      module: { id: 'math-1' },
      attempt,
      questions: [
        {
          id: 'q1',
          moduleId: 'math-1',
          type: 'MULTIPLE_CHOICE',
          questionText: 'Sensitive question text one',
          choices: ['5/8', '1/8'],
          correctAnswer: '5/8',
          topicTag: 'Addition',
        },
        {
          id: 'q2',
          moduleId: 'math-1',
          type: 'MULTIPLE_CHOICE',
          questionText: 'Sensitive question text two',
          choices: ['A', 'B'],
          correctAnswer: 'A',
          topicTag: 'Fractions',
        },
      ],
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).not.toContain('Sensitive question text');
    expect(payloads[0]).not.toContain('5/8');
    const decoded = decodeQrPayload(payloads[0]!);
    expect(decoded.kind).toBe('quiz_report');
    if (decoded.kind !== 'quiz_report' || 'part' in decoded.data) {
      throw new Error('Expected a complete MVP report.');
    }
    expect(decoded.data.timing.perQuestion).toHaveLength(2);
    expect(decoded.data.missedQuestions).toEqual([
      {
        questionId: 'q2',
        chosenAnswer: 'B',
        correctAnswer: 'A',
        timeSeconds: 15,
      },
    ]);
  });

  it('splits dense reports and merges every validated part', () => {
    const student: Student = {
      id: 'student-1',
      studentNumber: '2026-001',
      firstName: 'Ari',
      lastName: 'Santos',
      middleInitial: '',
      displayName: 'Ari Santos',
      gradeLevel: 5,
      section: 'Mabini',
      birthday: '',
      pin: '1234',
      isArchived: false,
    };
    const responses = Array.from({ length: 12 }, (_, index) => ({
      questionId: `question-${index}`,
      answer: `wrong-${index}`,
      isCorrect: false,
      elapsedMs: 20_000 + index,
    }));
    const attempt: QuizAttempt = {
      id: 'attempt_36b8f84d-df4e-4d49-b662-bcde71a8764f',
      studentId: student.id,
      moduleId: 'math-1',
      score: 0,
      totalItems: responses.length,
      weakTopic: 'Fractions',
      strongTopic: '',
      masteryLevel: 'BEGINNER',
      durationSeconds: 240,
      attemptNumber: 1,
      submittedAt: 1_700_000_000_000,
      learningFormatUsed: 'text',
      responses,
    };
    const payloads = encodeQuizReportParts({
      student,
      module: { id: 'math-1' },
      attempt,
      questions: responses.map((response) => ({
        id: response.questionId,
        moduleId: 'math-1',
        type: 'MULTIPLE_CHOICE',
        questionText: 'Not encoded',
        choices: ['right', response.answer],
        correctAnswer: 'right',
        topicTag: 'Fractions',
      })),
      maxPayloadCharacters: 900,
    });

    expect(payloads.length).toBeGreaterThan(1);
    const parts = payloads.map((payload) => {
      const decoded = decodeQrPayload(payload);
      if (decoded.kind !== 'quiz_report' || !('part' in decoded.data)) {
        throw new Error('Expected a multipart report.');
      }
      return decoded.data as QuizReportPart;
    });
    const merged = mergeQuizReportParts(parts);
    expect(merged.timing.perQuestion).toHaveLength(12);
    expect(merged.missedQuestions).toHaveLength(12);
  });

  it('rejects unknown payload types', () => {
    expect(() =>
      decodeQrPayload(JSON.stringify({ payloadType: 'not-wais' })),
    ).toThrow('Unsupported WAIS QR payload type');
  });
});
