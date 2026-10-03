// Dependency-free so the Deno edge function and the Jest suite share one copy.
// ponytail: pattern-based, catches contact details and ID numbers, not names in free prose.
const PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  [/(?:\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],
  [/\b\d{10,}\b/g, '[id number]'],
];

export function redactPersonalData(text: string): string {
  return PATTERNS.reduce((value, [pattern, label]) => value.replace(pattern, label), text);
}
