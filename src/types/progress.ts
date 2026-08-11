// src/types/progress.ts

import type { Level, Word } from './word.js';

/**
 * Quiz direction mode set by the user in settings.
 */
export type QuizMode = 'recognition' | 'production' | 'mixed';

/**
 * Direction of a single quiz question.
 * 'recognition': EN -> TR (see English, type Turkish).
 * 'production': TR -> EN (see Turkish, type English).
 */
export type QuizDirection = 'recognition' | 'production';

/**
 * A quiz question with its direction fixed for the lifetime of the session.
 */
export interface QuizItem {
  readonly word: Word;
  readonly direction: QuizDirection;
}

/**
 * Application theme preference.
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Spaced-repetition + accuracy state for a single direction of a word.
 * Tracked independently because the two directions are different cognitive skills.
 */
export interface DirectionProgress {
  /** SM-2 difficulty factor (default 2.5) */
  easeFactor: number;
  /** Days until next review */
  interval: number;
  /** Consecutive successful reviews in this direction */
  repetitions: number;
  /** ISO date string for the next review in this direction */
  nextReviewDate: string;
  /** Total correct answers in this direction */
  correctCount: number;
  /** Total incorrect answers in this direction */
  incorrectCount: number;
  /** Whether this direction is considered mastered */
  mastered: boolean;
}

/**
 * Per-word progress with direction-aware spaced repetition.
 */
export interface WordProgress {
  /** Reference to Word.id (primary key) */
  wordId: string;
  /** EN -> TR progress */
  recognition: DirectionProgress;
  /** TR -> EN progress */
  production: DirectionProgress;
  /** ISO date string of the most recent review across either direction */
  lastReviewedAt: string;
  /** Indexed: min of the two nextReviewDate values; lets us query "any direction due" cheaply */
  nextDueAt: string;
}

/**
 * Per-part lifecycle markers. Completion counts are derived at runtime from
 * WordProgress + the active QuizMode, so they are intentionally not persisted here.
 */
export interface PartProgress {
  /** Unique identifier: "level-part-number" */
  partId: string;
  level: Level;
  partNumber: number;
  /** ISO date string when the user first interacted with this part */
  startedAt: string;
  /** ISO date string when all words in the part reached mastery for the active mode */
  completedAt?: string;
}

/**
 * Daily aggregate study statistics.
 */
export interface DailyStats {
  /** ISO date string: "YYYY-MM-DD" */
  date: string;
  /** Legacy field name: total answer attempts submitted on this date */
  wordsStudied: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timeSpentMinutes: number;
}

/**
 * User application settings (persisted in IndexedDB).
 */
export interface UserSettings {
  /** Singleton settings record id (always 1) */
  id?: number;
  quizMode: QuizMode;
  shuffleQuizOrder: boolean;
  /** Accept minor spelling mistakes with a length-aware edit-distance limit */
  tolerateTypos: boolean;
  /** Always reveal sentence translations after answering */
  showTranslationsAlways: boolean;
  theme: Theme;
}

/**
 * Default settings for new users.
 */
export const DEFAULT_SETTINGS: UserSettings = {
  quizMode: 'mixed',
  shuffleQuizOrder: true,
  tolerateTypos: true,
  showTranslationsAlways: false,
  theme: 'system'
};

/**
 * Creates a fresh DirectionProgress with SM-2 defaults.
 */
export function createInitialDirectionProgress(now: string = new Date().toISOString()): DirectionProgress {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: now,
    correctCount: 0,
    incorrectCount: 0,
    mastered: false
  };
}

/**
 * Creates a fresh WordProgress with both directions initialized.
 */
export function createInitialWordProgress(wordId: string): WordProgress {
  const now = new Date().toISOString();
  return {
    wordId,
    recognition: createInitialDirectionProgress(now),
    production: createInitialDirectionProgress(now),
    lastReviewedAt: now,
    nextDueAt: now
  };
}

/**
 * Returns the earliest of the two direction nextReviewDates (ISO strings sort lexicographically).
 */
export function computeNextDueAt(progress: WordProgress): string {
  return progress.recognition.nextReviewDate <= progress.production.nextReviewDate
    ? progress.recognition.nextReviewDate
    : progress.production.nextReviewDate;
}
