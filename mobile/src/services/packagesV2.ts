import { Directory, File, Paths } from 'expo-file-system';
import { strFromU8 } from 'fflate';
import { getDatabase } from '@/data/database';
import { installAssessmentFromGuide } from '@/data/assessmentRepository';
import { installStudentQuiz } from '@/data/studentQuizRepository';
import { parseAdaptiveLesson, lessonImagePaths } from '@/domain/adaptiveLesson';
import { parseAssessmentGuide } from '@/domain/assessmentGuide';
import { parseQuizDefinition, studentQuizSchema } from '@/domain/assessmentModel';
import { sha256Hex } from '@/domain/hash';
import type { AnswerSheetTemplate } from '@/domain/omr';
import {
  EMBEDDED_STUDENT_PACKAGE,
  PackageError,
  readPackage,
  studentPackageIdFor,
  type PackageManifestV2,
} from '@/domain/packageV2';

const root = new Directory(Paths.document, 'packages-v2');
const archives = new Directory(root, 'archives');

export interface InstalledV2Package {
  manifest: PackageManifestV2;
  signature: 'signed' | 'unsigned';
  signerKeyId: string | null;
  directoryUri: string;
  archiveUri: string;
  archiveSha256: string;
  installedFrom: string;
  installedAt: number;
}

export type InstallResult =
  | { kind: 'v2'; installed: InstalledV2Package }
  | { kind: 'legacy' };

/**
 * Validates a package completely, then installs it. Learner data never comes
 * from a package; quiz results arrive only by result QR.
 */
export async function installPackageFile(args: {
  fileUri: string;
  role: 'student' | 'teacher';
  installedFrom: 'nearby' | 'file' | 'authored' | 'embedded';
  expectedSha256?: string;
}): Promise<InstallResult> {
  const bytes = new Uint8Array(await new File(args.fileUri).arrayBuffer());
  return installPackageBytes({ ...args, bytes });
}

