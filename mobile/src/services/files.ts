import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { TransferPackage } from '@/domain/types';

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
  };
}

export async function sha256File(file: File | string): Promise<string> {
  const target = typeof file === 'string' ? new File(file) : file;
  const bytes = await target.arrayBuffer();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function verifyPackage(fileUri: string, expectedSha256: string): Promise<boolean> {
  return (await sha256File(fileUri)) === expectedSha256.toLocaleLowerCase();
}

function sanitizeName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe.toLocaleLowerCase().endsWith('.pdf') ? safe : `${safe || 'module'}.pdf`;
}
