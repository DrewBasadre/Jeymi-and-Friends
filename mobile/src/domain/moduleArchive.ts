import {
  unzipSync,
  type Unzipped,
  type UnzipFileInfo,
} from 'fflate';

export const MODULE_ARCHIVE_LIMITS = {
  archiveBytes: 32 * 1_024 * 1_024,
  expandedBytes: 64 * 1_024 * 1_024,
  files: 64,
  manifestBytes: 256 * 1_024,
  markdownBytes: 2 * 1_024 * 1_024,
  imageBytes: 8 * 1_024 * 1_024,
  audioBytes: 32 * 1_024 * 1_024,
  images: 24,
} as const;

export function unzipModuleArchive(bytes: Uint8Array): Unzipped {
  if (bytes.byteLength > MODULE_ARCHIVE_LIMITS.archiveBytes) {
    throw new Error('The module archive is larger than 32 MB.');
  }

  let fileCount = 0;
  let expandedBytes = 0;
  const paths = new Set<string>();
  const entries = unzipSync(bytes, {
    filter(file) {
      validateEntry(file);
      fileCount += 1;
      expandedBytes += file.originalSize;
      if (fileCount > MODULE_ARCHIVE_LIMITS.files) {
        throw new Error('The module archive contains too many files.');
      }
      if (expandedBytes > MODULE_ARCHIVE_LIMITS.expandedBytes) {
        throw new Error('The expanded module is larger than 64 MB.');
      }
      if (paths.has(file.name)) {
        throw new Error(`The module archive repeats ${file.name}.`);
      }
      paths.add(file.name);
      return true;
    },
  });
  if (!entries['manifest.json']) {
    throw new Error('The module package has no manifest.json.');
  }
  return entries;
}

function validateEntry(file: UnzipFileInfo): void {
  assertSafeArchivePath(file.name);
  const lowerName = file.name.toLocaleLowerCase();
  const limit =
    file.name === 'manifest.json'
      ? MODULE_ARCHIVE_LIMITS.manifestBytes
      : lowerName.endsWith('.md')
        ? MODULE_ARCHIVE_LIMITS.markdownBytes
        : lowerName.endsWith('.webp')
          ? MODULE_ARCHIVE_LIMITS.imageBytes
          : lowerName.endsWith('.mp3')
            ? MODULE_ARCHIVE_LIMITS.audioBytes
            : 0;
  if (!limit) {
    throw new Error(`Unsupported file in module archive: ${file.name}`);
  }
  if (file.originalSize > limit) {
    throw new Error(`${file.name} is too large for a WAIS module.`);
  }
}

function assertSafeArchivePath(value: string): void {
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
        !/^[A-Za-z0-9._-]+$/.test(segment),
    )
  ) {
    throw new Error(`Unsafe module package path: ${value}`);
  }
}
