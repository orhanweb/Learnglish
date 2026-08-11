// src/lib/spaced-repetition.ts

import type { DirectionProgress, QuizDirection, QuizMode, Word, WordProgress } from '@/types';

/**
 * SM-2 quality ratings.
 *  0-2: failure (resets repetitions and interval to 1 day)
 *  3-5: success (interval grows according to ease factor)
 */
export type QualityRating = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Floor for the ease factor; without it intervals collapse to single-day forever.
 */
export const MIN_EASE_FACTOR = 1.3;

/**
 * Initial ease factor used by SM-2 for new items.
 */
export const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Number of correct attempts (per direction) required before mastery can be claimed.
 */
export const MASTERY_MIN_CORRECT = 5;

/**
 * Minimum accuracy ratio (per direction) required for mastery.
 */
export const MASTERY_MIN_ACCURACY = 0.8;

/**
 * The subset of SR fields that calculateNextReview is responsible for.
 */
export type SRFields = Pick<DirectionProgress, 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewDate'>;

/**
 * Pure SM-2 step. Given the current SR state and a quality rating, returns the
 * updated SR fields. Does not touch counts or mastery.
 */
export function calculateNextReview(current: SRFields, quality: QualityRating): SRFields {
  let { easeFactor, interval, repetitions } = current;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  // SM-2 ease-factor update.
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: nextReviewDate.toISOString()
  };
}

/**
 * Maps a binary correctness result to an SM-2 quality rating.
 * We deliberately use 4 ("good") instead of 5 ("perfect") for correct answers because
 * the binary signal cannot distinguish hesitation from instant recall; 5 is reserved
 * for an explicit "easy" affordance the UI may add later.
 */
export function getQualityFromResult(isCorrect: boolean): QualityRating {
  return isCorrect ? 4 : 0;
}

/**
 * Whether a single direction is currently due for review.
 */
export function isDirectionDue(direction: DirectionProgress, now: Date = new Date()): boolean {
  return new Date(direction.nextReviewDate) <= now;
}

/**
 * Whether the word should appear in the review queue (any direction due).
 */
export function isDueForReview(progress: WordProgress, now: Date = new Date()): boolean {
  return new Date(progress.nextDueAt) <= now;
}

/**
 * Returns every direction that is currently due, in a stable order.
 */
export function getDueDirections(progress: WordProgress, now: Date = new Date()): QuizDirection[] {
  const directions: QuizDirection[] = [];
  if (isDirectionDue(progress.recognition, now)) directions.push('recognition');
  if (isDirectionDue(progress.production, now)) directions.push('production');
  return directions;
}

/**
 * Re-evaluates whether a single direction qualifies as mastered after its counts changed.
 */
export function evaluateDirectionMastery(direction: Pick<DirectionProgress, 'correctCount' | 'incorrectCount'>): boolean {
  const total = direction.correctCount + direction.incorrectCount;
  if (total < MASTERY_MIN_CORRECT) return false;
  if (direction.correctCount < MASTERY_MIN_CORRECT) return false;
  return direction.correctCount / total >= MASTERY_MIN_ACCURACY;
}

/**
 * Whether the word counts as "completed" for the active quiz mode.
 *  - 'recognition' / 'production': only that direction needs to be mastered
 *  - 'mixed': both directions need to be mastered
 */
export function isWordMasteredForMode(progress: WordProgress | undefined, mode: QuizMode): boolean {
  if (!progress) return false;
  if (mode === 'recognition') return progress.recognition.mastered;
  if (mode === 'production') return progress.production.mastered;
  return progress.recognition.mastered && progress.production.mastered;
}

/**
 * Mastery summary across an arbitrary set of words for the active mode.
 */
export interface PartCompletionSummary {
  completed: number;
  total: number;
  isCompleted: boolean;
}

export function calculateWordIdsCompletion(
  wordIds: readonly string[],
  wordProgressMap: Map<string, WordProgress>,
  mode: QuizMode
): PartCompletionSummary {
  const total = wordIds.length;
  if (total === 0) return { completed: 0, total: 0, isCompleted: false };
  let completed = 0;
  for (const wordId of wordIds) {
    if (isWordMasteredForMode(wordProgressMap.get(wordId), mode)) completed += 1;
  }
  return { completed, total, isCompleted: completed >= total };
}

export function calculatePartCompletion(words: Word[], wordProgressMap: Map<string, WordProgress>, mode: QuizMode): PartCompletionSummary {
  return calculateWordIdsCompletion(
    words.map(word => word.id),
    wordProgressMap,
    mode
  );
}
