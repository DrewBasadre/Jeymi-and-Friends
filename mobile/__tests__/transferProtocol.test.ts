import { describe, expect, it } from '@jest/globals';
import {
  TRANSFER_RETENTION_MS,
  advertisedName,
  decodeControl,
  encodeControl,
  evaluateOffer,
  isStale,
  nextTransferState,
  pairingQr,
  parseAdvertisedName,
  parsePairingQr,
  requiredFreeBytes,
  validateResponse,
  type ReceiverContext,
  type TransferOffer,
  type TransferState,
} from '../src/domain/transferProtocol';

const SHA = 'a'.repeat(64);
const NOW = Date.UTC(2026, 9, 4, 9);
const offer: TransferOffer = {
  type: 'offer',
  protocolVersion: 1,
  sessionId: 'session-1',
  transferId: 'transfer-1',
  senderRole: 'teacher',
  receiverRole: 'student',
  senderName: 'Ms. Reyes',
  packageType: 'quiz',
  packageAudience: 'student',
  allowsStudentSharing: false,
  packageId: 'plants-mini',
  packageVersion: 1,
  displayName: 'Plants mini-quiz',
  byteSize: 4_000,
  packageSha256: SHA,
  manifestDigest: 'b'.repeat(64),
  resumable: true,
  action: 'install',
  createdAt: NOW,
  expiresAt: NOW + 60_000,
};
const receiver: ReceiverContext = { role: 'student', now: NOW, freeBytes: 500 * 1_024 * 1_024, installedSha256: null, partial: null };

describe('transfer control messages', () => {
  it('round-trips and rejects foreign or oversized messages', () => {
    expect(decodeControl(encodeControl(offer))).toEqual(offer);
    expect(() => decodeControl('{"type":"offer"}')).toThrow('Not a PAVO transfer message');
    expect(() => decodeControl(`PAVO-XFER/1 ${JSON.stringify({ ...offer, byteSize: -1 })}`)).toThrow();
  });
});

describe('receiver authorization', () => {
  it('authorizes a teacher-to-student package with room to spare', () => {
    expect(evaluateOffer(offer, receiver)).toMatchObject({ accepted: true, authorization: 'authorized', existingOffset: 0, storage: 'ok' });
  });

  it('rejects teacher bundles for students and unauthorized student sharing', () => {
    expect(evaluateOffer({ ...offer, packageAudience: 'teacher' }, receiver)).toMatchObject({ accepted: false, authorization: 'not_allowed' });
    expect(evaluateOffer({ ...offer, senderRole: 'student' }, receiver)).toMatchObject({ accepted: false, authorization: 'not_allowed' });
    expect(evaluateOffer({ ...offer, senderRole: 'student', allowsStudentSharing: true }, receiver)).toMatchObject({ accepted: true });
    expect(evaluateOffer({ ...offer, senderRole: 'student', receiverRole: 'teacher' }, { ...receiver, role: 'teacher' })).toMatchObject({ accepted: false });
    expect(evaluateOffer({ ...offer, receiverRole: 'teacher' }, receiver).accepted).toBe(false);
  });

  it('detects duplicates, low storage, expiry, and protocol mismatches before any file is sent', () => {
    expect(evaluateOffer(offer, { ...receiver, installedSha256: SHA })).toMatchObject({ accepted: false, duplicate: true });
    expect(evaluateOffer(offer, { ...receiver, freeBytes: requiredFreeBytes(offer.byteSize) - 1 })).toMatchObject({ accepted: false, storage: 'insufficient' });
    expect(evaluateOffer({ ...offer, expiresAt: NOW - 1 }, receiver)).toMatchObject({ accepted: false, authorization: 'expired' });
    expect(evaluateOffer({ ...offer, protocolVersion: 2 }, receiver)).toMatchObject({ accepted: false, authorization: 'unsupported_version' });
  });

  it('resumes only the same transfer, package, and size', () => {
    const partial = { transferId: 'transfer-1', packageSha256: SHA, byteSize: 4_000, bytes: 1_500 };
    expect(evaluateOffer(offer, { ...receiver, partial }).existingOffset).toBe(1_500);
    expect(evaluateOffer(offer, { ...receiver, partial: { ...partial, packageSha256: 'c'.repeat(64) } }).existingOffset).toBe(0);
    expect(evaluateOffer(offer, { ...receiver, partial: { ...partial, transferId: 'transfer-2' } }).existingOffset).toBe(0);
    expect(evaluateOffer(offer, { ...receiver, partial: { ...partial, bytes: 4_000 } }).existingOffset).toBe(0);
  });

  it('never resumes past the end or on behalf of another transfer', () => {
    const accepted = evaluateOffer(offer, receiver);
    expect(validateResponse(offer, accepted)).toEqual({ send: true, offset: 0, reason: null });
    expect(validateResponse(offer, { ...accepted, existingOffset: 5_000 }).send).toBe(false);
    expect(validateResponse(offer, { ...accepted, transferId: 'other' }).send).toBe(false);
    expect(validateResponse({ ...offer, resumable: false }, { ...accepted, existingOffset: 100 })).toEqual({ send: true, offset: 0, reason: null });
  });
});

