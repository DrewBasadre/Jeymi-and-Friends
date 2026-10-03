import { z } from 'zod';
import type { TransferRole } from './packageV2';

/**
 * PAVO offline transfer protocol, version 1. Control messages travel as small
 * BYTES payloads over an authenticated Nearby connection; the package itself
 * is one FILE payload that the receiver must approve first.
 *
 *   sender → offer → receiver (decides, person approves) → response → sender
 *   sender → FILE payload (from the agreed offset) → receiver, which only
 *   accepts a file it approved; receiver validates and imports → receipt.
 */
export const TRANSFER_PROTOCOL_VERSION = 1;
export const TRANSFER_PREFIX = 'PAVO-XFER/1 ';
export const MAX_CONTROL_BYTES = 16 * 1_024;
/** Partial files and unfinished sessions are kept this long for resuming. */
export const TRANSFER_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

const id = z.string().regex(/^[A-Za-z0-9._:@-]{1,120}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const role = z.enum(['teacher', 'student']);

export const offerSchema = z.object({
  type: z.literal('offer'),
  protocolVersion: z.number().int().min(1),
  sessionId: id,
  transferId: id,
  senderRole: role,
  receiverRole: role,
  senderName: z.string().min(1).max(60),
  packageType: z.enum(['lesson', 'quiz', 'teacher_bundle', 'legacy_module', 'legacy_study']),
  packageAudience: z.enum(['student', 'teacher']),
  allowsStudentSharing: z.boolean(),
  packageId: id,
  packageVersion: z.number().int().min(1),
  displayName: z.string().min(1).max(160),
  byteSize: z.number().int().min(1).max(48 * 1_024 * 1_024),
  packageSha256: sha,
  manifestDigest: sha,
  resumable: z.boolean(),
  action: z.literal('install'),
  createdAt: z.number().int(),
  expiresAt: z.number().int().nullable(),
});

export const responseSchema = z.object({
  type: z.literal('response'),
  transferId: id,
  accepted: z.boolean(),
  protocolVersion: z.number().int().min(1),
  existingOffset: z.number().int().min(0),
  storage: z.enum(['ok', 'insufficient']),
  duplicate: z.boolean(),
  authorization: z.enum(['authorized', 'not_allowed', 'unsupported_version', 'expired', 'declined']),
  reason: z.string().max(240).nullable(),
});

export const receiptSchema = z.object({
  type: z.literal('receipt'),
  transferId: id,
  packageId: id,
  importedAt: z.number().int(),
  receiverId: z.string().min(1).max(120),
  finalSha256: sha.nullable(),
  status: z.enum(['imported', 'duplicate', 'integrity_failure', 'unsupported', 'not_allowed', 'failed']),
  message: z.string().max(240),
});

export const cancelSchema = z.object({
  type: z.literal('cancel'),
  transferId: id,
  reason: z.string().max(240),
});

export const controlMessageSchema = z.discriminatedUnion('type', [offerSchema, responseSchema, receiptSchema, cancelSchema]);

export type TransferOffer = z.infer<typeof offerSchema>;
export type TransferResponse = z.infer<typeof responseSchema>;
export type TransferReceipt = z.infer<typeof receiptSchema>;
export type ControlMessage = z.infer<typeof controlMessageSchema>;

export function encodeControl(message: ControlMessage): string {
  const text = TRANSFER_PREFIX + JSON.stringify(controlMessageSchema.parse(message));
  if (text.length > MAX_CONTROL_BYTES) throw new Error('Transfer control message is too large.');
  return text;
}

export function decodeControl(text: string): ControlMessage {
  if (text.length > MAX_CONTROL_BYTES || !text.startsWith(TRANSFER_PREFIX)) {
    throw new Error('Not a PAVO transfer message.');
  }
  return controlMessageSchema.parse(JSON.parse(text.slice(TRANSFER_PREFIX.length)));
}

export interface ReceiverContext {
  role: TransferRole;
  now: number;
  freeBytes: number;
  /** SHA-256 of an installed copy with the same ID and version, if any. */
  installedSha256: string | null;
  /** A matching partial download kept from an interrupted session. */
  partial: { transferId: string; packageSha256: string; byteSize: number; bytes: number } | null;
}

/** Needed space: the archive, its extracted files, and a safety margin. */
export function requiredFreeBytes(byteSize: number): number {
  return byteSize * 3 + 8 * 1_024 * 1_024;
}

/** The receiver's automatic checks; the person still approves before bytes flow. */
export function evaluateOffer(offer: TransferOffer, context: ReceiverContext): TransferResponse {
  const base = {
    type: 'response' as const,
    transferId: offer.transferId,
    protocolVersion: TRANSFER_PROTOCOL_VERSION,
    existingOffset: 0,
    storage: 'ok' as const,
    duplicate: false,
  };
  const reject = (authorization: TransferResponse['authorization'], reason: string, extra: Partial<TransferResponse> = {}): TransferResponse => ({
    ...base,
    accepted: false,
    authorization,
    reason,
    ...extra,
  });
  if (offer.protocolVersion !== TRANSFER_PROTOCOL_VERSION) {
    return reject('unsupported_version', `This device speaks transfer protocol ${TRANSFER_PROTOCOL_VERSION}; update PAVO on both devices.`);
  }
  if (offer.expiresAt !== null && offer.expiresAt < context.now) return reject('expired', 'This transfer offer has expired.');
  if (offer.receiverRole !== context.role) return reject('not_allowed', `This package is meant for a ${offer.receiverRole}.`);
  if (offer.packageAudience === 'teacher' && context.role === 'student') {
    return reject('not_allowed', 'Teacher packages contain answer keys and cannot be sent to students.');
  }
  if (offer.senderRole === 'student' && context.role === 'student' && !offer.allowsStudentSharing) {
    return reject('not_allowed', 'The author has not allowed students to share this package.');
  }
  if (offer.senderRole === 'student' && context.role === 'teacher') {
    return reject('not_allowed', 'Students return quiz results by QR code, not by package transfer.');
  }
  if (context.installedSha256) {
    return reject('declined', `${offer.displayName} version ${offer.packageVersion} is already on this device.`, {
      duplicate: context.installedSha256 === offer.packageSha256,
    });
  }
  if (context.freeBytes < requiredFreeBytes(offer.byteSize)) {
    return reject('declined', 'There is not enough free space on this device.', { storage: 'insufficient' });
  }
  const partial = context.partial;
  const existingOffset =
    offer.resumable &&
    partial &&
    partial.transferId === offer.transferId &&
    partial.packageSha256 === offer.packageSha256 &&
    partial.byteSize === offer.byteSize &&
    partial.bytes > 0 &&
    partial.bytes < offer.byteSize
      ? partial.bytes
      : 0;
  return { ...base, accepted: true, authorization: 'authorized', reason: null, existingOffset };
}

/** Sender-side guard: never attach a resumed offset to a different package. */
export function validateResponse(offer: TransferOffer, response: TransferResponse): { send: boolean; offset: number; reason: string | null } {
  if (response.transferId !== offer.transferId) return { send: false, offset: 0, reason: 'The response is for a different transfer.' };
  if (!response.accepted) return { send: false, offset: 0, reason: response.reason ?? 'The receiver declined.' };
  if (response.existingOffset > offer.byteSize) return { send: false, offset: 0, reason: 'The receiver asked to resume past the end of the package.' };
  if (response.existingOffset > 0 && !offer.resumable) return { send: true, offset: 0, reason: null };
  return { send: true, offset: response.existingOffset, reason: null };
}

/* ── Session state machine ─────────────────────────────────────────── */

export type TransferState =
  | 'preparing'
  | 'looking'
  | 'device_found'
  | 'awaiting_verification'
  | 'connecting'
  | 'awaiting_approval'
  | 'sending'
  | 'paused'
  | 'reconnecting'
  | 'resuming'
  | 'verifying'
  | 'importing'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'insufficient_storage'
  | 'permission_denied'
  | 'unsupported_package'
  | 'integrity_failure'
  | 'duplicate_package';

export const TERMINAL_STATES: TransferState[] = [
  'completed',
  'rejected',
  'cancelled',
  'failed',
  'insufficient_storage',
  'permission_denied',
  'unsupported_package',
  'integrity_failure',
  'duplicate_package',
];

export type TransferEvent =
  | { type: 'prepared' }
  | { type: 'search' }
  | { type: 'peer_found' }
  | { type: 'verification_shown' }
  | { type: 'verified' }
  | { type: 'connected' }
  | { type: 'offer_sent' }
  | { type: 'offer_received' }
  | { type: 'response'; response: TransferResponse }
  | { type: 'progress'; resumed: boolean }
  | { type: 'interrupted' }
  | { type: 'reconnecting' }
  | { type: 'file_complete' }
  | { type: 'importing' }
  | { type: 'receipt'; receipt: TransferReceipt }
  | { type: 'permission_denied' }
  | { type: 'cancel' }
  | { type: 'fail' };

export function nextTransferState(state: TransferState, event: TransferEvent): TransferState {
  if (event.type === 'cancel') return TERMINAL_STATES.includes(state) ? state : 'cancelled';
  if (event.type === 'permission_denied') return 'permission_denied';
  if (TERMINAL_STATES.includes(state) && event.type !== 'search' && event.type !== 'prepared') return state;
  switch (event.type) {
    case 'prepared':
      return 'preparing';
    case 'search':
      return 'looking';
    case 'peer_found':
      return state === 'looking' ? 'device_found' : state;
    case 'verification_shown':
      return 'awaiting_verification';
    case 'verified':
      return 'connecting';
    case 'connected':
      return state === 'reconnecting' ? 'resuming' : 'connecting';
    case 'offer_sent':
    case 'offer_received':
      return 'awaiting_approval';
    case 'response':
      if (event.response.accepted) return event.response.existingOffset > 0 ? 'resuming' : 'sending';
      if (event.response.storage === 'insufficient') return 'insufficient_storage';
      if (event.response.duplicate) return 'duplicate_package';
      if (event.response.authorization === 'unsupported_version') return 'unsupported_package';
      return 'rejected';
    case 'progress':
      return event.resumed && state === 'resuming' ? 'resuming' : 'sending';
    case 'interrupted':
      return 'paused';
    case 'reconnecting':
      return 'reconnecting';
    case 'file_complete':
      return 'verifying';
    case 'importing':
      return 'importing';
    case 'receipt':
      return {
        imported: 'completed',
        duplicate: 'duplicate_package',
        integrity_failure: 'integrity_failure',
        unsupported: 'unsupported_package',
        not_allowed: 'rejected',
        failed: 'failed',
      }[event.receipt.status] as TransferState;
    case 'fail':
      return 'failed';
  }
}

export const TRANSFER_STATE_LABELS: Record<TransferState, string> = {
  preparing: 'Preparing',
  looking: 'Looking for devices',
  device_found: 'Device found',
  awaiting_verification: 'Awaiting verification',
  connecting: 'Connecting',
  awaiting_approval: 'Awaiting recipient approval',
  sending: 'Sending',
  paused: 'Paused',
  reconnecting: 'Reconnecting',
  resuming: 'Resuming',
  verifying: 'Verifying',
  importing: 'Importing',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  failed: 'Failed',
  insufficient_storage: 'Insufficient storage',
  permission_denied: 'Permission denied',
  unsupported_package: 'Unsupported package',
  integrity_failure: 'Integrity failure',
  duplicate_package: 'Duplicate package',
};

/** A short code in the advertised name lets a pairing QR pick the right device. */
export function advertisedName(displayName: string, role: TransferRole, sessionCode: string): string {
  const safe = displayName.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 28) || (role === 'teacher' ? 'Teacher' : 'Student');
  return `${safe} - ${role === 'teacher' ? 'Teacher' : 'Student'} · ${sessionCode}`;
}

export function parseAdvertisedName(name: string): { displayName: string; role: TransferRole | null; sessionCode: string | null } {
  const match = /^(.*) - (Teacher|Student) · ([A-Z0-9]{4})$/.exec(name);
  if (!match) return { displayName: name, role: null, sessionCode: null };
  return { displayName: match[1]!, role: match[2] === 'Teacher' ? 'teacher' : 'student', sessionCode: match[3]! };
}

export function pairingQr(sessionCode: string): string {
  return `PVP1:${sessionCode}`;
}

export function parsePairingQr(text: string): string | null {
  return /^PVP1:([A-Z0-9]{4})$/.exec(text.trim())?.[1] ?? null;
}

/** Sessions and partial files older than the retention window are deleted. */
export function isStale(session: { updatedAt: number; state: TransferState }, now: number): boolean {
  return now - session.updatedAt > TRANSFER_RETENTION_MS || (TERMINAL_STATES.includes(session.state) && now - session.updatedAt > 24 * 60 * 60 * 1_000);
}
