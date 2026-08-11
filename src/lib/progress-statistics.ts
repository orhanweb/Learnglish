// src/lib/progress-statistics.ts

import type { DailyStats, WordProgress } from '@/types';
import { formatDateKey } from './utils';

export interface ProgressStatistics {
  readonly totalWordsPracticed: number;
  readonly wordsPracticedToday: number;
  readonly totalCorrectAnswers: number;
  readonly totalIncorrectAnswers: number;
  readonly totalAnswers: number;
  readonly overallAccuracy: number | null;
  readonly todayAnswers: number;
  readonly todayAccuracy: number | null;
}

function accuracyPercent(correctAnswers: number, totalAnswers: number): number | null {
  return totalAnswers === 0 ? null : Math.round((correctAnswers / totalAnswers) * 100);
}

function reviewedOnDate(progress: WordProgress, dateKey: string): boolean {
  const reviewedAt = new Date(progress.lastReviewedAt);
  return !Number.isNaN(reviewedAt.getTime()) && formatDateKey(reviewedAt) === dateKey;
}

export function calculateProgressStatistics(
  wordProgress: Iterable<WordProgress>,
  todayStats: DailyStats,
  now: Date = new Date()
): ProgressStatistics {
  const practicedWordIds = new Set<string>();
  const practicedTodayWordIds = new Set<string>();
  const todayKey = formatDateKey(now);
  let totalCorrectAnswers = 0;
  let totalIncorrectAnswers = 0;

  for (const progress of wordProgress) {
    practicedWordIds.add(progress.wordId);
    if (reviewedOnDate(progress, todayKey)) practicedTodayWordIds.add(progress.wordId);
    totalCorrectAnswers += progress.recognition.correctCount + progress.production.correctCount;
    totalIncorrectAnswers += progress.recognition.incorrectCount + progress.production.incorrectCount;
  }

  const totalAnswers = totalCorrectAnswers + totalIncorrectAnswers;
  const todayAnswers = todayStats.correctAnswers + todayStats.incorrectAnswers;

  return {
    totalWordsPracticed: practicedWordIds.size,
    wordsPracticedToday: practicedTodayWordIds.size,
    totalCorrectAnswers,
    totalIncorrectAnswers,
    totalAnswers,
    overallAccuracy: accuracyPercent(totalCorrectAnswers, totalAnswers),
    todayAnswers,
    todayAccuracy: accuracyPercent(todayStats.correctAnswers, todayAnswers)
  };
}
