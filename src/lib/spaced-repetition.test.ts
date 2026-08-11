// src/lib/spaced-repetition.test.ts

import { describe, it, expect } from 'vitest';
import {
  calculateNextReview,
  calculatePartCompletion,
  calculateWordIdsCompletion,
  evaluateDirectionMastery,
  getDueDirections,
  getQualityFromResult,
  isDirectionDue,
  isDueForReview,
  isWordMasteredForMode,
  MIN_EASE_FACTOR,
  type SRFields
} from './spaced-repetition';
import type { Word, WordProgress } from '@/types';
import { createInitialWordProgress } from '@/types';
import { buildTestWord } from '@/test/word-fixtures';

const baseSR: SRFields = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewDate: new Date().toISOString()
};

describe('SM-2 calculateNextReview', () => {
  it('resets repetitions and shrinks ease factor on failure', () => {
    const result = calculateNextReview({ ...baseSR, interval: 10, repetitions: 5, easeFactor: 2.5 }, 2);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
    // EF: 2.5 + (0.1 - 3 * (0.08 + 3 * 0.02)) = 2.5 - 0.32 = 2.18
    expect(result.easeFactor).toBeCloseTo(2.18, 2);
  });

  it('first success interval is 1 day', () => {
    const result = calculateNextReview({ ...baseSR, repetitions: 0, interval: 0 }, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('second success interval is 6 days', () => {
    const result = calculateNextReview({ ...baseSR, repetitions: 1, interval: 1 }, 5);
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it('subsequent successes scale by ease factor', () => {
    const result = calculateNextReview({ ...baseSR, repetitions: 2, interval: 6, easeFactor: 2.5 }, 4);
    expect(result.interval).toBe(15);
    expect(result.repetitions).toBe(3);
    expect(result.easeFactor).toBe(2.5);
  });

  it('clamps ease factor at the minimum', () => {
    const result = calculateNextReview({ ...baseSR, easeFactor: MIN_EASE_FACTOR }, 0);
    expect(result.easeFactor).toBe(MIN_EASE_FACTOR);
  });
});

describe('getQualityFromResult', () => {
  it('returns 4 for correct answers', () => {
    expect(getQualityFromResult(true)).toBe(4);
  });
  it('returns 0 for incorrect answers', () => {
    expect(getQualityFromResult(false)).toBe(0);
  });
});

describe('evaluateDirectionMastery', () => {
  it('rejects fewer than five correct answers', () => {
    expect(evaluateDirectionMastery({ correctCount: 4, incorrectCount: 0 })).toBe(false);
  });

  it('accepts five correct answers with full accuracy', () => {
    expect(evaluateDirectionMastery({ correctCount: 5, incorrectCount: 0 })).toBe(true);
  });

  it('rejects when accuracy drops below 80% even with five correct', () => {
    // 5 correct out of 7 attempts = ~71%
    expect(evaluateDirectionMastery({ correctCount: 5, incorrectCount: 2 })).toBe(false);
  });

  it('accepts 8 correct out of 10 (80%)', () => {
    expect(evaluateDirectionMastery({ correctCount: 8, incorrectCount: 2 })).toBe(true);
  });
});

describe('isDirectionDue / isDueForReview', () => {
  it('isDirectionDue returns true when nextReviewDate is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isDirectionDue({ ...baseSR, nextReviewDate: past, correctCount: 0, incorrectCount: 0, mastered: false })).toBe(true);
  });

  it('isDueForReview reads nextDueAt', () => {
    const progress: WordProgress = {
      ...createInitialWordProgress('w'),
      nextDueAt: new Date(Date.now() - 1000).toISOString()
    };
    expect(isDueForReview(progress)).toBe(true);
  });

  it('returns only the direction that is currently due', () => {
    const now = new Date('2026-07-26T12:00:00.000Z');
    const progress = createInitialWordProgress('w');
    progress.recognition.nextReviewDate = '2026-07-27T12:00:00.000Z';
    progress.production.nextReviewDate = '2026-07-25T12:00:00.000Z';

    expect(getDueDirections(progress, now)).toEqual(['production']);
  });

  it('returns both directions when both are due', () => {
    const now = new Date('2026-07-26T12:00:00.000Z');
    const progress = createInitialWordProgress('w');
    progress.recognition.nextReviewDate = '2026-07-25T12:00:00.000Z';
    progress.production.nextReviewDate = '2026-07-26T12:00:00.000Z';

    expect(getDueDirections(progress, now)).toEqual(['recognition', 'production']);
  });

  it('returns no directions when neither is due', () => {
    const now = new Date('2026-07-26T12:00:00.000Z');
    const progress = createInitialWordProgress('w');
    progress.recognition.nextReviewDate = '2026-07-27T12:00:00.000Z';
    progress.production.nextReviewDate = '2026-07-28T12:00:00.000Z';

    expect(getDueDirections(progress, now)).toEqual([]);
  });
});

describe('isWordMasteredForMode + calculatePartCompletion', () => {
  function makeProgress(rec: boolean, prod: boolean): WordProgress {
    const base = createInitialWordProgress('w');
    base.recognition.mastered = rec;
    base.production.mastered = prod;
    return base;
  }

  it('mode-aware mastery', () => {
    expect(isWordMasteredForMode(makeProgress(true, false), 'recognition')).toBe(true);
    expect(isWordMasteredForMode(makeProgress(true, false), 'production')).toBe(false);
    expect(isWordMasteredForMode(makeProgress(true, false), 'mixed')).toBe(false);
    expect(isWordMasteredForMode(makeProgress(true, true), 'mixed')).toBe(true);
    expect(isWordMasteredForMode(undefined, 'mixed')).toBe(false);
  });

  it('part completion respects mode', () => {
    const wordA = buildTestWord({ wordEn: ['a'], wordTr: ['a'] });
    const wordB = buildTestWord({ wordEn: ['b'], wordTr: ['b'] });
    const words: Word[] = [wordA, wordB];
    const map = new Map<string, WordProgress>([
      [wordA.id, makeProgress(true, false)],
      [wordB.id, makeProgress(true, true)]
    ]);

    expect(calculatePartCompletion(words, map, 'recognition')).toEqual({ completed: 2, total: 2, isCompleted: true });
    expect(calculatePartCompletion(words, map, 'mixed')).toEqual({ completed: 1, total: 2, isCompleted: false });
    expect(calculatePartCompletion([], map, 'mixed')).toEqual({ completed: 0, total: 0, isCompleted: false });
  });

  it('calculates completion from lightweight word identifiers', () => {
    const map = new Map<string, WordProgress>([
      ['word-a', makeProgress(true, false)],
      ['word-b', makeProgress(true, true)]
    ]);

    expect(calculateWordIdsCompletion(['word-a', 'word-b'], map, 'recognition')).toEqual({
      completed: 2,
      total: 2,
      isCompleted: true
    });
    expect(calculateWordIdsCompletion(['word-a', 'word-b'], map, 'mixed')).toEqual({
      completed: 1,
      total: 2,
      isCompleted: false
    });
  });
});
