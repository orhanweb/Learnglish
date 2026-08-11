// src/lib/constants.ts

/**
 * Number of words a single learning part contains. The value is intentionally
 * shared between the public PWA and the admin tool so part numbering can never
 * drift between the two — the admin imports it via its `@learnglish/lib/*`
 * path alias.
 *
 * The last part of a level may be under-filled (e.g. a level with 745 words
 * and `PART_SIZE = 20` ends with a part of 5). That is by design.
 */
export const PART_SIZE = 20;

/**
 * How many parts are required to hold `wordCount` words at the current
 * `PART_SIZE`. Returns `0` when `wordCount` is `0`.
 */
export function partsCountForWords(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.ceil(wordCount / PART_SIZE);
}

/**
 * The `partNumber` (1-based) a word at zero-based index `indexInLevel` lands
 * in. Helpful for ingest pipelines that assign part numbers from a sorted
 * source list.
 */
export function partNumberForIndex(indexInLevel: number): number {
  if (indexInLevel < 0) throw new RangeError(`indexInLevel must be >= 0, got ${indexInLevel}`);
  return Math.floor(indexInLevel / PART_SIZE) + 1;
}
