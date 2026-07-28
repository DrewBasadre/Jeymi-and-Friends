import { Directory, File, Paths } from 'expo-file-system';
import { strFromU8, strToU8, zipSync } from 'fflate';
import { parseLearningPackageManifest } from '@/domain/manifest';
import { unzipModuleArchive } from '@/domain/moduleArchive';
import type {
  LearningPackageManifest,
  StudyPackageManifest,
  TransferPackage,
} from '@/domain/types';
import { sha256File } from './modulePackages';

const packageDirectory = new Directory(Paths.document, 'study-packages');
const teacherQuizModulePrefix = 'teacher-quiz:';

export function teacherQuizModuleId(packageId: string): string {
  return `${teacherQuizModulePrefix}${packageId}`;
}

export function isTeacherQuizModuleId(moduleId: string): boolean {
  return moduleId.startsWith(teacherQuizModulePrefix);
}

export async function buildLearningPackage(
  manifest: StudyPackageManifest,
): Promise<TransferPackage> {
  ensureDirectory();
  const safeTitle =
    manifest.title
      .toLocaleLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'study-package';
  const archive = zipSync(
    { 'manifest.json': strToU8(JSON.stringify(manifest)) },
    { level: 6 },
  );
  const file = new File(
    packageDirectory,
    `${safeTitle}-${manifest.packageId.slice(-8)}.pavo-module`,
  );
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  file.write(archive);
  return {
    moduleId: manifest.packageId,
    displayName: manifest.title,
    fileUri: file.uri,
    mimeType: 'application/vnd.pavo.study-package+zip',
    sizeBytes: file.size,
    sha256: await sha256File(file),
    manifest,
  };
}

export async function inspectLearningPackage(
  fileUri: string,
  displayName?: string,
): Promise<TransferPackage> {
  const file = new File(fileUri);
  const entries = unzipModuleArchive(
    new Uint8Array(await file.arrayBuffer()),
  );
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new Error('The package has no manifest.json.');
  const manifest = parseLearningPackageManifest(
    JSON.parse(strFromU8(manifestBytes)),
  );
  return {
    moduleId: packageIdentifier(manifest),
    displayName: displayName?.trim() || packageTitle(manifest),
    fileUri: file.uri,
    mimeType:
      manifest.contentCategory === 'teacherModule'
        ? 'application/vnd.pavo.module+zip'
        : 'application/vnd.pavo.study-package+zip',
    sizeBytes: file.size,
    sha256: await sha256File(file),
    manifest,
  };
}

export async function verifyReceivedStudyPackage(args: {
  fileUri: string;
  expectedSha256?: string;
  expectedManifest?: LearningPackageManifest;
}): Promise<StudyPackageManifest> {
  const inspected = await inspectLearningPackage(args.fileUri);
  if (
    args.expectedSha256 &&
    inspected.sha256 !== args.expectedSha256.toLocaleLowerCase()
  ) {
    throw new Error('The learning package checksum does not match.');
  }
  if (inspected.manifest.contentCategory === 'teacherModule') {
    throw new Error('Expected a study package, received a curriculum module.');
  }
  if (
    args.expectedManifest &&
    packageIdentifier(args.expectedManifest) !==
      inspected.manifest.packageId
  ) {
    throw new Error('The transferred metadata does not match the package.');
  }
  return inspected.manifest;
}

function packageIdentifier(manifest: LearningPackageManifest): string {
  return manifest.contentCategory === 'teacherModule'
    ? manifest.moduleId
    : manifest.packageId;
}

function packageTitle(manifest: LearningPackageManifest): string {
  return manifest.contentCategory === 'teacherModule'
    ? manifest.moduleId
    : manifest.title;
}

function ensureDirectory(): void {
  if (!packageDirectory.exists) {
    packageDirectory.create({ intermediates: true, idempotent: true });
  }
}
