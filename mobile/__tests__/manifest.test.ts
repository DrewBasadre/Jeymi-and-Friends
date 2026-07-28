import { describe, expect, it } from '@jest/globals';
import {
  buildMarkdownManifest,
  moduleManifestSchema,
} from '../src/domain/manifest';

describe('curriculum module manifests', () => {
  it('uses the same canonical shape for teacher and OTA packages', () => {
    const teacher = buildMarkdownManifest({
      moduleId: 'fractions',
      source: 'teacher-bluetooth',
      gradeLevel: 4,
      subject: 'Math',
      markdownPath: 'fractions.md',
      assetPaths: ['images/fractions.webp'],
      checksums: {
        'fractions.md': `sha256:${'a'.repeat(64)}`,
        'images/fractions.webp': `sha256:${'b'.repeat(64)}`,
      },
    });
    const ota = { ...teacher, source: 'supabase-ota' as const };

    expect(moduleManifestSchema.parse(teacher).content.markdown).toBe(
      'fractions.md',
    );
    expect(moduleManifestSchema.parse(ota).checksums['fractions.md']).toBe(
      `sha256:${'a'.repeat(64)}`,
    );
    expect(Object.keys(teacher)).toEqual([
      'moduleId',
      'version',
      'source',
      'gradeLevel',
      'subject',
      'content',
      'assets',
      'checksums',
      'quizId',
    ]);
  });

  it('rejects malformed checksums before a package becomes usable', () => {
    expect(() =>
      moduleManifestSchema.parse({
        moduleId: 'fractions',
        version: 1,
        source: 'teacher-bluetooth',
        gradeLevel: 4,
        subject: 'Math',
        content: { markdown: 'fractions.md' },
        assets: [],
        checksums: { 'fractions.md': 'not-a-sha256' },
        quizId: 'fractions-quiz1',
      }),
    ).toThrow();
  });

  it('rejects traversal and missing asset checksums', () => {
    expect(() =>
      moduleManifestSchema.parse({
        moduleId: 'fractions',
        version: 1,
        source: 'teacher-bluetooth',
        gradeLevel: 4,
        subject: 'Math',
        content: { markdown: '../fractions.md' },
        assets: ['images/fractions.webp'],
        checksums: {
          '../fractions.md': `sha256:${'a'.repeat(64)}`,
        },
        quizId: 'fractions-quiz1',
      }),
    ).toThrow();
  });

  it('accepts only local MP3 audio paths', () => {
    expect(() =>
      moduleManifestSchema.parse({
        moduleId: 'fractions',
        version: 1,
        source: 'supabase-ota',
        gradeLevel: 4,
        subject: 'Math',
        content: {
          markdown: 'fractions.md',
          audio: 'https://example.com/fractions.mp3',
        },
        assets: [],
        checksums: {
          'fractions.md': `sha256:${'a'.repeat(64)}`,
          'https://example.com/fractions.mp3': `sha256:${'b'.repeat(64)}`,
        },
        quizId: 'fractions-quiz1',
      }),
    ).toThrow();
  });
});
