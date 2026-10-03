import { z } from 'zod';
import { strFromU8, strToU8, unzipSync, zipSync, type UnzipFileInfo } from 'fflate';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalJson } from './canonicalJson';
import { sha256Hex } from './hash';
import { DELIVERY_MODES, stableIdSchema } from './assessmentModel';

/**
 * PAVO package format v2. Still a `.pavo-module` zip with `manifest.json`;
 * v1 archives (no `schemaVersion`) keep using the legacy installer.
 */
export const PACKAGE_SCHEMA_VERSION = 2 as const;
export const PAVO_APP_VERSION = '2.0.0';

const MB = 1_024 * 1_024;
export const PACKAGE_FILE_TYPES: Record<string, { mimeType: string; maxBytes: number }> = {
  '.md': { mimeType: 'text/markdown', maxBytes: 2 * MB },
  '.json': { mimeType: 'application/json', maxBytes: 512 * 1_024 },
  '.webp': { mimeType: 'image/webp', maxBytes: 8 * MB },
  '.png': { mimeType: 'image/png', maxBytes: 8 * MB },
  '.jpg': { mimeType: 'image/jpeg', maxBytes: 8 * MB },
  '.mp3': { mimeType: 'audio/mpeg', maxBytes: 32 * MB },
  '.pdf': { mimeType: 'application/pdf', maxBytes: 16 * MB },
  /** A teacher bundle carries the exact signed student package it pairs with. */
  '.pavo-module': { mimeType: 'application/vnd.pavo.package+zip', maxBytes: 40 * MB },
};
export const EMBEDDED_STUDENT_PACKAGE = 'student-package.pavo-module';
export const PACKAGE_LIMITS = {
  archiveBytes: 48 * MB,
  expandedBytes: 96 * MB,
  files: 80,
  manifestBytes: 256 * 1_024,
} as const;

/** Files that carry answer keys or grading data; never inside a student package. */
export const TEACHER_ONLY_FILES = [
  'assessment-guide.md',
  'quiz-definition.json',
  'answer-sheet-template.json',
  'quiz-paper.pdf',
  'answer-sheet.pdf',
] as const;

export const LICENSES = [
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-SA-4.0',
  'CC0-1.0',
  'School-Internal',
  'All-Rights-Reserved',
] as const;

const safePath = z
  .string()
  .min(1)
  .max(160)
  .refine((value) => isSafePath(value), 'Unsafe package path.');
const hex = (length: number) => z.string().regex(new RegExp(`^[a-f0-9]{${length}}$`));
const semver = z.string().regex(/^\d+\.\d+\.\d+$/);

const manifestFields = {
    schemaVersion: z.literal(PACKAGE_SCHEMA_VERSION),
    kind: z.literal('pavo-package'),
    packageId: stableIdSchema,
    version: z.number().int().min(1),
    packageType: z.enum(['lesson', 'quiz', 'teacher_bundle']),
    audience: z.enum(['student', 'teacher']),
    title: z.string().trim().min(1).max(160),
    author: z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(120) }),
    source: z.string().min(1).max(80),
    gradeLevel: z.number().int().min(1).max(12),
    subject: z.string().min(1).max(60),
    competencies: z.array(z.string().min(1).max(160)).max(30),
    assessment: z
      .object({
        quizId: stableIdSchema,
        quizVersion: z.number().int().min(1),
        mode: z.enum(DELIVERY_MODES),
        canonicalOrder: z.array(stableIdSchema).min(1).max(100),
        forms: z.array(z.object({ code: z.string().regex(/^[A-D]$/), fingerprint: hex(32) })).min(1).max(4),
      })
      .nullable(),
    files: z
      .array(z.object({ path: safePath, mimeType: z.string(), bytes: z.number().int().min(0), sha256: hex(64) }))
      .min(1)
      .max(PACKAGE_LIMITS.files),
    contentBytes: z.number().int().min(0),
    createdAt: z.iso.datetime(),
    attribution: z.object({
      authors: z.array(z.string().min(1).max(120)).min(1).max(20),
      license: z.enum(LICENSES),
      sourceUrl: z.url().nullable(),
      notice: z.string().max(600),
    }),
    redistribution: z.object({
      studentToStudent: z.boolean(),
      teacherToTeacher: z.boolean(),
      expiresAt: z.iso.datetime().nullable(),
    }),
    minPavoVersion: semver,
    provenance: z
      .object({
        aiAssisted: z.boolean(),
        model: z.string().max(80).nullable(),
        generatedAt: z.iso.datetime().nullable(),
        sourceIds: z.array(z.string().max(160)).max(40),
        approvedBy: z.string().max(120).nullable(),
        approvedAt: z.iso.datetime().nullable(),
        teacherEdited: z.boolean(),
      })
      .nullable(),
    signature: z.object({ alg: z.literal('ed25519'), publicKey: hex(64), value: hex(128) }).optional(),
  };

