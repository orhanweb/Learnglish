// src/lib/progress-backup.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllData, db } from './db';
import {
  ProgressBackupIntegrityError,
  createProgressBackup,
  parseProgressBackup,
  previewProgressBackup,
  restoreProgressBackup,
  serializeProgressBackup
} from './progress-backup';
import { buildTestWord } from '@/test/word-fixtures';
import { DEFAULT_SETTINGS, type DailyStats, type PartProgress, type WordProgress } from '@/types';

const FIRST_WORD_ID = 'wrd_00000000-0000-4000-8000-000000000001';
const ORPHAN_WORD_ID = 'wrd_00000000-0000-4000-8000-000000000099';
const VOCABULARY_IDENTITY = '1:djb2-v1:12345678';
const EXPORTED_AT = new Date('2026-08-10T10:00:00.000Z');

function createWordProgress(wordId: string, correctCount = 1): WordProgress {
  return {
    wordId,
    recognition: {
      easeFactor: 2.5,
      interval: 1,
      repetitions: correctCount,
      nextReviewDate: '2026-08-11T10:00:00.000Z',
      correctCount,
      incorrectCount: 0,
      mastered: false
    },
    production: {
      easeFactor: 2.5,
      interval: 6,
      repetitions: 2,
      nextReviewDate: '2026-08-16T10:00:00.000Z',
      correctCount: 2,
      incorrectCount: 0,
      mastered: false
    },
    lastReviewedAt: '2026-08-10T10:00:00.000Z',
    nextDueAt: '2026-08-11T10:00:00.000Z'
  };
}

function createPartProgress(partNumber: number): PartProgress {
  return {
    partId: `A1-part-${partNumber}`,
    level: 'A1',
    partNumber,
    startedAt: '2026-08-10T09:00:00.000Z'
  };
}

function createDailyStats(correctAnswers = 2, incorrectAnswers = 1): DailyStats {
  return {
    date: '2026-08-10',
    wordsStudied: correctAnswers + incorrectAnswers,
    correctAnswers,
    incorrectAnswers,
    timeSpentMinutes: 4.5
  };
}

function cloneUnknown<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function seedVocabulary(): Promise<void> {
  await db.words.put(
    buildTestWord({
      id: FIRST_WORD_ID,
      sourceRef: 'oxford:test:first:noun:A1',
      wordEn: ['first'],
      wordTr: ['ilk'],
      level: 'A1',
      partNumber: 1
    })
  );
  await db.seedState.put({ key: 'wordsHash', value: VOCABULARY_IDENTITY });
}

async function progressSnapshot() {
  const [wordProgress, partProgress, dailyStats] = await Promise.all([
    db.wordProgress.toArray(),
    db.partProgress.toArray(),
    db.dailyStats.toArray()
  ]);
  return {
    wordProgress: wordProgress.sort((left, right) => left.wordId.localeCompare(right.wordId)),
    partProgress: partProgress.sort((left, right) => left.partId.localeCompare(right.partId)),
    dailyStats: dailyStats.sort((left, right) => left.date.localeCompare(right.date))
  };
}

