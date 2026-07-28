import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { HttpError } from './http.ts';
import { assertNoDirectIdentifiers } from './privacy.ts';

Deno.test('allows aggregated diagnostic data', () => {
  assertNoDirectIdentifiers({
    gradeLevel: 5,
    scoreBand: 'DEVELOPING',
    topicOutcomeCounts: [{ topic: 'Fractions', correct: 3, incorrect: 2 }],
    learningStyleTag: 'visual',
  });
});

Deno.test('rejects direct identifiers at any nesting depth', () => {
  const error = assertThrows(
    () =>
      assertNoDirectIdentifiers({
        scoreBand: 'LOW',
        context: { student_number: '2026-001' },
      }),
    HttpError,
  );
  assertEquals(error.status, 400);
});

Deno.test('rejects raw answer fields', () => {
  assertThrows(
    () =>
      assertNoDirectIdentifiers({
        topicOutcomeCounts: [],
        rawAnswers: ['A', 'B'],
      }),
    HttpError,
  );
});