const manifestObject = z.object(manifestFields);

// Loose so fields added by newer PAVO versions survive parsing and signatures still verify.
export const packageManifestV2Schema = z
  .looseObject(manifestFields)
  .superRefine((manifest, context) => {
    const issue = (message: string, path: string) => context.addIssue({ code: 'custom', message, path: [path] });
    const paths = manifest.files.map((file) => file.path);
    if (new Set(paths).size !== paths.length) issue('File paths must be unique.', 'files');
    for (const file of manifest.files) {
      const rule = PACKAGE_FILE_TYPES[extensionOf(file.path)];
      if (!rule || rule.mimeType !== file.mimeType) issue(`${file.path} has an unsupported MIME type.`, 'files');
      if (rule && file.bytes > rule.maxBytes) issue(`${file.path} is too large.`, 'files');
    }
    if (manifest.contentBytes !== manifest.files.reduce((sum, file) => sum + file.bytes, 0)) {
      issue('contentBytes does not match the file list.', 'contentBytes');
    }
    if (manifest.audience === 'student') {
      const leaked = paths.filter((path) => (TEACHER_ONLY_FILES as readonly string[]).includes(path));
      if (leaked.length) issue(`Student packages cannot contain ${leaked.join(', ')}.`, 'files');
    }
    if (paths.some((path) => path.endsWith('.pavo-module') && (manifest.packageType !== 'teacher_bundle' || path !== EMBEDDED_STUDENT_PACKAGE))) {
      issue(`Only a teacher bundle may embed ${EMBEDDED_STUDENT_PACKAGE}.`, 'files');
    }
    if (manifest.packageType === 'teacher_bundle') {
      if (manifest.audience !== 'teacher') issue('Teacher bundles are teacher-only.', 'audience');
      if (manifest.redistribution.studentToStudent) issue('Teacher bundles cannot be shared between students.', 'redistribution');
    }
    if (manifest.packageType === 'lesson' && !paths.includes('adaptive-lesson.md')) {
      issue('Lesson packages need adaptive-lesson.md.', 'files');
    }
    if (manifest.packageType === 'quiz' && (!paths.includes('quiz.json') || manifest.assessment?.mode !== 'digital_mini_quiz')) {
      issue('Quiz packages need quiz.json and a digital assessment.', 'files');
    }
    if (paths.includes('quiz.json') && !manifest.assessment) issue('quiz.json needs assessment metadata.', 'assessment');
  });

export type PackageManifestV2 = z.infer<typeof manifestObject>;
export type PackageManifestDraft = Omit<
  PackageManifestV2,
  'schemaVersion' | 'kind' | 'files' | 'contentBytes' | 'signature' | 'minPavoVersion'
> & { minPavoVersion?: string };

export type PackageErrorCode =
  | 'too_large'
  | 'unsafe_path'
  | 'unsupported_file'
  | 'missing_manifest'
  | 'legacy_format'
  | 'invalid_manifest'
  | 'integrity'
  | 'expired'
  | 'incompatible'
  | 'unauthorized'
  | 'duplicate';

