import { HttpError } from './http.ts';

const UNSAFE_PATTERNS = [
  /\b(?:kill|suicide|self-harm)\b/i,
  /\b(?:sexual|pornograph)\w*\b/i,
  /\b(?:stupid|idiot|worthless)\b/i,
  /\b(?:diagnos(?:e|is)|disability|intelligence quotient|iq score)\b/i,
];

export function assertSafeEducationalOutput(value: unknown): void {
  const text = JSON.stringify(value);
  if (text.length > 30_000) {
    throw new HttpError(422, 'The generated draft is too long to display safely.');
  }
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new HttpError(
      422,
      'The generated draft did not pass the education content-safety check.',
    );
  }
}
