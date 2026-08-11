// src/lib/answer-validation.ts

import type { Word } from '@/types';

/**
 * Result of answer validation.
 */
export interface ValidationResult {
  /** Whether the answer is correct */
  isCorrect: boolean;
  /** The matched meaning (if correct) */
  matchedMeaning?: string;
  /** Levenshtein distance (if fuzzy matched) */
  distance?: number;
}

/**
 * Calculates Levenshtein distance between two strings.
 * Single-row dynamic programming, O(min(a,b)) memory.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Iterate by the longer string column-wise, store the shorter row.
  let prevRow: number[] = Array.from({ length: a.length + 1 }, (_, i) => i);
  let currRow: number[] = new Array(a.length + 1).fill(0);

  for (let i = 1; i <= b.length; i++) {
    currRow[0] = i;
    const bChar = b.charCodeAt(i - 1);
    for (let j = 1; j <= a.length; j++) {
      const cost = bChar === a.charCodeAt(j - 1) ? 0 : 1;
      const above = (prevRow[j] ?? 0) + 1;
      const left = (currRow[j - 1] ?? 0) + 1;
      const diag = (prevRow[j - 1] ?? 0) + cost;
      currRow[j] = Math.min(above, left, diag);
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[a.length] ?? 0;
}

/**
 * Normalizes text for comparison.
 * Trims whitespace, converts to lowercase, removes extra spaces.
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Absolute ceiling for fuzzy matching. */
const MAX_TYPO_DISTANCE = 2;

function maxTypoDistanceFor(target: string, input: string = target): number {
  const targetLength = Array.from(target).length;
  const inputLength = Array.from(input).length;
  const shorterLength = Math.min(targetLength, inputLength);
  const longerLength = Math.max(targetLength, inputLength);

  if (shorterLength * 5 < longerLength * 4) return 0;
  if (targetLength <= 4) return 0;
  if (targetLength <= 8) return 1;
  return MAX_TYPO_DISTANCE;
}

/**
 * Validates a user's answer against word meanings.
 * Supports array-based matching and optional typo tolerance.
 *
 * @param userAnswer - The user's answer
 * @param word - The word being tested
 * @param tolerateTypos - Whether to allow fuzzy matching
 * @returns Validation result
 */
export function validateAnswer(userAnswer: string, word: Word, tolerateTypos: boolean): ValidationResult {
  const normalized = normalizeText(userAnswer);

  if (!normalized) {
    return { isCorrect: false };
  }

  // Exact match check
  const exactMatch = word.wordTr.find(meaning => normalizeText(meaning) === normalized);
  if (exactMatch) {
    return { isCorrect: true, matchedMeaning: exactMatch };
  }

  // Fuzzy match (if enabled)
  if (tolerateTypos) {
    for (const meaning of word.wordTr) {
      const target = normalizeText(meaning);
      const allowedDistance = maxTypoDistanceFor(target, normalized);
      if (allowedDistance === 0) continue;
      const distance = levenshteinDistance(target, normalized);
      if (distance <= allowedDistance) {
        return {
          isCorrect: true,
          matchedMeaning: meaning,
          distance
        };
      }
    }
  }

  return { isCorrect: false };
}

/**
 * Validates a user's answer for production mode (TR → EN).
 *
 * @param userAnswer - The user's answer (English word)
 * @param word - The word being tested
 * @param tolerateTypos - Whether to allow fuzzy matching
 * @returns Validation result
 */
export function validateProductionAnswer(userAnswer: string, word: Word, tolerateTypos: boolean): ValidationResult {
  const normalized = normalizeText(userAnswer);
  const normalizedTargets = word.wordEn.map(entry => normalizeText(entry));

  if (!normalized) {
    return { isCorrect: false };
  }

  // Exact match
  const exactMatch = normalizedTargets.find(target => target === normalized);
  if (exactMatch) {
    const matched = word.wordEn.find(entry => normalizeText(entry) === exactMatch) ?? word.wordEn[0];
    return { isCorrect: true, matchedMeaning: matched };
  }

  // Fuzzy match (if enabled)
  if (tolerateTypos) {
    for (const entry of word.wordEn) {
      const target = normalizeText(entry);
      const allowedDistance = maxTypoDistanceFor(target, normalized);
      if (allowedDistance === 0) continue;
      const distance = levenshteinDistance(target, normalized);
      if (distance <= allowedDistance) {
        return {
          isCorrect: true,
          matchedMeaning: entry,
          distance
        };
      }
    }
  }

  return { isCorrect: false };
}

export { levenshteinDistance, normalizeText, maxTypoDistanceFor, MAX_TYPO_DISTANCE };
