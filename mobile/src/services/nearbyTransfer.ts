import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import type { EventSubscription } from 'expo-modules-core';
import { getDatabase } from '@/data/database';
import {
  findReceiveSession,
  findResumableSend,
  removeStaleSessions,
  saveTransferSession,
  type TransferSessionRecord,
} from '@/data/transferRepository';
import { PackageError, manifestDigest, readPackage, redistributionDecision, type TransferRole } from '@/domain/packageV2';
import { sha256Hex } from '@/domain/hash';
import {
  TERMINAL_STATES,
  TRANSFER_PROTOCOL_VERSION,
  advertisedName,
  decodeControl,
  encodeControl,
  evaluateOffer,
  nextTransferState,
  parseAdvertisedName,
  validateResponse,
  type TransferEvent,
  type TransferOffer,
  type TransferReceipt,
  type TransferState,
} from '@/domain/transferProtocol';
import type { TransferPackage } from '@/domain/types';
import { NEARBY_UNAVAILABLE_MESSAGES, nearby, type NearbyPeer, type NearbyProgress, type NearbyVerification } from './nearby';
import { importPackage, type ImportOutcome } from './packageImport';
import type { InstalledV2Package } from './packagesV2';

export interface SendablePackage {
  packageId: string;
  version: number;
  title: string;
  packageType: TransferOffer['packageType'];
  audience: 'student' | 'teacher';
  allowsStudentSharing: boolean;
  fileUri: string;
  sizeBytes: number;
  sha256: string;
  manifestDigest: string;
  expiresAt: number | null;
}

export function sendableFromInstalled(installed: InstalledV2Package): SendablePackage {
  const { manifest } = installed;
  return {
    packageId: manifest.packageId,
    version: manifest.version,
    title: manifest.title,
    packageType: manifest.packageType,
    audience: manifest.audience,
    allowsStudentSharing: manifest.redistribution.studentToStudent,
    fileUri: installed.archiveUri,
    sizeBytes: new File(installed.archiveUri).size,
    sha256: installed.archiveSha256,
    manifestDigest: manifestDigest(manifest),
    expiresAt: manifest.redistribution.expiresAt ? Date.parse(manifest.redistribution.expiresAt) : null,
  };
}

export function sendableFromLegacy(transferPackage: TransferPackage): SendablePackage {
  const manifest = transferPackage.manifest;
  const isModule = manifest.contentCategory === 'teacherModule';
  return {
    packageId: transferPackage.moduleId,
    version: manifest.version,
    title: transferPackage.displayName,
    packageType: isModule ? 'legacy_module' : 'legacy_study',
    audience: 'student',
    allowsStudentSharing: !isModule && manifest.contentCategory === 'studentMaterial',
    fileUri: transferPackage.fileUri,
    sizeBytes: transferPackage.sizeBytes,
    sha256: transferPackage.sha256,
    manifestDigest: sha256Hex(JSON.stringify(manifest)),
    expiresAt: null,
  };
}

export interface PeerView extends NearbyPeer {
  displayName: string;
  role: TransferRole | null;
  sessionCode: string | null;
}

export interface TransferSnapshot {
  state: TransferState;
  peers: PeerView[];
  peer: PeerView | null;
  verification: NearbyVerification | null;
  offer: TransferOffer | null;
  bytes: number;
  total: number;
  message: string | null;
  receipt: TransferReceipt | null;
  throughput: { seconds: number; bytesPerSecond: number } | null;
  sessionCode: string | null;
}

const INITIAL: TransferSnapshot = {
  state: 'preparing',
  peers: [],
  peer: null,
  verification: null,
  offer: null,
  bytes: 0,
  total: 0,
  message: null,
  receipt: null,
  throughput: null,
  sessionCode: null,
};

abstract class TransferSession {
  protected snapshot: TransferSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  protected subscriptions: Array<EventSubscription | null> = [];
  protected record: TransferSessionRecord | null = null;
  protected started = 0;
  private lastNotified = -1;

