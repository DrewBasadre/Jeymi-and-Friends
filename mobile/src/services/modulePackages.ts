import { Directory, File, Paths } from 'expo-file-system';
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { Image } from 'react-native';
import {
  strFromU8,
  strToU8,
  zipSync,
} from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  buildMarkdownManifest,
  parseModuleManifest,
} from '@/domain/manifest';
import {
  MODULE_ARCHIVE_LIMITS,
  unzipModuleArchive,
} from '@/domain/moduleArchive';
import type {
  CurriculumModuleManifest,
  ReviewItem,
  Subject,
  TransferPackage,
} from '@/domain/types';

const modulesDirectory = new Directory(Paths.document, 'modules');
const authoringDirectory = new Directory(Paths.cache, 'wais-authoring');
const MANIFEST_PATH = 'manifest.json';

export interface TeacherModuleImage {
  packagePath: string;
  fileUri: string;
  alt: string;
}

export interface TeacherModuleDraft {
  moduleId?: string;
  title: string;
  gradeLevel: number;
  subject: Subject;
  markdown: string;
  images: TeacherModuleImage[];
  reviewItems?: ReviewItem[];
}

export interface InstalledModulePackage {
  manifest: CurriculumModuleManifest;
  markdown: string;
  directoryUri: string;
  archiveSha256: string;
}

export async function pickAndProcessModuleImages(
  title: string,
): Promise<TeacherModuleImage[]> {
  const result = await File.pickFileAsync({
    mimeTypes: ['image/*'],
    multipleFiles: true,
  });
  if (result.canceled) return [];
  ensureDirectory(authoringDirectory);

  const batchId = Date.now().toString(36);
  const images: TeacherModuleImage[] = [];
  for (const [index, source] of result.result.entries()) {
    const dimensions = await getImageDimensions(source.uri);
    const context = ImageManipulator.manipulate(source.uri);
    const longestEdge = Math.max(dimensions.width, dimensions.height);
    if (longestEdge > 1080) {
      const scale = 1080 / longestEdge;
      context.resize({
        width: Math.max(1, Math.round(dimensions.width * scale)),
        height: Math.max(1, Math.round(dimensions.height * scale)),
      });
    }
    const processed = await (await context.renderAsync()).saveAsync({
      compress: 0.8,
      format: SaveFormat.WEBP,
    });
    const baseName = sanitizeSegment(
      source.name.replace(/\.[^.]+$/, '') || `${title}-${index + 1}`,
    );
    const fileName = `${baseName || 'photo'}-${batchId}-${index + 1}.webp`;
    const destination = new File(authoringDirectory, fileName);
    if (destination.exists) destination.delete();
    new File(processed.uri).copy(destination);
    images.push({
      packagePath: `images/${fileName}`,
      fileUri: destination.uri,
      alt: source.name.replace(/\.[^.]+$/, '') || `Lesson photo ${index + 1}`,
    });
  }
  return images;
}

export async function buildTeacherModulePackage(
  draft: TeacherModuleDraft,
): Promise<TransferPackage> {
  if (draft.images.length > MODULE_ARCHIVE_LIMITS.images) {
    throw new Error(`A module can contain at most ${MODULE_ARCHIVE_LIMITS.images} images.`);
  }
  const moduleId =
    draft.moduleId?.trim() ||
    `${sanitizeSegment(draft.title) || 'teacher-module'}-${Date.now().toString(36)}`;
  const markdownPath = `${moduleId}.md`;
  const markdownBytes = strToU8(draft.markdown);
  if (markdownBytes.byteLength > MODULE_ARCHIVE_LIMITS.markdownBytes) {
    throw new Error('Module Markdown must be 2 MB or smaller.');
  }
  const entries: Record<string, Uint8Array> = { [markdownPath]: markdownBytes };
  for (const image of draft.images) {
    assertSafePackagePath(image.packagePath);
    const bytes = new Uint8Array(
      await new File(image.fileUri).arrayBuffer(),
    );
    if (bytes.byteLength > MODULE_ARCHIVE_LIMITS.imageBytes) {
      throw new Error(`${image.packagePath} is larger than 8 MB.`);
    }
    entries[image.packagePath] = bytes;
  }

  const checksums: Record<string, string> = {};
  for (const [path, bytes] of Object.entries(entries)) {
    checksums[path] = `sha256:${await sha256Bytes(bytes)}`;
  }
  const manifest = buildMarkdownManifest({
    moduleId,
    source: 'teacher-bluetooth',
    gradeLevel: draft.gradeLevel,
    subject: draft.subject,
    markdownPath,
    assetPaths: draft.images.map((image) => image.packagePath),
    checksums,
    reviewItems: draft.reviewItems?.map((item) => ({
      ...item,
      moduleId,
      moduleVersion: 1,
    })),
  });
  entries[MANIFEST_PATH] = strToU8(JSON.stringify(manifest));
  const archive = zipSync(entries, { level: 6 });

  ensureDirectory(modulesDirectory);
  const archiveFile = new File(modulesDirectory, `${moduleId}.wais-module`);
  if (!archiveFile.exists) archiveFile.create({ intermediates: true });
  archiveFile.write(archive);
  const archiveSha256 = await sha256File(archiveFile);
  return {
    moduleId,
    displayName: draft.title,
    fileUri: archiveFile.uri,
    mimeType: 'application/vnd.wais.module+zip',
    sizeBytes: archiveFile.size,
    sha256: archiveSha256,
    manifest,
  };
}

