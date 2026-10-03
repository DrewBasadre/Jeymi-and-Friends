import { deflateSync, inflateSync } from 'fflate';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { decodeBase45, encodeBase45 } from './base45';
import { decodeCbor, encodeCbor, type CborMap, type CborValue } from './cbor';
import { sha256Bytes, sha256Hex } from './hash';
import { resolveFormPositions, type AssessmentGuide } from './assessmentGuide';
import { buildLearnerPlan, type GradedResult, type LearnerPlan } from './assessmentAnalytics';
import type { ItemOutcome, ScoredAttempt, StudentQuiz } from './assessmentModel';

/**
 * PAVO_RESULT_V1 — the compact student-to-teacher result.
 *
 * Wire form: `PVR1:` + Base45(CBOR map) or `PVR1Z:` + Base45(DEFLATE(CBOR map)).
 * Bitsets are LSB-first over 1-based form positions: position p is bit
 * (p-1)%8 of byte floor((p-1)/8). Keys 30 (checksum) and 31 (signature) are
 * computed over the CBOR encoding of every other key.
 */
export const RESULT_QR_SCHEMA_VERSION = 1;
export const RESULT_QR_PREFIX = 'PVR1:';
export const RESULT_QR_DEFLATE_PREFIX = 'PVR1Z:';
export const RESULT_QR_PART_PREFIX = 'PVR1M:';
export const MISSING_QUIZ_MESSAGE = 'Install the matching quiz package before importing this result.';
const SIGNATURE_DOMAIN = utf8ToBytes('PAVO_RESULT_V1');
const DEFAULT_MAX_CHARS = 380;

const KEY = {
  schema: 0,
  studentId: 1,
  quizId: 2,
  quizVersion: 3,
  packageId: 4,
  fingerprint: 5,
  attempt: 6,
  count: 7,
  score: 8,
  totalPoints: 9,
  incorrect: 10,
  unanswered: 11,
  completedAt: 12,
  resultId: 13,
  keyId: 14,
  checksum: 30,
  signature: 31,
} as const;

export interface ResultQrPayload {
  studentId: string;
  quizId: string;
  quizVersion: number;
  packageId: string;
  fingerprint: string;
  attemptNumber: number;
  questionCount: number;
  score: number;
  totalPoints: number;
  incorrect: number[];
  unanswered: number[];
  completedAt: number;
  resultId: string;
  keyId: string | null;
}

export interface DecodedResultQr {
  payload: ResultQrPayload;
  body: Uint8Array;
  signature: Uint8Array | null;
}

export type ResultQrErrorCode = 'not_result_qr' | 'unsupported_version' | 'malformed' | 'bad_checksum';