export class PackageError extends Error {
  constructor(
    readonly code: PackageErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function buildPackage(args: {
  manifest: PackageManifestDraft;
  files: Record<string, Uint8Array>;
  signerSecretKeyHex?: string;
}): { archive: Uint8Array; manifest: PackageManifestV2 } {
  const files = Object.keys(args.files)
    .sort()
    .map((path) => {
      const bytes = args.files[path]!;
      const rule = PACKAGE_FILE_TYPES[extensionOf(path)];
      if (!rule) throw new PackageError('unsupported_file', `${path} is not an allowed package file.`);
      return { path, mimeType: rule.mimeType, bytes: bytes.byteLength, sha256: sha256Hex(bytes) };
    });
  const unsigned = packageManifestV2Schema.parse({
    ...args.manifest,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    kind: 'pavo-package',
    minPavoVersion: args.manifest.minPavoVersion ?? PAVO_APP_VERSION,
    files,
    contentBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  });
  const manifest: PackageManifestV2 = args.signerSecretKeyHex
    ? { ...unsigned, signature: signManifest(unsigned, args.signerSecretKeyHex) }
    : unsigned;
  const entries: Record<string, Uint8Array> = { ...args.files, 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)) };
  const archive = zipSync(entries, { level: 6, mtime: new Date(Date.UTC(2020, 0, 1)) });
  if (archive.byteLength > PACKAGE_LIMITS.archiveBytes) {
    throw new PackageError('too_large', 'The package is larger than 48 MB.');
  }
  return { archive, manifest };
}

export interface PackageReadResult {
  manifest: PackageManifestV2;
  files: Record<string, Uint8Array>;
  signature: 'signed' | 'unsigned';
  signerKeyId: string | null;
}

/** Validates everything before a single file is written to device storage. */
export function readPackage(
  archive: Uint8Array,
  options: { now?: number; appVersion?: string; audience?: 'student' | 'teacher' } = {},
): PackageReadResult {
  if (archive.byteLength > PACKAGE_LIMITS.archiveBytes) {
    throw new PackageError('too_large', 'The package is larger than 48 MB.');
  }
  let count = 0;
  let expanded = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive, {
      filter(file: UnzipFileInfo) {
        if (!isSafePath(file.name)) throw new PackageError('unsafe_path', `Unsafe package path: ${file.name}`);
        const limit =
          file.name === 'manifest.json' ? PACKAGE_LIMITS.manifestBytes : PACKAGE_FILE_TYPES[extensionOf(file.name)]?.maxBytes;
        if (!limit) throw new PackageError('unsupported_file', `Unsupported file in package: ${file.name}`);
        if (file.originalSize > limit) throw new PackageError('too_large', `${file.name} is too large.`);
        count += 1;
        expanded += file.originalSize;
        if (count > PACKAGE_LIMITS.files + 1) throw new PackageError('too_large', 'The package has too many files.');
        if (expanded > PACKAGE_LIMITS.expandedBytes) throw new PackageError('too_large', 'The expanded package is too large.');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof PackageError) throw error;
    throw new PackageError('integrity', 'The package archive is damaged.');
  }
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new PackageError('missing_manifest', 'The package has no manifest.json.');
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new PackageError('invalid_manifest', 'manifest.json is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || (raw as { schemaVersion?: unknown }).schemaVersion !== PACKAGE_SCHEMA_VERSION) {
    throw new PackageError('legacy_format', 'This is a version 1 PAVO module.');
  }
  const parsed = packageManifestV2Schema.safeParse(raw);
  if (!parsed.success) {
    throw new PackageError('invalid_manifest', parsed.error.issues[0]?.message ?? 'The manifest is invalid.');
  }
  const manifest = parsed.data;

  const listed = new Set(manifest.files.map((file) => file.path));
  const present = Object.keys(entries).filter((path) => path !== 'manifest.json');
  const extra = present.filter((path) => !listed.has(path));
  if (extra.length) throw new PackageError('integrity', `The package contains unlisted files: ${extra.join(', ')}.`);
  for (const file of manifest.files) {
    const bytes = entries[file.path];
    if (!bytes) throw new PackageError('integrity', `The package is missing ${file.path}.`);
    if (bytes.byteLength !== file.bytes || sha256Hex(bytes) !== file.sha256) {
      throw new PackageError('integrity', `Checksum verification failed for ${file.path}.`);
    }
  }
  if (manifest.signature && !verifyManifest(manifest)) {
    throw new PackageError('integrity', 'The package signature does not match its contents.');
  }
  const now = options.now ?? Date.now();
  if (manifest.redistribution.expiresAt && Date.parse(manifest.redistribution.expiresAt) < now) {
    throw new PackageError('expired', 'This package has expired.');
  }
  if (compareVersions(manifest.minPavoVersion, options.appVersion ?? PAVO_APP_VERSION) > 0) {
    throw new PackageError('incompatible', `This package needs PAVO ${manifest.minPavoVersion} or newer.`);
  }
  if (options.audience === 'student' && manifest.audience !== 'student') {
    throw new PackageError('unauthorized', 'This is a teacher-only package.');
  }
  const files: Record<string, Uint8Array> = {};
  for (const path of present) files[path] = entries[path]!;
  return {
    manifest,
    files,
    signature: manifest.signature ? 'signed' : 'unsigned',
    signerKeyId: manifest.signature ? sha256Hex(hexToBytes(manifest.signature.publicKey)).slice(0, 16) : null,
  };
}