export async function inspectModulePackage(
  fileUri: string,
  displayName?: string,
): Promise<TransferPackage> {
  const archiveFile = new File(fileUri);
  const entries = await readArchiveEntries(archiveFile);
  const manifestBytes = entries[MANIFEST_PATH];
  if (!manifestBytes) throw new Error('The module package has no manifest.json.');
  const manifest = parseModuleManifest(JSON.parse(strFromU8(manifestBytes)));
  return {
    moduleId: manifest.moduleId,
    displayName: displayName?.trim() || manifest.moduleId,
    fileUri: archiveFile.uri,
    mimeType: 'application/vnd.wais.module+zip',
    sizeBytes: archiveFile.size,
    sha256: await sha256File(archiveFile),
    manifest,
  };
}

export async function installModulePackage(args: {
  fileUri: string;
  expectedArchiveSha256?: string;
  expectedManifest?: CurriculumModuleManifest;
}): Promise<InstalledModulePackage> {
  const archiveFile = new File(args.fileUri);
  const archiveSha256 = await sha256File(archiveFile);
  if (
    args.expectedArchiveSha256 &&
    archiveSha256 !== args.expectedArchiveSha256.toLocaleLowerCase()
  ) {
    throw new Error('The module archive checksum does not match.');
  }

  const entries = await readArchiveEntries(archiveFile);
  const manifestBytes = entries[MANIFEST_PATH];
  if (!manifestBytes) throw new Error('The module package has no manifest.json.');
  const manifest = parseModuleManifest(JSON.parse(strFromU8(manifestBytes)));
  if (manifest.source !== 'teacher-bluetooth') {
    throw new Error(
      'This Android build only installs modules transferred by a teacher.',
    );
  }
  if (
    args.expectedManifest &&
    (args.expectedManifest.moduleId !== manifest.moduleId ||
      args.expectedManifest.version !== manifest.version)
  ) {
    throw new Error('The transferred manifest does not match the module archive.');
  }

  const requiredPaths = [
    manifest.content.markdown,
    ...(manifest.content.audio ? [manifest.content.audio] : []),
    ...manifest.assets,
  ];
  for (const path of requiredPaths) {
    assertSafePackagePath(path);
    const bytes = entries[path];
    if (!bytes) throw new Error(`The module package is missing ${path}.`);
    const expected = manifest.checksums[path]?.replace(/^sha256:/, '');
    if (!expected || (await sha256Bytes(bytes)) !== expected.toLocaleLowerCase()) {
      throw new Error(`Checksum verification failed for ${path}.`);
    }
  }

  ensureDirectory(modulesDirectory);
  const destination = new Directory(
    modulesDirectory,
    `${sanitizeSegment(manifest.moduleId)}-v${manifest.version}`,
  );
  ensureDirectory(destination);
  for (const path of requiredPaths) {
    const bytes = entries[path];
    if (!bytes) throw new Error(`The module package is missing ${path}.`);
    const file = new File(destination, path);
    ensureDirectory(file.parentDirectory);
    if (!file.exists) file.create({ intermediates: true });
    file.write(bytes);
  }
  const markdownBytes = entries[manifest.content.markdown];
  if (!markdownBytes) throw new Error('The module Markdown file is missing.');
  return {
    manifest,
    markdown: strFromU8(markdownBytes),
    directoryUri: destination.uri,
    archiveSha256,
  };
}

export async function sha256File(file: File | string): Promise<string> {
  const target = typeof file === 'string' ? new File(file) : file;
  return sha256Bytes(new Uint8Array(await target.arrayBuffer()));
}

export function markdownImageSnippet(image: TeacherModuleImage): string {
  return `![${image.alt}](${image.packagePath})`;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return bytesToHex(sha256(bytes));
}

function ensureDirectory(directory: Directory): void {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

function assertSafePackagePath(value: string): void {
  const segments = value.split('/');
  if (
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !/^[a-zA-Z0-9._-]+$/.test(segment),
    )
  ) {
    throw new Error(`Unsafe module package path: ${value}`);
  }
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readArchiveEntries(file: File) {
  if (file.size > MODULE_ARCHIVE_LIMITS.archiveBytes) {
    throw new Error('The module archive is larger than 32 MB.');
  }
  return unzipModuleArchive(new Uint8Array(await file.arrayBuffer()));
}

function getImageDimensions(
  uri: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}
