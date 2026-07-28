import { describe, expect, it } from '@jest/globals';
import {
  learnerLevel,
  milestones,
  progressHeadline,
  rankTitle,
  studyPoints,
} from '../src/utils/progression';

describe('studyPoints', () => {
  it('is zero for a learner who has done nothing', () => {
    expect(studyPoints({})).toBe(0);
  });

  it('adds modules, attempts and mastery transparently', () => {
    // 2 modules (200) + 3 attempts (60) + 74% mastery (74)
    expect(
      studyPoints({ completedModules: 2, totalAttempts: 3, averageScore: 74 }),
    ).toBe(334);
  });

  it('ignores negative and out-of-range inputs', () => {
    expect(
      studyPoints({ completedModules: -5, totalAttempts: -1, averageScore: 900 }),
    ).toBe(100);
  });
});

describe('learnerLevel', () => {
  it('starts every learner at level 1', () => {
    const level = learnerLevel({});
    expect(level.level).toBe(1);
    expect(level.title).toBe('Novice');
    expect(level.progress).toBe(0);
    expect(level.pointsToNext).toBe(300);
  });

  it('carries leftover points into the next level', () => {
    // 400 points: level 1 costs 300, leaving 100 of the 450 level-2 needs.
    const level = learnerLevel({ completedModules: 4 });
    expect(level.points).toBe(400);
    expect(level.level).toBe(2);
    expect(level.pointsIntoLevel).toBe(100);
    expect(level.pointsForLevel).toBe(450);
    expect(level.pointsToNext).toBe(350);
  });

  it('keeps progress inside 0..1', () => {
    for (const modules of [0, 1, 5, 20, 200]) {
      const level = learnerLevel({ completedModules: modules, averageScore: 100 });
      expect(level.progress).toBeGreaterThanOrEqual(0);
      expect(level.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('rankTitle', () => {
  it('climbs through the scholarly bands', () => {
    expect(rankTitle(1)).toBe('Novice');
    expect(rankTitle(3)).toBe('Apprentice');
    expect(rankTitle(5)).toBe('Scholar');
    expect(rankTitle(8)).toBe('Adept');
    expect(rankTitle(12)).toBe('Luminary');
  });
});

describe('milestones', () => {
  it('earns nothing for a learner with no progress', () => {
    expect(milestones({}).every((item) => !item.earned)).toBe(true);
  });

  it('only lights up milestones the learner actually reached', () => {
    const earned = milestones({
      completedModules: 5,
      totalModules: 10,
      averageScore: 82,
      totalAttempts: 6,
      dueFlashcards: 2,
    })
      .filter((item) => item.earned)
      .map((item) => item.id);
    expect(earned).toEqual(['first-lesson', 'five-lessons', 'halfway', 'sharp']);
  });

  it('awards the full sweep only when every module is done', () => {
    const done = milestones({ completedModules: 4, totalModules: 4 });
    expect(done.find((item) => item.id === 'full-sweep')?.earned).toBe(true);
    const partial = milestones({ completedModules: 3, totalModules: 4 });
    expect(partial.find((item) => item.id === 'full-sweep')?.earned).toBe(false);
  });

  it('does not award a cleared deck to a learner who never practised', () => {
    const fresh = milestones({ totalAttempts: 0, dueFlashcards: 0 });
    expect(fresh.find((item) => item.id === 'cards-clear')?.earned).toBe(false);
  });
});

describe('progressHeadline', () => {
  it('celebrates a finished course', () => {
    expect(progressHeadline({ completedModules: 6, totalModules: 6 })).toContain(
      'Every module complete',
    );
  });

  it('points at due cards first', () => {
    expect(
      progressHeadline({ completedModules: 1, totalModules: 6, dueFlashcards: 1 }),
    ).toBe('1 card ready for review.');
  });

  it('invites a first lesson', () => {
    expect(progressHeadline({ completedModules: 0, totalModules: 6 })).toContain(
      'first lesson',
    );
  });

  it('counts what is left', () => {
    expect(progressHeadline({ completedModules: 4, totalModules: 6 })).toBe(
      '2 modules left to finish.',
    );
  });
});