describe('transfer state machine', () => {
  const run = (events: Parameters<typeof nextTransferState>[1][], start: TransferState = 'preparing') =>
    events.reduce((state, event) => nextTransferState(state, event), start);
  const accepted = evaluateOffer(offer, receiver);

  it('walks a complete send', () => {
    expect(
      run([
        { type: 'search' },
        { type: 'peer_found' },
        { type: 'verification_shown' },
        { type: 'verified' },
        { type: 'connected' },
        { type: 'offer_sent' },
        { type: 'response', response: accepted },
        { type: 'progress', resumed: false },
        { type: 'file_complete' },
        { type: 'receipt', receipt: { type: 'receipt', transferId: 'transfer-1', packageId: 'plants-mini', importedAt: NOW, receiverId: 'student:ana', finalSha256: SHA, status: 'imported', message: 'ok' } },
      ]),
    ).toBe('completed');
  });

  it('pauses, reconnects, and resumes', () => {
    expect(run([{ type: 'interrupted' }, { type: 'reconnecting' }, { type: 'connected' }], 'sending')).toBe('resuming');
    expect(run([{ type: 'response', response: { ...accepted, existingOffset: 100 } }], 'awaiting_approval')).toBe('resuming');
  });

  it('maps every rejection to its own state and keeps terminal states', () => {
    expect(run([{ type: 'response', response: { ...accepted, accepted: false, storage: 'insufficient' } }], 'awaiting_approval')).toBe('insufficient_storage');
    expect(run([{ type: 'response', response: { ...accepted, accepted: false, duplicate: true } }], 'awaiting_approval')).toBe('duplicate_package');
    expect(run([{ type: 'response', response: { ...accepted, accepted: false, authorization: 'unsupported_version' } }], 'awaiting_approval')).toBe('unsupported_package');
    expect(run([{ type: 'response', response: { ...accepted, accepted: false, authorization: 'declined' } }], 'awaiting_approval')).toBe('rejected');
    expect(run([{ type: 'cancel' }, { type: 'progress', resumed: false }], 'sending')).toBe('cancelled');
    expect(run([{ type: 'permission_denied' }], 'looking')).toBe('permission_denied');
  });
});

describe('pairing helpers and retention', () => {
  it('advertises a safe role label and finds the session code', () => {
    const name = advertisedName('Ms. Reyes <script>', 'teacher', 'K7Q2');
    expect(name).toBe('Ms. Reyes script - Teacher · K7Q2');
    expect(parseAdvertisedName(name)).toEqual({ displayName: 'Ms. Reyes script', role: 'teacher', sessionCode: 'K7Q2' });
    expect(parsePairingQr(pairingQr('K7Q2'))).toBe('K7Q2');
    expect(parsePairingQr('PVR1:...')).toBeNull();
  });

  it('expires stale sessions after the documented retention period', () => {
    expect(isStale({ updatedAt: NOW, state: 'paused' }, NOW + TRANSFER_RETENTION_MS + 1)).toBe(true);
    expect(isStale({ updatedAt: NOW, state: 'paused' }, NOW + 1_000)).toBe(false);
    expect(isStale({ updatedAt: NOW, state: 'completed' }, NOW + 2 * 24 * 60 * 60 * 1_000)).toBe(true);
  });
});