  constructor(
    protected readonly role: TransferRole,
    protected readonly localName: string,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  protected set(patch: Partial<TransferSnapshot>, event?: TransferEvent) {
    const state = event ? nextTransferState(this.snapshot.state, event) : (patch.state ?? this.snapshot.state);
    this.snapshot = { ...this.snapshot, ...patch, state };
    this.listeners.forEach((listener) => listener());
    if (this.record) {
      this.record = {
        ...this.record,
        state,
        bytesTransferred: this.snapshot.bytes,
        updatedAt: Date.now(),
        completedAt: state === 'completed' ? Date.now() : this.record.completedAt,
        errorMessage: TERMINAL_STATES.includes(state) && state !== 'completed' ? this.snapshot.message : null,
        receipt: this.snapshot.receipt,
      };
      void saveTransferSession(this.record);
    }
    if (TERMINAL_STATES.includes(state)) this.endForeground();
  }

  protected async ready(): Promise<boolean> {
    const availability = nearby.availability();
    if (!availability.available) {
      this.set({ message: NEARBY_UNAVAILABLE_MESSAGES[availability.reason], state: 'failed' });
      return false;
    }
    const permission = await nearby.native().requestPermissions().catch(() => ({ granted: false }));
    if (!permission.granted) {
      this.set({ message: 'Allow Nearby devices, Bluetooth, and location in Settings, then try again.' }, { type: 'permission_denied' });
      return false;
    }
    const staleIds = await removeStaleSessions();
    staleIds.forEach((transferId) => nearby.native().deletePartial(transferId));
    return true;
  }

  protected listen() {
    this.subscriptions.push(
      nearby.on('onPeersChanged', ({ peers }) => {
        const views = peers.map((peer) => ({ ...peer, ...parseAdvertisedName(peer.name) }));
        this.set({ peers: views }, views.length && this.snapshot.state === 'looking' ? { type: 'peer_found' } : undefined);
        this.onPeers(views);
      }),
      nearby.on('onVerificationCode', (verification) =>
        this.set({ verification, peer: this.peerFor(verification.peerId, verification.peerName) }, { type: 'verification_shown' }),
      ),
      nearby.on('onConnectionStateChanged', (update) => {
        if (update.state === 'connected') {
          this.set({ verification: null }, { type: 'connected' });
          void this.onConnected(update.peerId);
        } else if (update.state === 'rejected') {
          this.set({ verification: null, message: 'The connection was declined or the codes did not match. Nothing was transferred.', state: 'rejected' });
        } else if (!TERMINAL_STATES.includes(this.snapshot.state)) {
          this.set({ message: 'The other device disconnected.' }, { type: 'interrupted' });
        }
      }),
      nearby.on('onTextReceived', ({ peerId, text }) => {
        try {
          void this.onControl(peerId, decodeControl(text));
        } catch {
          // Ignore anything that is not a valid PAVO control message.
        }
      }),
      nearby.on('onTransferProgress', (progress) => this.onProgress(progress)),
      nearby.on('onNotificationCancel', () => void this.cancel()),
    );
  }

  protected peerFor(peerId: string, name: string): PeerView {
    return this.snapshot.peers.find((peer) => peer.id === peerId) ?? { id: peerId, name, ...parseAdvertisedName(name) };
  }

  async confirmCode(matches: boolean): Promise<void> {
    const verification = this.snapshot.verification;
    if (!verification) return;
    await nearby.native().acceptConnection(verification.peerId, matches).catch(() => undefined);
    if (matches) this.set({}, { type: 'verified' });
    else this.set({ verification: null, message: 'You reported that the codes did not match. Nothing was transferred.', state: 'rejected' });
  }

  async cancel(): Promise<void> {
    const { peer, offer } = this.snapshot;
    if (peer && offer) {
      await nearby.native().sendText(peer.id, encodeControl({ type: 'cancel', transferId: offer.transferId, reason: 'Cancelled by the other person.' })).catch(() => undefined);
    }
    this.set({ message: 'Transfer cancelled.' }, { type: 'cancel' });
    await this.release();
  }

  async release(): Promise<void> {
    this.endForeground();
    await nearby.native().stopAll().catch(() => undefined);
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription?.remove());
    this.subscriptions = [];
    void this.release();
  }

  protected beginForeground(title: string, text: string) {
    nearby.native().startForegroundTransfer(title, text);
  }

