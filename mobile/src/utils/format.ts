/**
 * Shared, user-facing text formatting.
 *
 * Every visible date in the app goes through `formatDate` so learners and
 * teachers always see the long, friendly form — e.g. "January 26, 2026" —
 * never a raw ISO string or a locale-ambiguous "01/26/26".
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input == null || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Parse date-only strings (YYYY-MM-DD) in local time to avoid TZ drift.
  const dateOnly = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Long, friendly date: "January 26, 2026". Returns '' for invalid input. */
export function formatDate(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** A deadline phrase: "Due January 26, 2026" (or '' when there is no date). */
export function formatDeadline(input: string | number | Date | null | undefined): string {
  const formatted = formatDate(input);
  return formatted ? `Due ${formatted}` : '';
}

/**
 * A friendly date range: "January 26 – February 1, 2026", collapsing the year
 * (and month when shared) so it reads cleanly.
 */
export function formatDateRange(
  start: string | number | Date | null | undefined,
  end: string | number | Date | null | undefined,
): string {
  const a = toDate(start);
  const b = toDate(end);
  if (a && b) {
    const sameYear = a.getFullYear() === b.getFullYear();
    const sameMonth = sameYear && a.getMonth() === b.getMonth();
    const left = sameMonth
      ? `${MONTHS[a.getMonth()]} ${a.getDate()}`
      : sameYear
        ? `${MONTHS[a.getMonth()]} ${a.getDate()}`
        : formatDate(a);
    return `${left} – ${formatDate(b)}`;
  }
  return formatDate(a ?? b);
}

/** Capitalize the first letter of a string (leaves the rest untouched). */
export function capitalize(value: string): string {
  return value ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : value;
}
