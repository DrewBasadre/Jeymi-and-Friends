import { describe, expect, it } from '@jest/globals';
import { strToU8, zipSync } from 'fflate';
import {
  MODULE_ARCHIVE_LIMITS,
  unzipModuleArchive,
} from '../src/domain/moduleArchive';

describe('module archive resource limits', () => {
  it('opens a bounded canonical archive', () => {
    const entries = unzipModuleArchive(
      zipSync({
        'manifest.json': strToU8('{}'),
        'lesson.md': strToU8('# Lesson'),
        'images/diagram.webp': new Uint8Array([1, 2, 3]),
      }),
    );

    expect(Object.keys(entries).sort()).toEqual([
      'images/diagram.webp',
      'lesson.md',
      'manifest.json',
    ]);
  });

  it('rejects highly compressed oversized Markdown before extraction', () => {
    const archive = zipSync(
      {
        'manifest.json': strToU8('{}'),
        'lesson.md': new Uint8Array(
          MODULE_ARCHIVE_LIMITS.markdownBytes + 1,
        ),
      },
      { level: 9 },
    );

    expect(() => unzipModuleArchive(archive)).toThrow(
      'lesson.md is too large',
    );
  });

  it('rejects traversal and unsupported extra files', () => {
    expect(() =>
      unzipModuleArchive(
        zipSync({
          'manifest.json': strToU8('{}'),
          '../lesson.md': strToU8('# Unsafe'),
        }),
      ),
    ).toThrow('Unsafe module package path');

    expect(() =>
      unzipModuleArchive(
        zipSync({
          'manifest.json': strToU8('{}'),
          'tracking.html': strToU8('<script />'),
        }),
      ),
    ).toThrow('Unsupported file');
  });
});
