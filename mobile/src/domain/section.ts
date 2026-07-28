export interface ParsedSectionLabel {
  gradeLevel: number | null;
  name: string;
}

export function parseSectionLabel(value: string): ParsedSectionLabel {
  const trimmed = value.trim();
  const match =
    /^grade\s*(\d{1,2})\s*[-:]\s*(.+)$/i.exec(trimmed) ??
    /^(\d{1,2})\s*[-:]\s*(.+)$/.exec(trimmed);
  if (!match) return { gradeLevel: null, name: trimmed };
  return {
    gradeLevel: Number(match[1]),
    name: match[2]!.trim(),
  };
}

export function formatSectionLabel(
  gradeLevel: number,
  section: string,
): string {
  const parsed = parseSectionLabel(section);
  return `Grade ${gradeLevel} - ${parsed.name}`;
}

export function assignmentMatchesStudentSection(args: {
  classSection: string;
  studentGradeLevel: number;
  studentSection: string;
}): boolean {
  const assigned = parseSectionLabel(args.classSection);
  const student = parseSectionLabel(args.studentSection);
  if (
    assigned.gradeLevel !== null &&
    assigned.gradeLevel !== args.studentGradeLevel
  ) {
    return false;
  }
  if (
    student.gradeLevel !== null &&
    student.gradeLevel !== args.studentGradeLevel
  ) {
    return false;
  }
  return normalizeName(assigned.name) === normalizeName(student.name);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
