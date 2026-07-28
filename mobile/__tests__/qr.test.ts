import { describe, expect, it } from '@jest/globals';
import {
  decodeQrPayload,
  encodeAssignmentQr,
  encodeProfileQr,
  encodeQuizReportParts,
  mergeQuizReportParts,
  type QuizReportPart,
} from '../src/domain/qr';
import type { QuizAttempt, Student } from '../src/domain/types';

const student: Student = {
  id: 'student-1',
  studentNumber: '2026-001',
  firstName: 'Ari',
  lastName: 'Santos',
  middleInitial: '',
  displayName: 'Ari Santos',
  parentName: 'Maya Santos',
  parentPhone: '+63 917 555 0199',
  gradeLevel: 4,
  section: 'Grade 4 - Sampaguita',
  birthday: '',
  pin: '1234',
  isArchived: false,
};

describe('PAVO canonical QR envelopes', () => {
  it('round-trips the persistent student profile envelope', () => {
    const payload = encodeProfileQr({
      student,
      currentLearningFormat: 'audio',
    });
    const decoded = decodeQrPayload(payload);

    expect(decoded.kind).toBe('profile');
    if (decoded.kind !== 'profile') throw new Error('Expected profile QR.');
    expect(decoded.data).toMatchObject({
      schemaVersion: '1.0',
      qrType: 'profile',
      studentId: 'student-1',
      parentName: 'Maya Santos',
      parentPhone: '+63 917 555 0199',
      currentLearningFormat: 'audio',
    });
  });

  it('round-trips one assignment envelope for module and quiz tasks', () => {
    const payload = encodeAssignmentQr({
      teacherId: 'teacher-1',
      classSection: 'Grade 4 - Sampaguita',
      issuedAt: '2026-07-28T08:00:00+08:00',
      tasks: [
        {
          type: 'module',
          moduleId: 'grade4-math-fractions',
          dueDate: '2026-08-01',
        },
        {
          type: 'quiz',
          quizId: 'grade4-math-fractions-quiz1',
          dueDate: '2026-08-03',
        },
      ],
    });
    const decoded = decodeQrPayload(payload);

    expect(decoded.kind).toBe('assignment');
    if (decoded.kind !== 'assignment') throw new Error('Expected assignment QR.');
    expect(decoded.data.tasks).toHaveLength(2);
    expect(decoded.data.tasks[1]).toEqual({
      type: 'quiz',
      quizId: 'grade4-math-fractions-quiz1',
      dueDate: '2026-08-03',
    });
  });

  it('encodes timing for every question and answer detail only for misses', () => {
    const payloads = encodeQuizReportParts({
      student,
      module: { id: 'math-1' },
      attempt: makeAttempt([
        { questionId: 'q1', answer: '5/8', isCorrect: true, elapsedMs: 10_000 },
        { questionId: 'q2', answer: 'B', isCorrect: false, elapsedMs: 15_000 },
      ]),
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
    const decoded = decodeQrPayload(payloads[0]!);
    expect(decoded.kind).toBe('quizReport');
    if (decoded.kind !== 'quizReport' || 'part' in decoded.data) {
      throw new Error('Expected a complete quiz report.');
    }
    expect(decoded.data.qrType).toBe('quizReport');
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
    const responses = Array.from({ length: 12 }, (_, index) => ({
      questionId: `question-${index}`,
      answer: `wrong-${index}`,
      isCorrect: false,
      elapsedMs: 20_000 + index,
    }));
    const payloads = encodeQuizReportParts({
      student,
      module: { id: 'math-1' },
      attempt: makeAttempt(responses),
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
      if (decoded.kind !== 'quizReport' || !('part' in decoded.data)) {
        throw new Error('Expected a multipart report.');
      }
      return decoded.data as QuizReportPart;
    });
    const merged = mergeQuizReportParts(parts);
    expect(merged.timing.perQuestion).toHaveLength(12);
    expect(merged.missedQuestions).toHaveLength(12);
  });

  it('rejects legacy and unknown envelopes before parsing payload details', () => {
    expect(() =>
      decodeQrPayload(JSON.stringify({ payloadType: 'student_profile' })),
    ).toThrow('Unsupported PAVO QR schema version');
    expect(() =>
      decodeQrPayload(
        JSON.stringify({
          schemaVersion: '1.0',
          qrType: 'not-pavo',
        }),
      ),
    ).toThrow('Unsupported PAVO QR type');
  });
});

function makeAttempt(
  responses: QuizAttempt['responses'],
): QuizAttempt {
  const correct = responses.filter((response) => response.isCorrect).length;
  return {
    id: 'attempt_36b8f84d-df4e-4d49-b662-bcde71a8764f',
    studentId: student.id,
    moduleId: 'math-1',
    score: correct,
    totalItems: responses.length,
    weakTopic: 'Fractions',
    strongTopic: 'Addition',
    masteryLevel: 'BEGINNER',
    durationSeconds: Math.round(
      responses.reduce((sum, response) => sum + response.elapsedMs, 0) / 1_000,
    ),
    attemptNumber: 1,
    submittedAt: 1_700_000_000_000,
    learningFormatUsed: 'audio',
    responses,
  };
}