  protected updateForeground(text: string) {
    const percent = this.snapshot.total ? Math.floor((this.snapshot.bytes / this.snapshot.total) * 100) : 0;
    if (percent === this.lastNotified) return;
    this.lastNotified = percent;
    nearby.native().updateForegroundTransfer(text, percent);
  }

  private endForeground() {
    try {
      nearby.native().stopForegroundTransfer();
    } catch {
      // Not running.
    }
  }

  protected finishThroughput() {
    const seconds = Math.max(0.001, (Date.now() - this.started) / 1_000);
    return { seconds, bytesPerSecond: this.snapshot.total / seconds };
  }

  protected abstract onPeers(peers: PeerView[]): void;
  protected abstract onConnected(peerId: string): Promise<void>;
  protected abstract onControl(peerId: string, message: ReturnType<typeof decodeControl>): Promise<void>;
  protected abstract onProgress(progress: NearbyProgress): void;
}

/** Send mode: discover, pair with matching digits, offer, wait for approval, send, await receipt. */
export class SenderSession extends TransferSession {
  private payloadId: string | null = null;
  private targetCode: string | null = null;
  private offerSent: TransferOffer | null = null;

  constructor(
    role: TransferRole,
    localName: string,
    private readonly item: SendablePackage,
    private readonly receiverRole: TransferRole,
  ) {
    super(role, localName);
    this.snapshot = { ...INITIAL, total: item.sizeBytes };
  }

  async start(): Promise<void> {
    if (!(await this.ready())) return;
    this.listen();
    this.set({ message: null, peers: [] }, { type: 'search' });
    await nearby.native().startDiscovery().catch((error: Error) => this.set({ message: error.message }, { type: 'fail' }));
  }

  /** A pairing QR from the receiver picks their device automatically. */
  pairWithCode(code: string): void {
    this.targetCode = code;
    this.onPeers(this.snapshot.peers);
  }

  async select(peer: PeerView): Promise<void> {
    this.set({ peer, message: null });
    await nearby
      .native()
      .requestConnection(peer.id, advertisedName(this.localName, this.role, 'SEND'))
      .catch((error: Error) => this.set({ message: error.message }, { type: 'fail' }));
  }

  /** After an interruption: reconnect to the same person and resume from the saved offset. */
  async retry(): Promise<void> {
    const peer = this.snapshot.peer;
    if (!peer) return;
    this.targetCode = peer.sessionCode;
    this.set({ message: 'Looking for the same device again…' }, { type: 'reconnecting' });
    await nearby.native().startDiscovery().catch(() => undefined);
  }

  protected onPeers(peers: PeerView[]): void {
    if (!this.targetCode) return;
    const match = peers.find((peer) => peer.sessionCode === this.targetCode);
    if (match && (this.snapshot.state === 'looking' || this.snapshot.state === 'device_found' || this.snapshot.state === 'reconnecting')) {
      this.targetCode = null;
      void this.select(match);
    }
  }

  protected async onConnected(peerId: string): Promise<void> {
    const resumable = await findResumableSend(this.item.packageId, this.item.sha256);
    const peer = this.snapshot.peer ?? this.peerFor(peerId, peerId);
    const transferId = this.offerSent?.transferId ?? resumable?.transferId ?? `xfer_${Crypto.randomUUID()}`;
    const offer: TransferOffer = {
      type: 'offer',
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      sessionId: `session_${Crypto.randomUUID()}`,
      transferId,
      senderRole: this.role,
      receiverRole: peer.role ?? this.receiverRole,
      senderName: this.localName.slice(0, 60),
      packageType: this.item.packageType,
      packageAudience: this.item.audience,
      allowsStudentSharing: this.item.allowsStudentSharing,
      packageId: this.item.packageId,
      packageVersion: this.item.version,
      displayName: this.item.title.slice(0, 160),
      byteSize: this.item.sizeBytes,
      packageSha256: this.item.sha256,
      manifestDigest: this.item.manifestDigest,
      resumable: true,
      action: 'install',
      createdAt: Date.now(),
      expiresAt: this.item.expiresAt,
    };
    if (this.item.audience === 'teacher' && offer.receiverRole === 'student') {
      this.set({ message: 'Teacher bundles stay on teacher devices.', state: 'rejected' });
      await nearby.native().disconnect(peerId);
      return;
    }
    this.offerSent = offer;
    this.record = {
      transferId,
      sessionId: offer.sessionId,
      direction: 'send',
      packageId: this.item.packageId,
      packageVersion: this.item.version,
      displayName: this.item.title,
      peerName: peer.displayName,
      peerRole: offer.receiverRole,
      sizeBytes: this.item.sizeBytes,
      packageSha256: this.item.sha256,
      manifestDigest: this.item.manifestDigest,
      bytesTransferred: resumable?.bytesTransferred ?? 0,
      state: this.snapshot.state,
      fileUri: this.item.fileUri,
      offer,
      receipt: null,
      startedAt: resumable?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      errorMessage: null,
    };
    this.set({ peer, offer }, { type: 'offer_sent' });
    await nearby.native().sendText(peerId, encodeControl(offer)).catch((error: Error) => this.set({ message: error.message }, { type: 'fail' }));
  }

