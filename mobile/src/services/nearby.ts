import {
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core';
import type { TransferPackage } from '@/domain/types';
import type { CurriculumModuleManifest } from '@/domain/types';
import { parseModuleManifest } from '@/domain/manifest';

export interface NearbyPeer {
  id: string;
  name: string;
  connected: boolean;
}

export interface NearbyTransferUpdate {
  transferId: string;
  status: 'queued' | 'connecting' | 'transferring' | 'complete' | 'failed' | 'cancelled';
  bytesTransferred: number;
  totalBytes: number;
  errorMessage?: string;
}

export interface NearbyVerificationRequest {
  peerId: string;
  peerName: string;
  code: string;
}

export interface NearbyConnectionUpdate {
  peerId: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'rejected' | 'failed';
  errorMessage?: string;
}

export interface NearbyReceivedFile {
  transferId: string;
  peerId: string;
  moduleId: string;
  displayName: string;
  fileUri: string;
  mimeType: TransferPackage['mimeType'];
  sizeBytes: number;
  sha256: string;
  manifestJson: string;
  manifest: CurriculumModuleManifest;
}

type WaisNearbyEvents = {
  onPeersChanged: (event: { peers: NearbyPeer[] }) => void;
  onVerificationCode: (event: NearbyVerificationRequest) => void;
  onConnectionStateChanged: (event: NearbyConnectionUpdate) => void;
  onTransferUpdate: (event: NearbyTransferUpdate) => void;
  onFileReceived: (event: NearbyReceivedFile) => void;
};

interface WaisNearbyModule {
  addListener<EventName extends keyof WaisNearbyEvents>(
    eventName: EventName,
    listener: WaisNearbyEvents[EventName],
  ): EventSubscription;
  isAvailable(): boolean;
  requestPermissions(): Promise<unknown>;
  startAdvertising(displayName: string): Promise<void>;
  stopAdvertising(): Promise<void>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  requestConnection(peerId: string): Promise<void>;
  acceptConnection(peerId: string, accept: boolean): Promise<void>;
  sendFile(peerId: string, metadataJson: string, fileUri: string): Promise<string>;
  retryTransfer(transferId: string): Promise<string>;
  cancelTransfer(transferId: string): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<WaisNearbyModule>('WaisNearby');

export const nearby = {
  isAvailable(): boolean {
    return nativeModule?.isAvailable() ?? false;
  },

  async advertise(displayName: string): Promise<void> {
    if (!nativeModule) throw unavailableError();
    await nativeModule.requestPermissions();
    await nativeModule.startAdvertising(displayName);
  },

  async discover(): Promise<void> {
    if (!nativeModule) throw unavailableError();
    await nativeModule.requestPermissions();
    await nativeModule.startDiscovery();
  },

  async connect(peerId: string): Promise<void> {
    if (!nativeModule) throw unavailableError();
    await nativeModule.requestConnection(peerId);
  },

  async answerVerification(peerId: string, accept: boolean): Promise<void> {
    if (!nativeModule) throw unavailableError();
    await nativeModule.acceptConnection(peerId, accept);
  },

  async send(peerId: string, transferPackage: TransferPackage): Promise<string> {
    if (!nativeModule) throw unavailableError();
    return nativeModule.sendFile(
      peerId,
      JSON.stringify({
        moduleId: transferPackage.moduleId,
        displayName: transferPackage.displayName,
        mimeType: transferPackage.mimeType,
        sizeBytes: transferPackage.sizeBytes,
        sha256: transferPackage.sha256,
        manifest: transferPackage.manifest,
      }),
      transferPackage.fileUri,
    );
  },

  async retry(transferId: string): Promise<string> {
    if (!nativeModule) throw unavailableError();
    return nativeModule.retryTransfer(transferId);
  },

  async cancel(transferId: string): Promise<void> {
    if (!nativeModule) throw unavailableError();
    await nativeModule.cancelTransfer(transferId);
  },

  addPeerListener(listener: (peers: NearbyPeer[]) => void): EventSubscription | null {
    return nativeModule?.addListener('onPeersChanged', (event) => listener(event.peers)) ?? null;
  },

  addTransferListener(listener: (update: NearbyTransferUpdate) => void): EventSubscription | null {
    return nativeModule?.addListener('onTransferUpdate', listener) ?? null;
  },

  addVerificationListener(
    listener: (request: NearbyVerificationRequest) => void,
  ): EventSubscription | null {
    return nativeModule?.addListener('onVerificationCode', listener) ?? null;
  },

  addConnectionListener(
    listener: (update: NearbyConnectionUpdate) => void,
  ): EventSubscription | null {
    return nativeModule?.addListener('onConnectionStateChanged', listener) ?? null;
  },

  addReceivedFileListener(
    listener: (file: NearbyReceivedFile) => void,
  ): EventSubscription | null {
    return (
      nativeModule?.addListener('onFileReceived', (file) => {
        const manifest = parseModuleManifest(JSON.parse(file.manifestJson));
        listener({ ...file, manifest });
      }) ?? null
    );
  },

  async stop(): Promise<void> {
    if (!nativeModule) return;
    await Promise.all([nativeModule.stopAdvertising(), nativeModule.stopDiscovery()]);
  },
};

function unavailableError(): Error {
  return new Error(
    'Nearby transfer is unavailable in this build. Install a custom development build on physical devices.',
  );
}
