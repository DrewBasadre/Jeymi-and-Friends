import { Directory, File, Paths } from 'expo-file-system';
import ReactNativeBlobUtil from 'react-native-blob-util';
import type {
  CustomReviewSet,
  ReviewItem,
  TransferPackage,
} from '@/domain/types';
import { buildPdfManifest } from '@/domain/manifest';

const modulesDirectory = new Directory(Paths.document, 'modules');

export async function pickPdfPackage(): Promise<TransferPackage | null> {
  const result = await File.pickFileAsync({
    mimeTypes: ['application/pdf'],
    multipleFiles: false,
  });
  if (result.canceled) return null;
  const source = result.result;
  if (!modulesDirectory.exists) modulesDirectory.create({ intermediates: true, idempotent: true });
  const destination = new File(modulesDirectory, `${Date.now()}-${sanitizeName(source.name)}`);
  source.copy(destination);
  const sha256 = await sha256File(destination);
  return {
    moduleId: `pdf_${sha256.slice(0, 16)}`,
    displayName: source.name,
    fileUri: destination.uri,
    mimeType: 'application/pdf',
    sizeBytes: destination.size,
    sha256,
    manifest: buildPdfManifest({
      moduleId: `pdf_${sha256.slice(0, 16)}`,
      fileName: source.name,
      sha256,
      source: 'teacher-bluetooth',
      gradeLevel: 5,
      subject: 'ADDED_MATERIALS',
    }),
  };
}

export async function buildReviewSetPackage(
  set: CustomReviewSet,
  availableItems: ReviewItem[],
): Promise<TransferPackage> {
  if (!modulesDirectory.exists) {
    modulesDirectory.create({ intermediates: true, idempotent: true });
  }
  const selected = new Map(availableItems.map((item) => [item.itemId, item]));
  const reviewItems = [
    ...set.itemIds.flatMap((itemId) => {
      const item = selected.get(itemId);
      return item ? [item] : [];
    }),
    ...set.createdItems,
  ];
  const moduleId = `review_${set.setId}`;
  const fileName = `${sanitizeName(set.title).replace(/\.pdf$/i, '')}.wais.json`;
  const destination = new File(modulesDirectory, fileName);
  if (!destination.exists) destination.create({ intermediates: true });
  destination.write(
    JSON.stringify({
      packageType: 'wais-review-set',
      set,
      reviewItems,
    }),
  );
  const sha256 = await sha256File(destination);
  const manifest = {
    moduleId,
    version: 1,
    source: 'teacher-bluetooth' as const,
    gradeLevel: 5,
    subject: 'ADDED_MATERIALS',
    formats: { text: fileName },
    checksums: { [fileName]: `sha256:${sha256}` },
    quizId: `${moduleId}-quiz1`,
    reviewItems: reviewItems.map((item) => ({
      ...item,
      moduleId,
      moduleVersion: 1,
    })),
  };
  return {
    moduleId,
    displayName: `${set.title}.wais.json`,
    fileUri: destination.uri,
    mimeType: 'application/vnd.wais.module+json',
    sizeBytes: destination.size,
    sha256,
    manifest,
  };
}

export async function sha256File(file: File | string): Promise<string> {
  const target = typeof file === 'string' ? new File(file) : file;
  const path = decodeURIComponent(target.uri.replace(/^file:\/\//, ''));
  return (await ReactNativeBlobUtil.fs.hash(path, 'sha256')).toLocaleLowerCase();
}

export async function verifyPackage(fileUri: string, expectedSha256: string): Promise<boolean> {
  return (await sha256File(fileUri)) === expectedSha256.toLocaleLowerCase();
}

function sanitizeName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe.toLocaleLowerCase().endsWith('.pdf') ? safe : `${safe || 'module'}.pdf`;
}
