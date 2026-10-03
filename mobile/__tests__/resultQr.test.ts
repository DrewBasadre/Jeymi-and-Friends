import { describe, expect, it } from '@jest/globals';
import { decodeBase45, encodeBase45 } from '../src/domain/base45';
import { decodeCbor, encodeCbor } from '../src/domain/cbor';
import { parseAssessmentGuide, renderAssessmentGuide } from '../src/domain/assessmentGuide';
import {
  buildStudentQuiz,
  parseQuizDefinition,
  scoreStudentQuiz,
  type QuizDefinition,
} from '../src/domain/assessmentModel';
import {
  MISSING_QUIZ_MESSAGE,
  ResultQrError,
  bitsetToPositions,
  createDeviceIdentity,
  decodeResultQr,
  encodeResultQr,
  mergeResultQrParts,
  parseResultQrPart,
  positionsToBitset,
  resultPayloadFor,
  signerFor,
  validateResultForImport,
  type ResultImportContext,
  type ResultQrPayload,
} from '../src/domain/resultQr';
import { digitalQuiz } from './fixtures/quizzes';

const NOW = Date.UTC(2026, 9, 4, 9);
const RESULT_ID = '0123456789abcdef0123456789abcdef';

function tenQuestionQuiz(): QuizDefinition {
  const base = digitalQuiz();
  const questions = Array.from({ length: 10 }, (_, index) => ({
    ...base.questions[1]!,
    id: `t${index + 1}`,
    prompt: `Statement ${index + 1}`,
  }));
  return parseQuizDefinition({
    ...base,
    quizId: 'ten-check',
    questions,
    forms: [{ code: 'A', questionOrder: questions.map((q) => q.id), choiceOrders: {} }],
  });
}

function scenario(misses: number[] = [2, 5, 9]) {
  const quiz = tenQuestionQuiz();
  const studentQuiz = buildStudentQuiz(quiz);
  const responses: Record<string, string> = {};
  studentQuiz.questions.forEach((question) => {
    responses[question.id] = misses.includes(question.position) ? 'False' : 'True';
  });
  const payload = resultPayloadFor({
    quiz: studentQuiz,
    packageId: 'pkg-ten-check',
    studentId: 'student_ana',
    attemptNumber: 1,
    scored: scoreStudentQuiz(studentQuiz, responses),
    completedAt: NOW - 60_000,
    resultId: RESULT_ID,
  });
  const context: ResultImportContext = {
    installed: [{ packageId: 'pkg-ten-check', guide: parseAssessmentGuide(renderAssessmentGuide(quiz)) }],
    roster: ['student_ana', 'student_ben'],
    importedResultIds: [],
    enrolledKeys: {},
  };
  return { quiz, payload, context };
}

describe('QR primitives', () => {
  it('matches RFC 9285 Base45 vectors', () => {
    const vectors: Array<[string, string]> = [
      ['AB', 'BB8'],
      ['Hello!!', '%69 VD92EX0'],
      ['base-45', 'UJCLQE7W581'],
    ];
    for (const [plain, encoded] of vectors) {
      expect(encodeBase45(new TextEncoder().encode(plain))).toBe(encoded);
      expect(new TextDecoder().decode(decodeBase45(encoded))).toBe(plain);
    }
    expect(() => decodeBase45('GGW')).toThrow('Invalid Base45 group');
  });

  it('round-trips deterministic CBOR and rejects ambiguity', () => {
    const value = new Map<number, never>([[2, 'b' as never], [1, new Uint8Array([1, 2]) as never]]);
    const bytes = encodeCbor(value);
    expect(bytes[1]).toBe(0x01);
    expect(decodeCbor(bytes)).toEqual(value);
    expect(() => decodeCbor(Uint8Array.from([...bytes, 0]))).toThrow('trailing');
    expect(() => decodeCbor(Uint8Array.from([0xa2, 0x01, 0x01, 0x01, 0x02]))).toThrow('repeats');
  });

  it('maps positions 2, 5, and 9 of 10 into a two-byte bitset', () => {
    const bits = positionsToBitset([2, 5, 9], 10);
    expect([...bits]).toEqual([0b00010010, 0b00000001]);
    expect(bitsetToPositions(bits, 10)).toEqual([2, 5, 9]);
    expect(() => bitsetToPositions(Uint8Array.from([0, 0b100]), 10)).toThrow('outside');
    expect(() => positionsToBitset([11], 10)).toThrow('outside');
  });
});

