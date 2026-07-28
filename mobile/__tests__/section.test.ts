import { describe, expect, it } from '@jest/globals';
import {
  assignmentMatchesStudentSection,
  formatSectionLabel,
  parseSectionLabel,
} from '../src/domain/section';

describe('section labels', () => {
  it('formats a short student section as a canonical profile label', () => {
    expect(formatSectionLabel(5, 'Mabini')).toBe('Grade 5 - Mabini');
  });

  it('replaces an existing grade prefix instead of duplicating it', () => {
    expect(formatSectionLabel(4, 'Grade 4 - Sampaguita')).toBe(
      'Grade 4 - Sampaguita',
    );
    expect(parseSectionLabel('5 - Masipag')).toEqual({
      gradeLevel: 5,
      name: 'Masipag',
    });
  });

  it('matches canonical teacher labels to short student labels', () => {
    expect(
      assignmentMatchesStudentSection({
        classSection: 'Grade 5 - Mabini',
        studentGradeLevel: 5,
        studentSection: 'Mabini',
      }),
    ).toBe(true);
  });

  it('rejects a matching section name from the wrong grade', () => {
    expect(
      assignmentMatchesStudentSection({
        classSection: 'Grade 4 - Mabini',
        studentGradeLevel: 5,
        studentSection: 'Mabini',
      }),
    ).toBe(false);
  });
});