describe('progress backup', () => {
  beforeEach(async () => {
    await clearAllData();
    await seedVocabulary();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a deterministic learning-only backup that round-trips through the strict parser', async () => {
    await Promise.all([
      db.wordProgress.put(createWordProgress(FIRST_WORD_ID)),
      db.partProgress.put(createPartProgress(1)),
      db.dailyStats.put(createDailyStats()),
      db.settings.put({ ...DEFAULT_SETTINGS, id: 1, quizMode: 'production' })
    ]);

    const backup = await createProgressBackup(EXPORTED_AT);
    const serialized = serializeProgressBackup(backup);
    const parsed = parseProgressBackup(JSON.parse(serialized) as unknown);

    expect(parsed).toEqual(backup);
    expect(backup.vocabulary).toEqual({ identity: VOCABULARY_IDENTITY, wordCount: 1 });
    expect(backup.data.wordProgress).toHaveLength(1);
    expect(backup.data.partProgress).toHaveLength(1);
    expect(backup.data.dailyStats).toHaveLength(1);
    expect(serialized).not.toContain('quizMode');
    expect(serialized).not.toContain('definitionEn');
    expect(serialized.endsWith('\n')).toBe(true);
  });

  it.each([
    [
      'an unknown top-level field',
      (candidate: Record<string, unknown>) => {
        candidate['settings'] = {};
      }
    ],
    [
      'a changed content hash',
      (candidate: Record<string, unknown>) => {
        candidate['contentHash'] = 'ffffffff';
      }
    ],
    [
      'an inconsistent next due timestamp',
      (candidate: Record<string, unknown>) => {
        const data = candidate['data'] as { wordProgress: Array<Record<string, unknown>> };
        data.wordProgress[0]!['nextDueAt'] = '2026-08-20T10:00:00.000Z';
      }
    ],
    [
      'duplicate word progress rows',
      (candidate: Record<string, unknown>) => {
        const data = candidate['data'] as { wordProgress: Array<Record<string, unknown>> };
        data.wordProgress.push(cloneUnknown(data.wordProgress[0]!));
      }
    ],
    [
      'inconsistent daily answer totals',
      (candidate: Record<string, unknown>) => {
        const data = candidate['data'] as { dailyStats: Array<Record<string, unknown>> };
        data.dailyStats[0]!['wordsStudied'] = 99;
      }
    ]
  ])('rejects %s', async (_label, mutate) => {
    await Promise.all([
      db.wordProgress.put(createWordProgress(FIRST_WORD_ID)),
      db.dailyStats.put(createDailyStats())
    ]);
    const candidate = cloneUnknown(await createProgressBackup(EXPORTED_AT)) as unknown as Record<string, unknown>;
    mutate(candidate);

    expect(() => parseProgressBackup(candidate)).toThrow(ProgressBackupIntegrityError);
  });

  it('previews and skips progress rows that do not belong to the current vocabulary', async () => {
    await Promise.all([
      db.wordProgress.bulkPut([createWordProgress(FIRST_WORD_ID), createWordProgress(ORPHAN_WORD_ID)]),
      db.partProgress.bulkPut([createPartProgress(1), createPartProgress(99)]),
      db.dailyStats.put(createDailyStats())
    ]);
    const backup = await createProgressBackup(EXPORTED_AT);
    await db.seedState.put({ key: 'wordsHash', value: '1:djb2-v1:87654321' });

    const preview = await previewProgressBackup(backup);

    expect(preview).toMatchObject({
      vocabularyMatches: false,
      currentVocabularyWordCount: 1,
      backupVocabularyWordCount: 1,
      wordProgressRows: 1,
      skippedWordProgressRows: 1,
      partProgressRows: 1,
      skippedPartProgressRows: 1,
      dailyStatsRows: 1
    });
  });

  it('atomically replaces only learning progress and preserves vocabulary plus settings', async () => {
    await Promise.all([
      db.wordProgress.bulkPut([createWordProgress(FIRST_WORD_ID), createWordProgress(ORPHAN_WORD_ID)]),
      db.partProgress.bulkPut([createPartProgress(1), createPartProgress(99)]),
      db.dailyStats.put(createDailyStats())
    ]);
    const backup = await createProgressBackup(EXPORTED_AT);
    const wordsBefore = await db.words.toArray();
    const seedStateBefore = await db.seedState.toArray();
    const settings = { ...DEFAULT_SETTINGS, id: 1, quizMode: 'recognition' as const };
    await db.settings.put(settings);
    await Promise.all([
      db.wordProgress.clear(),
      db.partProgress.clear(),
      db.dailyStats.clear()
    ]);
    await Promise.all([
      db.wordProgress.put(createWordProgress(FIRST_WORD_ID, 9)),
      db.dailyStats.put(createDailyStats(0, 4))
    ]);

    const result = await restoreProgressBackup(backup);

    expect(result).toMatchObject({
      restored: true,
      wordProgressRows: 1,
      skippedWordProgressRows: 1,
      partProgressRows: 1,
      skippedPartProgressRows: 1,
      dailyStatsRows: 1
    });
    expect(await db.wordProgress.toArray()).toEqual([createWordProgress(FIRST_WORD_ID)]);
    expect(await db.partProgress.toArray()).toEqual([createPartProgress(1)]);
    expect(await db.dailyStats.toArray()).toEqual([createDailyStats()]);
    expect(await db.words.toArray()).toEqual(wordsBefore);
    expect(await db.seedState.toArray()).toEqual(seedStateBefore);
    expect(await db.settings.get(1)).toEqual(settings);
  });

  it('rolls the entire restore back when any progress table write fails', async () => {
    await Promise.all([
      db.wordProgress.put(createWordProgress(FIRST_WORD_ID)),
      db.partProgress.put(createPartProgress(1)),
      db.dailyStats.put(createDailyStats())
    ]);
    const backup = await createProgressBackup(EXPORTED_AT);
    await Promise.all([
      db.wordProgress.put(createWordProgress(FIRST_WORD_ID, 7)),
      db.partProgress.put({ ...createPartProgress(1), completedAt: '2026-08-10T12:00:00.000Z' }),
      db.dailyStats.put(createDailyStats(1, 4))
    ]);
    const before = await progressSnapshot();
    vi.spyOn(db.dailyStats, 'bulkPut').mockRejectedValueOnce(new Error('simulated restore failure'));

    await expect(restoreProgressBackup(backup)).rejects.toThrow('simulated restore failure');

    expect(await progressSnapshot()).toEqual(before);
  });
});