describe('PAVO_RESULT_V1 encoding', () => {
  it('fits one compact QR and decodes to identifiers and bitsets only', () => {
    const { payload } = scenario();
    const [text, ...rest] = encodeResultQr(payload);
    expect(rest).toEqual([]);
    expect(text!.length).toBeLessThan(220);
    expect(text).toMatch(/^PVR1Z?:[0-9A-Z $%*+\-./:]+$/);
    const decoded = decodeResultQr(text!, NOW);
    expect(decoded.payload).toEqual(payload);
    expect(decoded.payload.incorrect).toEqual([2, 5, 9]);
    expect(Object.keys(decoded.payload).sort()).toEqual(
      [
        'attemptNumber', 'completedAt', 'fingerprint', 'incorrect', 'keyId', 'packageId', 'questionCount',
        'quizId', 'quizVersion', 'resultId', 'score', 'studentId', 'totalPoints', 'unanswered',
      ].sort(),
    );
  });

  it('keeps a 50-question quiz in a single QR', () => {
    const payload: ResultQrPayload = {
      ...scenario().payload,
      questionCount: 50,
      totalPoints: 50,
      score: 25,
      incorrect: Array.from({ length: 20 }, (_, index) => index * 2 + 1),
      unanswered: [2, 4, 6, 8, 10],
    };
    expect(encodeResultQr(payload)).toHaveLength(1);
  });

  it('rejects corrupted, foreign, and unsupported codes', () => {
    const [text] = encodeResultQr(scenario().payload);
    const corrupted = text!.slice(0, 20) + (text![20] === 'A' ? 'B' : 'A') + text!.slice(21);
    expect(() => decodeResultQr(corrupted, NOW)).toThrow(ResultQrError);
    expect(() => decodeResultQr('{"qrType":"profile"}', NOW)).toThrow('not a PAVO result');
    expect(() => decodeResultQr('PVR2:AAAA', NOW)).toThrow('unsupported');
  });

  it('flags malformed timestamps and attempt metadata', () => {
    const { payload } = scenario();
    expect(() => encodeResultQr({ ...payload, attemptNumber: 0 })).toThrow('attempt');
    const [future] = encodeResultQr({ ...payload, completedAt: NOW - 1 });
    expect(() => decodeResultQr(future!, NOW - 3 * 86_400_000)).toThrow('timestamp');
  });

  it('splits into an ordered multipart sequence with an aggregate checksum', () => {
    const { payload } = scenario();
    const parts = encodeResultQr(payload, { maxChars: 60 });
    expect(parts.length).toBeGreaterThan(1);
    const parsed = parts.map(parseResultQrPart);
    expect(mergeResultQrParts(parsed.slice(1))).toBeNull();
    const merged = mergeResultQrParts([...parsed].reverse());
    expect(decodeResultQr(merged!, NOW).payload).toEqual(payload);
    const tampered = { ...parsed[0]!, chunk: parsed[0]!.chunk.replace(/.$/, '0') };
    expect(() => mergeResultQrParts([tampered, ...parsed.slice(1)])).toThrow('checksum');
  });
});

describe('teacher import validation', () => {
  const decode = (payload: ResultQrPayload, signer?: Parameters<typeof encodeResultQr>[1]) =>
    decodeResultQr(encodeResultQr(payload, signer)[0]!, NOW);

  it('maps failed positions through the local assessment guide', () => {
    const { payload, context } = scenario();
    const preview = validateResultForImport(decode(payload), context);
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.verification).toBe('unsigned');
    expect(preview.incorrect.map((question) => [question.position, question.id])).toEqual([
      [2, 't2'],
      [5, 't5'],
      [9, 't9'],
    ]);
    expect(preview.graded.items.filter((item) => item.outcome === 'incorrect')).toHaveLength(3);
    expect(preview.plan.competencies[0]?.questionNumbers).toEqual([2, 5, 9]);
  });

  it('rejects missing, mismatched, out-of-section, duplicate, and tampered results', () => {
    const { payload, context, quiz } = scenario();
    const decoded = decode(payload);
    const expectCode = (result: ReturnType<typeof validateResultForImport>, code: string) =>
      expect(result.ok ? 'ok' : result.code).toBe(code);

    const missing = validateResultForImport(decoded, { ...context, installed: [] });
    expectCode(missing, 'quiz_not_installed');
    expect(missing.ok ? '' : missing.message).toBe(MISSING_QUIZ_MESSAGE);

    const otherVersion = parseAssessmentGuide(renderAssessmentGuide({ ...quiz, version: 2 }));
    expectCode(
      validateResultForImport(decoded, { ...context, installed: [{ packageId: 'pkg-ten-check', guide: otherVersion }] }),
      'version_mismatch',
    );
    expectCode(validateResultForImport(decode({ ...payload, fingerprint: 'f'.repeat(32) }), context), 'fingerprint_mismatch');
    expectCode(validateResultForImport(decode({ ...payload, questionCount: 12 }), context), 'count_mismatch');
    expectCode(validateResultForImport(decoded, { ...context, roster: ['student_ben'] }), 'not_in_section');
    expectCode(validateResultForImport(decoded, { ...context, importedResultIds: [RESULT_ID] }), 'duplicate');
    expectCode(validateResultForImport(decode({ ...payload, score: payload.score + 1 }), context), 'score_mismatch');
    expectCode(validateResultForImport(decode({ ...payload, packageId: 'pkg-other' }), context), 'package_mismatch');
  });

  it('distinguishes signed, unknown-device, and invalid signatures', () => {
    const { payload, context } = scenario();
    const identity = createDeviceIdentity(new Uint8Array(32).fill(7));
    const other = createDeviceIdentity(new Uint8Array(32).fill(9));
    const signed = decode(payload, { signer: signerFor(identity) });

    const verified = validateResultForImport(signed, { ...context, enrolledKeys: { student_ana: identity.publicKeyHex } });
    expect(verified.ok && verified.verification).toBe('signed');

    const unknown = validateResultForImport(signed, context);
    expect(unknown.ok && unknown.verification).toBe('unknown_device');

    const forged = decode(payload, { signer: { keyId: identity.keyId, sign: () => new Uint8Array(64) } });
    const rejected = validateResultForImport(forged, { ...context, enrolledKeys: { student_ana: identity.publicKeyHex } });
    expect(rejected.ok ? 'ok' : rejected.code).toBe('invalid_signature');

    const wrongDevice = decode(payload, { signer: signerFor(other) });
    const flagged = validateResultForImport(wrongDevice, { ...context, enrolledKeys: { student_ana: identity.publicKeyHex } });
    expect(flagged.ok && flagged.verification).toBe('unknown_device');
  });
});