export type TransferRole = 'teacher' | 'student';

/** Who may hand this package to whom over Nearby. */
export function redistributionDecision(
  manifest: Pick<PackageManifestV2, 'audience' | 'packageType' | 'redistribution'>,
  from: TransferRole,
  to: TransferRole,
  now = Date.now(),
): { allowed: true } | { allowed: false; reason: string } {
  if (manifest.redistribution.expiresAt && Date.parse(manifest.redistribution.expiresAt) < now) {
    return { allowed: false, reason: 'This package has expired.' };
  }
  if (manifest.audience === 'teacher' && to === 'student') {
    return { allowed: false, reason: 'Teacher bundles contain answer keys and stay on teacher devices.' };
  }
  if (from === 'student' && to === 'student' && !manifest.redistribution.studentToStudent) {
    return { allowed: false, reason: 'The author has not allowed students to share this package.' };
  }
  if (from === 'teacher' && to === 'teacher' && !manifest.redistribution.teacherToTeacher) {
    return { allowed: false, reason: 'The author has not allowed teachers to re-share this package.' };
  }
  if (from === 'student' && to === 'teacher') {
    return { allowed: false, reason: 'Students return quiz results by QR, not by package transfer.' };
  }
  if (from === 'student' && manifest.audience === 'teacher') {
    return { allowed: false, reason: 'Students cannot share teacher packages.' };
  }
  return { allowed: true };
}

/** A teacher bundle pairs with the student package whose ID it extends. */
export function teacherBundleIdFor(studentPackageId: string): string {
  return `${studentPackageId}.teacher`;
}

export function studentPackageIdFor(teacherBundleId: string): string {
  return teacherBundleId.replace(/\.teacher$/, '');
}

export function packageKey(manifest: Pick<PackageManifestV2, 'packageId' | 'version'>): string {
  return `${manifest.packageId}@${manifest.version}`;
}

export function manifestDigest(manifest: PackageManifestV2): string {
  return sha256Hex(canonicalJson(manifest));
}

function signManifest(manifest: PackageManifestV2, secretKeyHex: string): NonNullable<PackageManifestV2['signature']> {
  const secret = hexToBytes(secretKeyHex);
  const publicKey = bytesToHex(ed25519.getPublicKey(secret));
  const value = bytesToHex(ed25519.sign(signingMessage(manifest), secret));
  return { alg: 'ed25519', publicKey, value };
}

function verifyManifest(manifest: PackageManifestV2): boolean {
  const { signature } = manifest;
  if (!signature) return false;
  try {
    return ed25519.verify(hexToBytes(signature.value), signingMessage(manifest), hexToBytes(signature.publicKey));
  } catch {
    return false;
  }
}

function signingMessage(manifest: PackageManifestV2): Uint8Array {
  const { signature: _signature, ...unsigned } = manifest;
  return utf8ToBytes(`PAVO_PACKAGE_V2|${canonicalJson(unsigned)}`);
}

export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function extensionOf(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpeg')) return '.jpg';
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

export function isSafePath(value: string): boolean {
  const segments = value.split('/');
  return (
    value.length > 0 &&
    value.length <= 160 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..' && /^[A-Za-z0-9._-]+$/.test(segment))
  );
}