  protected async onControl(peerId: string, message: ReturnType<typeof decodeControl>): Promise<void> {
    const offer = this.offerSent;
    if (!offer) return;
    if (message.type === 'response' && message.transferId === offer.transferId) {
      const decision = validateResponse(offer, message);
      this.set({ message: decision.reason }, { type: 'response', response: message });
      if (!decision.send) {
        await this.release();
        return;
      }
      this.started = Date.now();
      this.set({ bytes: decision.offset });
      this.beginForeground(`Sending ${offer.displayName}`, `To ${this.snapshot.peer?.displayName ?? 'nearby device'}`);
      this.payloadId = await nearby
        .native()
        .sendFile(peerId, this.item.fileUri, decision.offset)
        .catch((error: Error) => {
          this.set({ message: error.message }, { type: 'fail' });
          return null;
        });
    } else if (message.type === 'receipt' && message.transferId === offer.transferId) {
      this.set({ receipt: message, message: message.message, throughput: this.finishThroughput() }, { type: 'receipt', receipt: message });
      await this.release();
    } else if (message.type === 'cancel' && message.transferId === offer.transferId) {
      this.set({ message: message.reason }, { type: 'cancel' });
      await this.release();
    }
  }

  protected onProgress(progress: NearbyProgress): void {
    if (progress.direction !== 'outgoing' || progress.payloadId !== this.payloadId) return;
    if (progress.status === 'in_progress') {
      this.set({ bytes: progress.bytesTransferred, total: progress.totalBytes }, { type: 'progress', resumed: this.snapshot.state === 'resuming' });
      this.updateForeground(`${Math.round((progress.bytesTransferred / Math.max(1, progress.totalBytes)) * 100)}% sent`);
    } else if (progress.status === 'success') {
      this.set({ bytes: progress.totalBytes, message: 'Waiting for the receiver to verify and import…' }, { type: 'file_complete' });
    } else {
      this.set({ bytes: progress.bytesTransferred, message: 'The transfer was interrupted. Retry to resume from where it stopped.' }, { type: 'interrupted' });
    }
  }

  override async cancel(): Promise<void> {
    if (this.payloadId) await nearby.native().cancelPayload(this.payloadId).catch(() => undefined);
    await super.cancel();
  }
}

/** Receive mode: advertise, verify digits, review the offer, approve, receive, verify, import, send a receipt. */
export class ReceiverSession extends TransferSession {
  private pendingOffer: { peerId: string; offer: TransferOffer; existingOffset: number } | null = null;
  private importing = false;
  lastImport: ImportOutcome | null = null;

  constructor(
    role: TransferRole,
    localName: string,
    private readonly ownerId: string,
  ) {
    super(role, localName);
  }

