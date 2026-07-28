import { describe, expect, it } from '@jest/globals';
import {
  buildPdfManifest,
  moduleManifestSchema,
} from '../src/domain/manifest';

describe('curriculum module manifests', () => {
  it('uses the same canonical shape for teacher and OTA packages', () => {
    const teacher = buildPdfManifest({
      moduleId: 'fractions',
      fileName: 'fractions.pdf',
      sha256: 'a'.repeat(64),
      source: 'teacher-bluetooth',
      gradeLevel: 4,
      subject: 'Math',
    });
    const ota = { ...teacher, source: 'supabase-ota' as const };

    expect(moduleManifestSchema.parse(teacher).formats.text).toBe('fractions.pdf');
    expect(moduleManifestSchema.parse(ota).checksums['fractions.pdf']).toBe(
      `sha256:${'a'.repeat(64)}`,
    );
  });

  it('rejects malformed checksums before a package becomes usable', () => {
    expect(() =>
      moduleManifestSchema.parse({
        moduleId: 'fractions',
        version: 1,
        source: 'teacher-bluetooth',
        gradeLevel: 4,
        subject: 'Math',
        formats: { text: 'fractions.pdf' },
        checksums: { 'fractions.pdf': 'not-a-sha256' },
        quizId: 'fractions-quiz1',
        reviewItems: [],
      }),
    ).toThrow();
  });
});
