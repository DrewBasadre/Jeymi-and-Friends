import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export interface NearbyPeer {
  id: string;
  name: string;
}

export interface NearbyVerification {
  peerId: string;
  peerName: string;
  code: string;
  incoming: boolean;
}

export interface NearbyConnectionUpdate {
  peerId: string;
  state: 'connected' | 'rejected' | 'disconnected';
  errorMessage?: string | null;
}

export interface NearbyProgress {
  payloadId: string;
  peerId: string;
  direction: 'outgoing' | 'incoming';
  status: 'in_progress' | 'success' | 'failure' | 'canceled';
  transferId?: string;
  bytesTransferred: number;
  totalBytes: number;
  errorMessage?: string;
}

export interface NearbyReceivedFile {
  transferId: string;
  peerId: string;
  fileUri: string;
  sizeBytes: number;
  sha256: string;
}

type Events = {
  onPeersChanged: (event: { peers: NearbyPeer[] }) => void;
  onVerificationCode: (event: NearbyVerification) => void;
  onConnectionStateChanged: (event: NearbyConnectionUpdate) => void;
  onTextReceived: (event: { peerId: string; text: string }) => void;
  onTransferProgress: (event: NearbyProgress) => void;
  onFileReceived: (event: NearbyReceivedFile) => void;
  onIncomingInterrupted: (event: { transferId: string; partialBytes: number }) => void;
  onUnsolicitedFile: (event: { peerId: string }) => void;
  onNotificationCancel: (event: Record<string, never>) => void;
};

interface PavoNearbyNative {
  addListener<Name extends keyof Events>(name: Name, listener: Events[Name]): EventSubscription;
  isAvailable(): boolean;
  gmsStatus(): 'available' | 'update_required' | 'disabled' | 'missing';
  requestPermissions(): Promise<{ granted: boolean }>;
  freeBytes(): number;
  startAdvertising(name: string): Promise<void>;
  stopAdvertising(): Promise<void>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  requestConnection(peerId: string, localName: string): Promise<void>;
  acceptConnection(peerId: string, accept: boolean): Promise<void>;
  disconnect(peerId: string): Promise<void>;
  stopAll(): Promise<void>;
  sendText(peerId: string, text: string): Promise<void>;
  sendFile(peerId: string, fileUri: string, offset: number): Promise<string>;
  cancelPayload(payloadId: string): Promise<void>;
  allowIncoming(peerId: string, transferId: string, totalBytes: number, offset: number): void;
  clearIncoming(peerId: string): void;
  partialBytes(transferId: string): number;
  deletePartial(transferId: string): void;
  startForegroundTransfer(title: string, text: string): boolean;
  updateForegroundTransfer(text: string, percent: number): void;
  stopForegroundTransfer(): void;
}

const native = requireOptionalNativeModule<PavoNearbyNative>('PavoNearby');

export type NearbyAvailability =
  | { available: true }
  | { available: false; reason: 'no_native_module' | 'gms_missing' | 'gms_update_required' | 'gms_disabled' };

/** Thin typed bridge to the Kotlin transport. The session protocol lives in nearbyTransfer.ts. */
export const nearby = {
  availability(): NearbyAvailability {
    if (!native) return { available: false, reason: 'no_native_module' };
    const status = native.gmsStatus();
    if (status === 'available') return { available: true };
    return { available: false, reason: status === 'update_required' ? 'gms_update_required' : status === 'disabled' ? 'gms_disabled' : 'gms_missing' };
  },
  isAvailable(): boolean {
    return this.availability().available;
  },
  native(): PavoNearbyNative {
    if (!native) throw new Error('Nearby transfer needs the PAVO Android build on a physical device.');
    return native;
  },
  on<Name extends keyof Events>(name: Name, listener: Events[Name]): EventSubscription | null {
    return native?.addListener(name, listener) ?? null;
  },
};

export const NEARBY_UNAVAILABLE_MESSAGES: Record<Exclude<NearbyAvailability, { available: true }>['reason'], string> = {
  no_native_module: 'Nearby transfer needs the PAVO Android build on a physical device. You can still install a package file.',
  gms_missing:
    'This device has no Google Play services, which Nearby Connections needs. Share the .pavo-module file another way and use “Install a package file”.',
  gms_update_required: 'Update Google Play services on this device to use Nearby transfer.',
  gms_disabled: 'Turn Google Play services back on in Settings to use Nearby transfer.',
};
