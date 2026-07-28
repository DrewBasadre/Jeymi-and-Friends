import { describe, expect, it } from '@jest/globals';
import {
  dashboardMascotMessage,
  quizMascotMessage,
} from '../src/domain/motivation';

describe('deterministic mascot messages', () => {
  it('prioritizes due review work on the dashboard', () => {
    expect(
      dashboardMascotMessage({
        completedModules: 2,
        totalModules: 18,
        averageScore: 80,
        dueReviews: 4,
        totalAttempts: 3,
      }),
    ).toContain('4 review items');
  });

  it('changes quiz guidance by score band', () => {
    expect(
      quizMascotMessage({ correct: 5, total: 5, attemptNumber: 1 }),
    ).toContain('Excellent retrieval');
    expect(
      quizMascotMessage({ correct: 2, total: 5, attemptNumber: 2 }),
    ).toContain('Reopen the lesson');
  });
});
