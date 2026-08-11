// src/data/words.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearAllData, db } from '@/lib/db';
import { buildTestWord } from '@/test/word-fixtures';
import { getPartWordIndexesForLevel, getTotalWordCount } from './words';

describe('lightweight word indexes', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it('groups primary keys by level and part without returning word payloads', async () => {
    const a1PartTwo = buildTestWord({ id: 'word-c', level: 'A1', partNumber: 2, wordEn: ['c'], wordTr: ['c'] });
    const a1PartOneB = buildTestWord({ id: 'word-b', level: 'A1', partNumber: 1, wordEn: ['b'], wordTr: ['b'] });
    const a1PartOneA = buildTestWord({ id: 'word-a', level: 'A1', partNumber: 1, wordEn: ['a'], wordTr: ['a'] });
    const a2Word = buildTestWord({ id: 'word-d', level: 'A2', partNumber: 1, wordEn: ['d'], wordTr: ['d'] });
    await db.words.bulkPut([a1PartTwo, a1PartOneB, a1PartOneA, a2Word]);

    await expect(getPartWordIndexesForLevel('A1')).resolves.toEqual([
      { level: 'A1', partNumber: 1, wordIds: ['word-a', 'word-b'] },
      { level: 'A1', partNumber: 2, wordIds: ['word-c'] }
    ]);
    await expect(getTotalWordCount()).resolves.toBe(4);
  });

  it('returns an empty index for a level without words', async () => {
    await expect(getPartWordIndexesForLevel('C1')).resolves.toEqual([]);
  });
});
