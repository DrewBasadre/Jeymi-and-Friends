import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { strFromU8, unzipSync } from 'fflate';
import { saveReceivedModulePackage } from '@/data/repository';
import { saveLearningPackage } from '@/data/learningRepository';
import { parseLearningPackageManifest } from '@/domain/manifest';
import { PackageError, type PackageErrorCode } from '@/domain/packageV2';
import { installPackageFile, type InstalledV2Package } from './packagesV2';
import { sha256File } from './modulePackages';
import { verifyReceivedStudyPackage } from './learningPackages';

export type ImportState =
  | 'completed'
  | 'duplicate'
  | 'unsupported'
  | 'integrity_failure'
  | 'expired'
  | 'incompatible'
  | 'unauthorized'
  | 'cancelled';

export interface ImportOutcome {
  state: ImportState;
  title: string;
  message: string;
  installed?: InstalledV2Package;
}

const STATE_FOR_CODE: Record<PackageErrorCode, ImportState> = {
  too_large: 'unsupported',
  unsafe_path: 'integrity_failure',
  unsupported_file: 'unsupported',
  missing_manifest: 'unsupported',
  legacy_format: 'unsupported',
  invalid_manifest: 'unsupported',
  integrity: 'integrity_failure',
  expired: 'expired',
  incompatible: 'incompatible',
  unauthorized: 'unauthorized',
  duplicate: 'duplicate',
};

const TITLES: Record<ImportState, string> = {
  completed: 'Package installed',
  duplicate: 'Already installed',
  unsupported: 'Unsupported package',
  integrity_failure: 'Integrity check failed',
  expired: 'Package expired',
  incompatible: 'Update PAVO first',
  unauthorized: 'Not for this device',
  cancelled: 'No file chosen',
};

/** Installs a received or picked package, falling back to the version 1 formats. */
export async function importPackage(args: {
  fileUri: string;
  role: 'student' | 'teacher';
  ownerId: string;
  installedFrom: 'nearby' | 'file';
  expectedSha256?: string;
  displayName?: string;
}): Promise<ImportOutcome> {
  try {
    const result = await installPackageFile(args);
    if (result.kind === 'v2') {
      const { manifest, signature } = result.installed;
      return {
        state: 'completed',
        title: TITLES.completed,
        message: `${manifest.title} (version ${manifest.version}) is ready offline. ${
          signature === 'signed' ? 'The author signature checked out.' : 'This package is unsigned; it passed every checksum.'
        }`,
        installed: result.installed,
      };
    }
    return await importLegacy(args);
  } catch (error) {
    const state = error instanceof PackageError ? STATE_FOR_CODE[error.code] : 'unsupported';
    return { state, title: TITLES[state], message: error instanceof Error ? error.message : 'The package could not be opened.' };
  }
}

export async function pickAndImportPackage(role: 'student' | 'teacher', ownerId: string): Promise<ImportOutcome> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets[0]) {
    return { state: 'cancelled', title: TITLES.cancelled, message: 'Choose a .pavo-module file to install.' };
  }
  const asset = picked.assets[0];
  if (!asset.name.toLowerCase().endsWith('.pavo-module')) {
    return { state: 'unsupported', title: TITLES.unsupported, message: 'PAVO packages end in .pavo-module.' };
  }
  return importPackage({ fileUri: asset.uri, role, ownerId, installedFrom: 'file', displayName: asset.name });
}

async function importLegacy(args: {
  fileUri: string;
  role: 'student' | 'teacher';
  ownerId: string;
  expectedSha256?: string;
  displayName?: string;
}): Promise<ImportOutcome> {
  const entries = unzipSync(new Uint8Array(await new File(args.fileUri).arrayBuffer()), {
    filter: (file) => file.name === 'manifest.json',
  });
  const manifest = parseLearningPackageManifest(JSON.parse(strFromU8(entries['manifest.json']!)));
  const sha256 = args.expectedSha256 ?? (await sha256File(args.fileUri));
  if (manifest.contentCategory === 'teacherModule') {
    await saveReceivedModulePackage({
      moduleId: manifest.moduleId,
      displayName: args.displayName ?? manifest.moduleId,
      fileUri: args.fileUri,
      sizeBytes: new File(args.fileUri).size,
      sha256,
      manifest,
    });
    return { state: 'completed', title: TITLES.completed, message: 'The module is in your library.' };
  }
  const verified = await verifyReceivedStudyPackage({ fileUri: args.fileUri, expectedSha256: sha256, expectedManifest: manifest });
  await saveLearningPackage({ ownerId: args.ownerId, manifest: verified, received: true });
  return { state: 'completed', title: TITLES.completed, message: `${verified.title} is in Study.` };
}