export class ResultQrError extends Error {
  constructor(
    readonly code: ResultQrErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ResultSigner {
  keyId: string;
  sign(message: Uint8Array): Uint8Array;
}

export function isResultQr(text: string): boolean {
  return text.startsWith('PVR1');
}

export function encodeResultQr(
  payload: ResultQrPayload,
  options: { signer?: ResultSigner; maxChars?: number } = {},
): string[] {
  validatePayload(payload);
  const body = bodyMap({ ...payload, keyId: options.signer?.keyId ?? null });
  const bodyBytes = encodeCbor(body);
  const envelope: CborMap = new Map(body);
  envelope.set(KEY.checksum, checksumOf(bodyBytes));
  if (options.signer) {
    envelope.set(KEY.signature, options.signer.sign(signedMessage(bodyBytes)));
  }
  const cbor = encodeCbor(envelope);
  const deflated = deflateSync(cbor, { level: 9 });
  const text =
    deflated.byteLength < cbor.byteLength
      ? RESULT_QR_DEFLATE_PREFIX + encodeBase45(deflated)
      : RESULT_QR_PREFIX + encodeBase45(cbor);
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  if (text.length <= maxChars) return [text];

  const groupId = payload.resultId.slice(0, 12).toUpperCase();
  const aggregate = sha256Hex(text).slice(0, 8).toUpperCase();
  const overhead = `${RESULT_QR_PART_PREFIX}99/99:${groupId}:${aggregate}:`.length;
  const chunkSize = Math.max(16, maxChars - overhead);
  const chunks = Array.from({ length: Math.ceil(text.length / chunkSize) }, (_, index) =>
    text.slice(index * chunkSize, (index + 1) * chunkSize),
  );
  if (chunks.length > 99) throw new Error('This result is too large for a QR sequence.');
  return chunks.map(
    (chunk, index) => `${RESULT_QR_PART_PREFIX}${index + 1}/${chunks.length}:${groupId}:${aggregate}:${chunk}`,
  );
}

export interface ResultQrPart {
  groupId: string;
  sequence: number;
  total: number;
  aggregate: string;
  chunk: string;
}

export function parseResultQrPart(text: string): ResultQrPart {
  const match = /^PVR1M:(\d{1,2})\/(\d{1,2}):([0-9A-F]{12}):([0-9A-F]{8}):(.+)$/s.exec(text);
  if (!match) throw new ResultQrError('malformed', 'This QR part is not a PAVO result part.');
  const sequence = Number(match[1]);
  const total = Number(match[2]);
  if (sequence < 1 || total < 2 || sequence > total) {
    throw new ResultQrError('malformed', 'This QR part has an invalid sequence number.');
  }
  return { sequence, total, groupId: match[3]!, aggregate: match[4]!, chunk: match[5]! };
}

/** Joins an ordered multipart sequence; returns null until every part is present. */
export function mergeResultQrParts(parts: ResultQrPart[]): string | null {
  const first = parts[0];
  if (!first) return null;
  if (parts.some((part) => part.groupId !== first.groupId || part.total !== first.total || part.aggregate !== first.aggregate)) {
    throw new ResultQrError('malformed', 'These QR parts belong to different results.');
  }
  const bySequence = new Map(parts.map((part) => [part.sequence, part.chunk]));
  if (bySequence.size < first.total) return null;
  const text = Array.from({ length: first.total }, (_, index) => bySequence.get(index + 1)!).join('');
  if (sha256Hex(text).slice(0, 8).toUpperCase() !== first.aggregate) {
    throw new ResultQrError('bad_checksum', 'The QR sequence checksum does not match.');
  }
  return text;
}

export function decodeResultQr(text: string, now = Date.now()): DecodedResultQr {
  let bytes: Uint8Array;
  try {
    if (text.startsWith(RESULT_QR_DEFLATE_PREFIX)) {
      bytes = inflateSync(decodeBase45(text.slice(RESULT_QR_DEFLATE_PREFIX.length)));
    } else if (text.startsWith(RESULT_QR_PREFIX)) {
      bytes = decodeBase45(text.slice(RESULT_QR_PREFIX.length));
    } else if (text.startsWith('PVR')) {
      throw new ResultQrError('unsupported_version', 'This result QR uses an unsupported PAVO version.');
    } else {
      throw new ResultQrError('not_result_qr', 'This is not a PAVO result QR.');
    }
  } catch (error) {
    if (error instanceof ResultQrError) throw error;
    throw new ResultQrError('malformed', 'The result QR could not be decoded.');
  }

  let envelope: CborValue;
  try {
    envelope = decodeCbor(bytes);
  } catch {
    throw new ResultQrError('malformed', 'The result QR is damaged.');
  }
  if (!(envelope instanceof Map)) throw new ResultQrError('malformed', 'The result QR is damaged.');
  if (envelope.get(KEY.schema) !== RESULT_QR_SCHEMA_VERSION) {
    throw new ResultQrError('unsupported_version', 'This result QR uses an unsupported schema version.');
  }
  const checksum = envelope.get(KEY.checksum);
  const signature = envelope.get(KEY.signature) ?? null;
  const body: CborMap = new Map(envelope);
  body.delete(KEY.checksum);
  body.delete(KEY.signature);
  const bodyBytes = encodeCbor(body);
  if (!(checksum instanceof Uint8Array) || bytesToHex(checksum) !== bytesToHex(checksumOf(bodyBytes))) {
    throw new ResultQrError('bad_checksum', 'The result QR checksum is invalid. Ask the student to show it again.');
  }
  if (signature !== null && !(signature instanceof Uint8Array && signature.byteLength === 64)) {
    throw new ResultQrError('malformed', 'The result QR signature is malformed.');
  }
  const payload = payloadFrom(body);
  try {
    validatePayload(payload, now);
  } catch (error) {
    throw new ResultQrError('malformed', error instanceof Error ? error.message : 'Malformed result.');
  }
  return { payload, body: bodyBytes, signature: signature as Uint8Array | null };
}

/** Builds the QR payload for a locally scored digital attempt. */
export function resultPayloadFor(args: {
  quiz: Pick<StudentQuiz, 'quizId' | 'version' | 'fingerprint' | 'questions'>;
  packageId: string;
  studentId: string;
  attemptNumber: number;
  scored: ScoredAttempt;
  completedAt: number;
  resultId: string;
}): ResultQrPayload {
  const positions = (outcome: ItemOutcome) =>
    args.scored.items.filter((item) => item.outcome === outcome).map((item) => item.position);
  return {
    studentId: args.studentId,
    quizId: args.quiz.quizId,
    quizVersion: args.quiz.version,
    packageId: args.packageId,
    fingerprint: args.quiz.fingerprint,
    attemptNumber: args.attemptNumber,
    questionCount: args.quiz.questions.length,
    score: args.scored.score,
    totalPoints: args.scored.total,
    incorrect: positions('incorrect'),
    unanswered: positions('unanswered'),
    completedAt: args.completedAt,
    resultId: args.resultId,
    keyId: null,
  };
}

/* ── Device signing identity ─────────────────────────────────────────── */

export interface DeviceIdentity {
  secretKeyHex: string;
  publicKeyHex: string;
  keyId: string;
}

export function createDeviceIdentity(seed: Uint8Array): DeviceIdentity {
  if (seed.byteLength !== 32) throw new Error('A device identity needs 32 random bytes.');
  const publicKey = ed25519.getPublicKey(seed);
  return { secretKeyHex: bytesToHex(seed), publicKeyHex: bytesToHex(publicKey), keyId: keyIdFor(bytesToHex(publicKey)) };
}

export function keyIdFor(publicKeyHex: string): string {
  return sha256Hex(hexToBytes(publicKeyHex)).slice(0, 16);
}

export function signerFor(identity: Pick<DeviceIdentity, 'secretKeyHex' | 'keyId'>): ResultSigner {
  const secret = hexToBytes(identity.secretKeyHex);
  return { keyId: identity.keyId, sign: (message) => ed25519.sign(message, secret) };
}

/* ── Teacher-side validation ─────────────────────────────────────────── */

export type ResultVerification = 'signed' | 'unsigned' | 'unknown_device';

export type ResultRejectionCode =
  | 'quiz_not_installed'
  | 'version_mismatch'
  | 'package_mismatch'
  | 'fingerprint_mismatch'
  | 'count_mismatch'
  | 'position_out_of_range'
  | 'score_mismatch'
  | 'not_in_section'
  | 'duplicate'
  | 'invalid_signature';

export interface ResultImportContext {
  installed: Array<{ packageId: string; guide: AssessmentGuide }>;
  roster: string[] | null;
  importedResultIds: string[];
  enrolledKeys: Record<string, string>;
}

export interface ResultImportPreview {
  ok: true;
  verification: ResultVerification;
  payload: ResultQrPayload;
  guide: AssessmentGuide;
  formCode: string;
  incorrect: Array<AssessmentGuide['questions'][number] & { position: number }>;
  unanswered: Array<AssessmentGuide['questions'][number] & { position: number }>;
  graded: GradedResult;
  plan: LearnerPlan;
}

export interface ResultRejection {
  ok: false;
  code: ResultRejectionCode;
  message: string;
}

export function validateResultForImport(
  decoded: DecodedResultQr,
  context: ResultImportContext,
): ResultImportPreview | ResultRejection {
  const { payload } = decoded;
  const reject = (code: ResultRejectionCode, message: string): ResultRejection => ({ ok: false, code, message });

  const sameQuiz = context.installed.filter((entry) => entry.guide.quizId === payload.quizId);
  if (!sameQuiz.length) return reject('quiz_not_installed', MISSING_QUIZ_MESSAGE);
  const sameVersion = sameQuiz.filter((entry) => entry.guide.version === payload.quizVersion);
  if (!sameVersion.length) {
    return reject(
      'version_mismatch',
      `This result is for version ${payload.quizVersion}, but this device has version ${sameQuiz
        .map((entry) => entry.guide.version)
        .join(', ')}. ${MISSING_QUIZ_MESSAGE}`,
    );
  }
  const installed = sameVersion.find((entry) => entry.packageId === payload.packageId);
  if (!installed) return reject('package_mismatch', `The result came from a different quiz package. ${MISSING_QUIZ_MESSAGE}`);
  const { guide } = installed;
  const form = guide.forms.find((candidate) => candidate.fingerprint === payload.fingerprint);
  if (!form) return reject('fingerprint_mismatch', 'The assessment fingerprint does not match the installed quiz.');
  if (payload.questionCount !== guide.questions.length) {
    return reject('count_mismatch', 'The question count does not match the installed quiz.');
  }
  const outside = [...payload.incorrect, ...payload.unanswered].some(
    (position) => position < 1 || position > guide.questions.length,
  );
  if (outside) return reject('position_out_of_range', 'The result refers to a question outside this quiz.');
  if (context.roster && !context.roster.includes(payload.studentId)) {
    return reject('not_in_section', 'This student is not in the selected section.');
  }
  if (context.importedResultIds.includes(payload.resultId)) {
    return reject('duplicate', 'This result was already imported.');
  }

  const incorrect = resolveFormPositions(guide, form.code, payload.incorrect);
  const unanswered = resolveFormPositions(guide, form.code, payload.unanswered);
  const missedIds = new Set([...incorrect, ...unanswered].map((question) => question.id));
  const totalPoints = guide.questions.reduce((sum, question) => sum + question.points, 0);
  const expectedScore = guide.questions
    .filter((question) => !missedIds.has(question.id))
    .reduce((sum, question) => sum + question.points, 0);
  if (payload.totalPoints !== totalPoints || payload.score !== expectedScore) {
    return reject('score_mismatch', 'The reported score does not match the installed answer key.');
  }

  let verification: ResultVerification = 'unsigned';
  const enrolledKey = context.enrolledKeys[payload.studentId];
  if (decoded.signature) {
    if (!enrolledKey || payload.keyId !== keyIdFor(enrolledKey)) {
      verification = 'unknown_device';
    } else if (ed25519.verify(decoded.signature, signedMessage(decoded.body), hexToBytes(enrolledKey))) {
      verification = 'signed';
    } else {
      return reject('invalid_signature', 'The result signature is invalid. Do not import this result.');
    }
  }

  const outcome = (questionId: string): ItemOutcome =>
    incorrect.some((question) => question.id === questionId)
      ? 'incorrect'
      : unanswered.some((question) => question.id === questionId)
        ? 'unanswered'
        : 'correct';
  const graded: GradedResult = {
    resultId: payload.resultId,
    studentId: payload.studentId,
    quizId: payload.quizId,
    quizVersion: payload.quizVersion,
    formCode: form.code,
    attemptNumber: payload.attemptNumber,
    source: 'result_qr',
    completedAt: payload.completedAt,
    score: payload.score,
    total: payload.totalPoints,
    items: guide.questions.map((question) => ({ questionId: question.id, outcome: outcome(question.id) })),
  };
  const withPosition = (questions: typeof incorrect, positions: number[]) =>
    questions.map((question, index) => ({ ...question, position: positions[index]! }));
  return {
    ok: true,
    verification,
    payload,
    guide,
    formCode: form.code,
    incorrect: withPosition(incorrect, payload.incorrect),
    unanswered: withPosition(unanswered, payload.unanswered),
    graded,
    plan: buildLearnerPlan(guide, graded),
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

export function positionsToBitset(positions: number[], count: number): Uint8Array {
  const bits = new Uint8Array(Math.ceil(count / 8));
  for (const position of positions) {
    if (!Number.isInteger(position) || position < 1 || position > count) {
      throw new Error(`Position ${position} is outside a ${count}-question quiz.`);
    }
    bits[(position - 1) >> 3]! |= 1 << ((position - 1) & 7);
  }
  return bits;
}

export function bitsetToPositions(bits: Uint8Array, count: number): number[] {
  if (bits.byteLength !== Math.ceil(count / 8)) throw new Error('Bitset length does not match the question count.');
  const positions: number[] = [];
  for (let index = 0; index < bits.byteLength * 8; index += 1) {
    if (bits[index >> 3]! & (1 << (index & 7))) {
      if (index >= count) throw new Error('A bitset marks a position outside the quiz.');
      positions.push(index + 1);
    }
  }
  return positions;
}

function bodyMap(payload: ResultQrPayload): CborMap {
  const map: CborMap = new Map<number, CborValue>([
    [KEY.schema, RESULT_QR_SCHEMA_VERSION],
    [KEY.studentId, payload.studentId],
    [KEY.quizId, payload.quizId],
    [KEY.quizVersion, payload.quizVersion],
    [KEY.packageId, payload.packageId],
    [KEY.fingerprint, hexToBytes(payload.fingerprint)],
    [KEY.attempt, payload.attemptNumber],
    [KEY.count, payload.questionCount],
    [KEY.score, payload.score],
    [KEY.totalPoints, payload.totalPoints],
    [KEY.incorrect, positionsToBitset(payload.incorrect, payload.questionCount)],
    [KEY.unanswered, positionsToBitset(payload.unanswered, payload.questionCount)],
    [KEY.completedAt, Math.floor(payload.completedAt / 1000)],
    [KEY.resultId, hexToBytes(payload.resultId)],
  ]);
  if (payload.keyId) map.set(KEY.keyId, hexToBytes(payload.keyId));
  return map;
}

function payloadFrom(body: CborMap): ResultQrPayload {
  const text = (key: number) => {
    const value = body.get(key);
    if (typeof value !== 'string') throw new ResultQrError('malformed', 'The result QR is missing a field.');
    return value;
  };
  const integer = (key: number) => {
    const value = body.get(key);
    if (typeof value !== 'number') throw new ResultQrError('malformed', 'The result QR is missing a number.');
    return value;
  };
  const bytes = (key: number, length?: number) => {
    const value = body.get(key);
    if (!(value instanceof Uint8Array) || (length !== undefined && value.byteLength !== length)) {
      throw new ResultQrError('malformed', 'The result QR has an invalid binary field.');
    }
    return value;
  };
  const count = integer(KEY.count);
  try {
    return {
      studentId: text(KEY.studentId),
      quizId: text(KEY.quizId),
      quizVersion: integer(KEY.quizVersion),
      packageId: text(KEY.packageId),
      fingerprint: bytesToHex(bytes(KEY.fingerprint, 16)),
      attemptNumber: integer(KEY.attempt),
      questionCount: count,
      score: integer(KEY.score),
      totalPoints: integer(KEY.totalPoints),
      incorrect: bitsetToPositions(bytes(KEY.incorrect), count),
      unanswered: bitsetToPositions(bytes(KEY.unanswered), count),
      completedAt: integer(KEY.completedAt) * 1000,
      resultId: bytesToHex(bytes(KEY.resultId, 16)),
      keyId: body.has(KEY.keyId) ? bytesToHex(bytes(KEY.keyId, 8)) : null,
    };
  } catch (error) {
    if (error instanceof ResultQrError) throw error;
    throw new ResultQrError('malformed', error instanceof Error ? error.message : 'Malformed result.');
  }
}

function validatePayload(payload: ResultQrPayload, now = Date.now()): void {
  const shortText = (value: string, label: string) => {
    if (!value || value.length > 80) throw new Error(`The ${label} is missing or too long.`);
  };
  shortText(payload.studentId, 'student identifier');
  shortText(payload.quizId, 'quiz ID');
  shortText(payload.packageId, 'package ID');
  if (!/^[a-f0-9]{32}$/.test(payload.fingerprint)) throw new Error('The assessment fingerprint is malformed.');
  if (!/^[a-f0-9]{32}$/.test(payload.resultId)) throw new Error('The result ID is malformed.');
  if (payload.keyId !== null && !/^[a-f0-9]{16}$/.test(payload.keyId)) throw new Error('The key ID is malformed.');
  if (payload.quizVersion < 1 || payload.attemptNumber < 1 || payload.attemptNumber > 99) {
    throw new Error('The attempt or version metadata is malformed.');
  }
  if (payload.questionCount < 1 || payload.questionCount > 200) throw new Error('The question count is malformed.');
  if (payload.score > payload.totalPoints) throw new Error('The score exceeds the total points.');
  if (payload.incorrect.some((position) => payload.unanswered.includes(position))) {
    throw new Error('A question cannot be both incorrect and unanswered.');
  }
  const earliest = Date.UTC(2024, 0, 1);
  if (payload.completedAt < earliest || payload.completedAt > now + 86_400_000) {
    throw new Error('The completion timestamp is malformed.');
  }
}

function checksumOf(bodyBytes: Uint8Array): Uint8Array {
  return sha256Bytes(bodyBytes).slice(0, 8);
}

function signedMessage(bodyBytes: Uint8Array): Uint8Array {
  const message = new Uint8Array(SIGNATURE_DOMAIN.byteLength + bodyBytes.byteLength);
  message.set(SIGNATURE_DOMAIN);
  message.set(bodyBytes, SIGNATURE_DOMAIN.byteLength);
  return message;
}
