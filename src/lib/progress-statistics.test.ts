// src/lib/progress-statistics.test.ts

import { describe, expect, it } from 'vitest';
import { createInitialWordProgress, type DailyStats, type WordProgress } from '@/types';
import { calculateProgressStatistics } from './progress-statistics';

const NOW = new Date('2026-08-10T12:00:00.000Z');

function makeProgress(
  wordId: string,
  lastReviewedAt: string,
  counts: {
    readonly recognitionCorrect?: number;
    readonly recognitionIncorrect?: number;
    readonly productionCorrect?: number;
    readonly productionIncorrect?: number;
  } = {}
): WordProgress {
  const progress = createInitialWordProgress(wordId);
  return {
    ...progress,
    lastReviewedAt,
    recognition: {
      ...progress.recognition,
      correctCount: counts.recognitionCorrect ?? 0,
      incorrectCount: counts.recognitionIncorrect ?? 0
    },
    production: {
      ...progress.production,
      correctCount: counts.productionCorrect ?? 0,
      incorrectCount: counts.productionIncorrect ?? 0
    }
  };
}

function makeTodayStats(overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    date: '2026-08-10',
    wordsStudied: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    timeSpentMinutes: 0,
    ...overrides
  };
}

describe('calculateProgressStatistics', () => {
  it('separates unique practiced words from submitted answer attempts', () => {
    const first = makeProgress('word-1', '2026-08-10T09:00:00.000Z', {
      recognitionCorrect: 2,
      productionIncorrect: 1
    });
    const second = makeProgress('word-2', '2026-08-09T09:00:00.000Z', {
      productionCorrect: 1
    });
    const stats = calculateProgressStatistics(
      [first, second],
      makeTodayStats({ wordsStudied: 99, correctAnswers: 2, incorrectAnswers: 1 }),
      NOW
    );

    expect(stats).toEqual({
      totalWordsPracticed: 2,
      wordsPracticedToday: 1,
      totalCorrectAnswers: 3,
      totalIncorrectAnswers: 1,
      totalAnswers: 4,
      overallAccuracy: 75,
      todayAnswers: 3,
      todayAccuracy: 67
    });
  });

  it('counts duplicate progress rows only once per word identity', () => {
    const progress = makeProgress('word-1', '2026-08-10T09:00:00.000Z');
    const stats = calculateProgressStatistics([progress, progress], makeTodayStats(), NOW);

    expect(stats.totalWordsPracticed).toBe(1);
    expect(stats.wordsPracticedToday).toBe(1);
  });

  it('returns no accuracy when there are no answers', () => {
    const stats = calculateProgressStatistics([], makeTodayStats({ wordsStudied: 7 }), NOW);

    expect(stats.totalAnswers).toBe(0);
    expect(stats.todayAnswers).toBe(0);
    expect(stats.overallAccuracy).toBeNull();
    expect(stats.todayAccuracy).toBeNull();
  });
});
