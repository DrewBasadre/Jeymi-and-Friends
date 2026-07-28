import { HttpError } from './http.ts';

const FORBIDDEN_IDENTIFIER_KEYS = new Set([
  'birthday',
  'email',
  'firstname',
  'fullname',
  'guardianname',
  'lastname',
  'middleinitial',
  'name',
  'pin',
  'rawanswer',
  'rawanswers',
  'section',
  'studentid',
  'studentnumber',
]);

export function assertNoDirectIdentifiers(value: unknown): void {
  visit(value);
}

function visit(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[_-]/g, '').toLocaleLowerCase();
    if (FORBIDDEN_IDENTIFIER_KEYS.has(normalized)) {
      throw new HttpError(
        400,
        `Direct student identifier "${key}" is not accepted by this service.`,
      );
    }
    visit(child);
  }
}