  async start(): Promise<void> {
    if (!(await this.ready())) return;
    this.listen();
    this.subscriptions.push(
      nearby.on('onFileReceived', (file) => void this.onFile(file)),
      nearby.on('onIncomingInterrupted', ({ partialBytes }) =>
        this.set({ bytes: partialBytes, message: 'The transfer was interrupted. Keep this screen open; the sender can resume.' }, { type: 'interrupted' }),
      ),
    );
    const sessionCode = Array.from(Crypto.getRandomBytes(4), (byte) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('');
    this.set({ sessionCode, message: null }, { type: 'search' });
    await nearby
      .native()
      .startAdvertising(advertisedName(this.localName, this.role, sessionCode))
      .catch((error: Error) => this.set({ message: error.message }, { type: 'fail' }));
  }

  protected onPeers(): void {}

  protected async onConnected(peerId: string): Promise<void> {
    this.set({ peer: this.snapshot.peer ?? this.peerFor(peerId, peerId) });
  }

  protected async onControl(peerId: string, message: ReturnType<typeof decodeControl>): Promise<void> {
    if (message.type === 'offer') {
      const previous = await findReceiveSession(message.transferId);
      const partialBytes = previous ? nearby.native().partialBytes(message.transferId) : 0;
      const response = evaluateOffer(message, {
        role: this.role,
        now: Date.now(),
        freeBytes: nearby.native().freeBytes(),
        installedSha256: await installedSha256(message.packageId, message.packageVersion),
        partial: previous ? { transferId: previous.transferId, packageSha256: previous.packageSha256, byteSize: previous.sizeBytes, bytes: partialBytes } : null,
      });
      this.record = {
        transferId: message.transferId,
        sessionId: message.sessionId,
        direction: 'receive',
        packageId: message.packageId,
        packageVersion: message.packageVersion,
        displayName: message.displayName,
        peerName: message.senderName,
        peerRole: message.senderRole,
        sizeBytes: message.byteSize,
        packageSha256: message.packageSha256,
        manifestDigest: message.manifestDigest,
        bytesTransferred: response.existingOffset,
        state: this.snapshot.state,
        fileUri: null,
        offer: message,
        receipt: null,
        startedAt: previous?.startedAt ?? Date.now(),
        updatedAt: Date.now(),
        completedAt: null,
        errorMessage: null,
      };
      if (!response.accepted) {
        await nearby.native().sendText(peerId, encodeControl(response)).catch(() => undefined);
        this.set({ offer: message, total: message.byteSize, message: response.reason }, { type: 'response', response });
        await this.release();
        return;
      }
      this.pendingOffer = { peerId, offer: message, existingOffset: response.existingOffset };
      this.set({ offer: message, total: message.byteSize, bytes: response.existingOffset }, { type: 'offer_received' });
    } else if (message.type === 'cancel' && this.snapshot.offer?.transferId === message.transferId) {
      nearby.native().deletePartial(message.transferId);
      this.set({ message: message.reason }, { type: 'cancel' });
      await this.release();
    }
  }

  /** The person's explicit decision after seeing name, type, sender, and size. */
  async decide(accept: boolean): Promise<void> {
    const pending = this.pendingOffer;
    if (!pending) return;
    this.pendingOffer = null;
    const { peerId, offer, existingOffset } = pending;
    const response = {
      type: 'response' as const,
      transferId: offer.transferId,
      accepted: accept,
      protocolVersion: TRANSFER_PROTOCOL_VERSION,
      existingOffset: accept ? existingOffset : 0,
      storage: 'ok' as const,
      duplicate: false,
      authorization: accept ? ('authorized' as const) : ('declined' as const),
      reason: accept ? null : 'The receiver declined this package.',
    };
    if (accept) {
      nearby.native().allowIncoming(peerId, offer.transferId, offer.byteSize, existingOffset);
      this.started = Date.now();
      this.beginForeground(`Receiving ${offer.displayName}`, `From ${offer.senderName}`);
    }
    await nearby.native().sendText(peerId, encodeControl(response)).catch(() => undefined);
    this.set({ message: response.reason }, { type: 'response', response });
    if (!accept) await this.release();
  }

  protected onProgress(progress: NearbyProgress): void {
    if (progress.direction !== 'incoming' || progress.transferId !== this.snapshot.offer?.transferId) return;
    if (progress.status === 'in_progress') {
      this.set({ bytes: progress.bytesTransferred }, { type: 'progress', resumed: this.snapshot.state === 'resuming' });
      this.updateForeground(`${Math.round((progress.bytesTransferred / Math.max(1, progress.totalBytes)) * 100)}% received`);
    } else if (progress.status === 'failure' && progress.errorMessage) {
      this.set({ message: progress.errorMessage }, { type: 'fail' });
    }
  }

  private async onFile(file: { transferId: string; peerId: string; fileUri: string; sizeBytes: number; sha256: string }) {
    const offer = this.snapshot.offer;
    if (!offer || file.transferId !== offer.transferId || this.importing) return;
    this.importing = true;
    this.set({ bytes: file.sizeBytes, message: null }, { type: 'file_complete' });
    const receipt = (status: TransferReceipt['status'], message: string): TransferReceipt => ({
      type: 'receipt',
      transferId: offer.transferId,
      packageId: offer.packageId,
      importedAt: Date.now(),
      receiverId: this.ownerId,
      finalSha256: file.sha256,
      status,
      message,
    });
    let result: TransferReceipt;
    try {
      if (file.sha256 !== offer.packageSha256 || file.sizeBytes !== offer.byteSize) {
        result = receipt('integrity_failure', 'The package did not match its announced checksum and was discarded.');
      } else {
        const bytes = new Uint8Array(await new File(file.fileUri).arrayBuffer());
        let blocked: string | null = null;
        try {
          const read = readPackage(bytes, { audience: this.role === 'student' ? 'student' : undefined });
          if (read.manifest.packageId !== offer.packageId || read.manifest.version !== offer.packageVersion || manifestDigest(read.manifest) !== offer.manifestDigest) {
            blocked = 'The package contents do not match the offer.';
          } else {
            const decision = redistributionDecision(read.manifest, offer.senderRole, this.role);
            if (!decision.allowed) blocked = decision.reason;
          }
        } catch (error) {
          if (!(error instanceof PackageError && error.code === 'legacy_format')) throw error;
        }
        if (blocked) {
          result = receipt('not_allowed', blocked);
        } else {
          this.set({}, { type: 'importing' });
          const outcome = await importPackage({
            fileUri: file.fileUri,
            role: this.role,
            ownerId: this.ownerId,
            installedFrom: 'nearby',
            expectedSha256: offer.packageSha256,
            displayName: offer.displayName,
          });
          this.lastImport = outcome;
          result = receipt(
            outcome.state === 'completed'
              ? 'imported'
              : outcome.state === 'duplicate'
                ? 'duplicate'
                : outcome.state === 'integrity_failure'
                  ? 'integrity_failure'
                  : outcome.state === 'unauthorized'
                    ? 'not_allowed'
                    : 'unsupported',
            outcome.message,
          );
        }
      }
    } catch (error) {
      result = receipt(error instanceof PackageError && error.code === 'integrity' ? 'integrity_failure' : 'unsupported', error instanceof Error ? error.message : 'The package could not be installed.');
    }
    nearby.native().deletePartial(offer.transferId);
    await nearby.native().sendText(file.peerId, encodeControl(result)).catch(() => undefined);
    this.set({ receipt: result, message: result.message, throughput: this.finishThroughput() }, { type: 'receipt', receipt: result });
    this.importing = false;
    await nearby.native().disconnect(file.peerId).catch(() => undefined);
    await this.release();
  }
}

async function installedSha256(packageId: string, version: number): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ archive_sha256: string }>(
    'SELECT archive_sha256 FROM pavo_packages WHERE package_id = ? AND version = ?',
    packageId,
    version,
  );
  return row?.archive_sha256 ?? null;
}

/** React binding: one session object per screen, disposed on unmount. */
export function useTransferSession<Session extends TransferSession>(factory: () => Session | null): { session: Session | null; snapshot: TransferSnapshot } {
  const [session] = useState(factory);
  const fallback = useRef({ subscribe: () => () => undefined, getSnapshot: () => INITIAL });
  const snapshot = useSyncExternalStore(session?.subscribe ?? fallback.current.subscribe, session?.getSnapshot ?? fallback.current.getSnapshot);
  useEffect(() => () => session?.dispose(), [session]);
  return { session, snapshot };
}