export async function installPackageBytes(args: {
  bytes: Uint8Array;
  role: 'student' | 'teacher';
  installedFrom: 'nearby' | 'file' | 'authored' | 'embedded';
  expectedSha256?: string;
}): Promise<InstallResult> {
  const archiveSha256 = sha256Hex(args.bytes);
  if (args.expectedSha256 && archiveSha256 !== args.expectedSha256.toLowerCase()) {
    throw new PackageError('integrity', 'The received package does not match the checksum the sender announced.');
  }
  let read;
  try {
    read = readPackage(args.bytes, { audience: args.role === 'student' ? 'student' : undefined });
  } catch (error) {
    if (error instanceof PackageError && error.code === 'legacy_format') return { kind: 'legacy' };
    throw error;
  }
  const { manifest, files } = read;
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ archive_sha256: string }>(
    'SELECT archive_sha256 FROM pavo_packages WHERE package_id = ? AND version = ?',
    manifest.packageId,
    manifest.version,
  );
  if (existing?.archive_sha256 === archiveSha256) {
    throw new PackageError('duplicate', `${manifest.title} version ${manifest.version} is already on this device.`);
  }
  if (existing) {
    throw new PackageError(
      'integrity',
      `A different copy of ${manifest.title} version ${manifest.version} is already installed. Ask the author for a new version.`,
    );
  }

  if (files['adaptive-lesson.md']) {
    const lesson = parseAdaptiveLesson(strFromU8(files['adaptive-lesson.md']));
    const missing = lessonImagePaths(lesson).filter((path) => !files[path]);
    if (missing.length) throw new PackageError('integrity', `The lesson references missing images: ${missing.join(', ')}.`);
  }
  const guide = files['assessment-guide.md'] ? parseAssessmentGuide(strFromU8(files['assessment-guide.md'])) : null;
  const studentQuiz = files['quiz.json'] ? studentQuizSchema.parse(JSON.parse(strFromU8(files['quiz.json']))) : null;
  if (studentQuiz && manifest.assessment) {
    const form = manifest.assessment.forms.find((candidate) => candidate.fingerprint === studentQuiz.fingerprint);
    if (!form || studentQuiz.quizId !== manifest.assessment.quizId || studentQuiz.version !== manifest.assessment.quizVersion) {
      throw new PackageError('integrity', 'quiz.json does not match the package assessment metadata.');
    }
  }
  if (guide && manifest.assessment && guide.quizId !== manifest.assessment.quizId) {
    throw new PackageError('integrity', 'assessment-guide.md belongs to a different quiz.');
  }
  const embedded = files[EMBEDDED_STUDENT_PACKAGE];
  if (embedded) readPackage(embedded, { audience: 'student' });

  const directory = new Directory(root, `${safe(manifest.packageId)}-v${manifest.version}`);
  if (directory.exists) directory.delete();
  directory.create({ intermediates: true });
  for (const [path, content] of Object.entries(files)) {
    if (path === EMBEDDED_STUDENT_PACKAGE) continue;
    const file = new File(directory, path);
    if (!file.parentDirectory.exists) file.parentDirectory.create({ intermediates: true, idempotent: true });
    file.create({ overwrite: true });
    file.write(content);
  }
  if (!archives.exists) archives.create({ intermediates: true, idempotent: true });
  const archiveFile = new File(archives, `${safe(manifest.packageId)}-v${manifest.version}.pavo-module`);
  archiveFile.create({ overwrite: true });
  archiveFile.write(args.bytes);

  const installedAt = Date.now();
  await database.runAsync(
    `INSERT INTO pavo_packages (
       package_id, version, package_type, audience, title, manifest_json, archive_sha256,
       signature_state, signer_key_id, directory_uri, installed_from, installed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    manifest.packageId,
    manifest.version,
    manifest.packageType,
    manifest.audience,
    manifest.title,
    JSON.stringify(manifest),
    archiveSha256,
    read.signature,
    read.signerKeyId,
    directory.uri,
    args.installedFrom,
    installedAt,
  );

  if (guide && args.role === 'teacher') {
    await installAssessmentFromGuide({
      guideMarkdown: strFromU8(files['assessment-guide.md']!),
      definition: files['quiz-definition.json'] ? parseQuizDefinition(JSON.parse(strFromU8(files['quiz-definition.json']))) : null,
      template: files['answer-sheet-template.json']
        ? (JSON.parse(strFromU8(files['answer-sheet-template.json'])) as AnswerSheetTemplate)
        : null,
      studentPackageId: studentPackageIdFor(manifest.packageId),
      origin: 'installed',
    });
  }
  if (studentQuiz && args.role === 'student') {
    await installStudentQuiz({ quiz: studentQuiz, packageId: manifest.packageId });
  }
  if (embedded && args.role === 'teacher') {
    try {
      await installPackageBytes({ bytes: embedded, role: 'teacher', installedFrom: 'embedded' });
    } catch (error) {
      if (!(error instanceof PackageError && error.code === 'duplicate')) throw error;
    }
  }
  return {
    kind: 'v2',
    installed: {
      manifest,
      signature: read.signature,
      signerKeyId: read.signerKeyId,
      directoryUri: directory.uri,
      archiveUri: archiveFile.uri,
      archiveSha256,
      installedFrom: args.installedFrom,
      installedAt,
    },
  };
}

export async function listInstalledPackages(filter?: {
  audience?: 'student' | 'teacher';
  packageType?: PackageManifestV2['packageType'];
}): Promise<InstalledV2Package[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    manifest_json: string;
    signature_state: 'signed' | 'unsigned';
    signer_key_id: string | null;
    directory_uri: string;
    archive_sha256: string;
    installed_from: string;
    installed_at: number;
    package_id: string;
    version: number;
  }>(
    `SELECT * FROM pavo_packages
     WHERE (? IS NULL OR audience = ?) AND (? IS NULL OR package_type = ?)
     ORDER BY installed_at DESC`,
    filter?.audience ?? null,
    filter?.audience ?? null,
    filter?.packageType ?? null,
    filter?.packageType ?? null,
  );
  return rows.map((row) => ({
    manifest: JSON.parse(row.manifest_json) as PackageManifestV2,
    signature: row.signature_state,
    signerKeyId: row.signer_key_id,
    directoryUri: row.directory_uri,
    archiveUri: new File(archives, `${safe(row.package_id)}-v${row.version}.pavo-module`).uri,
    archiveSha256: row.archive_sha256,
    installedFrom: row.installed_from,
    installedAt: row.installed_at,
  }));
}

export async function getInstalledPackage(packageId: string, version?: number): Promise<InstalledV2Package | null> {
  const all = await listInstalledPackages();
  return all.find((item) => item.manifest.packageId === packageId && (version === undefined || item.manifest.version === version)) ?? null;
}

export function readInstalledText(installed: Pick<InstalledV2Package, 'directoryUri'>, path: string): string {
  return new File(new Directory(installed.directoryUri), path).textSync();
}

export function installedFileUri(installed: Pick<InstalledV2Package, 'directoryUri'>, path: string): string {
  return new File(new Directory(installed.directoryUri), path).uri;
}

/** Saves a package built on this device so it can be sent over Nearby. */
export async function installAuthoredArchive(bytes: Uint8Array, role: 'student' | 'teacher'): Promise<InstalledV2Package> {
  const result = await installPackageBytes({ bytes, role, installedFrom: 'authored' });
  if (result.kind !== 'v2') throw new Error('Authored packages must use format v2.');
  return result.installed;
}

function safe(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}
