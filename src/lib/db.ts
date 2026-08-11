// src/lib/db.ts

import Dexie, { type Table } from 'dexie';
import type { Word, WordProgress, PartProgress, DailyStats, UserSettings } from '@/types';

/** Tracks seed state for automatic word data updates. */
export interface SeedState {
  key: string;
  value: string;
}

/**
 * IndexedDB database for Learnglish.
 *
 * Schema versions:
 *  v2 - Flat WordProgress with single SR state.
 *  v3 - Direction-aware WordProgress (recognition + production) and derived
 *       PartProgress. Upgrading from v2 clears progress tables since the shape
 *       is incompatible; user opted in to a clean slate.
 *  v4 - Word identifiers migrated from semantic strings ("morning-noun-1") to
 *       opaque `wrd_<uuid>` ids and `wordNumber` removed. Existing wordProgress
 *       and partProgress rows reference the old ids and must be discarded; the
 *       progress tables are cleared on upgrade.
 */
class LearnglishDB extends Dexie {
  words!: Table<Word, string>;
  seedState!: Table<SeedState, string>;
  wordProgress!: Table<WordProgress, string>;
  partProgress!: Table<PartProgress, string>;
  dailyStats!: Table<DailyStats, string>;
  settings!: Table<UserSettings, number>;

  constructor() {
    super('learnglish');

    this.version(2).stores({
      words: 'id, level, partNumber, source, [level+partNumber]',
      seedState: 'key',
      wordProgress: 'wordId, nextReviewDate, [recognitionMastered+productionMastered]',
      partProgress: 'partId, level, isCompleted',
      dailyStats: 'date',
      settings: '++id'
    });

    this.version(3)
      .stores({
        words: 'id, level, partNumber, source, [level+partNumber]',
        seedState: 'key',
        wordProgress: 'wordId, nextDueAt',
        partProgress: 'partId, level, completedAt',
        dailyStats: 'date',
        settings: '++id'
      })
      .upgrade(async tx => {
        // v2 progress shape is incompatible with v3 (per-direction nesting); reset.
        await tx.table('wordProgress').clear();
        await tx.table('partProgress').clear();
      });

    this.version(4)
      .stores({
        words: 'id, level, partNumber, source, [level+partNumber]',
        seedState: 'key',
        wordProgress: 'wordId, nextDueAt',
        partProgress: 'partId, level, completedAt',
        dailyStats: 'date',
        settings: '++id'
      })
      .upgrade(async tx => {
        // Old word ids ("morning-noun-1") will be replaced on next seed; any
        // existing progress points at ids that will no longer exist. Drop the
        // stored seed hash too so the next boot triggers a fresh seed.
        await tx.table('wordProgress').clear();
        await tx.table('partProgress').clear();
        await tx.table('seedState').clear();
        await tx.table('words').where('source').equals('system').delete();
      });
  }
}

export const db = new LearnglishDB();

/**
 * Wipes every table. Irreversible; intended for "reset all data" actions.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.words, db.seedState, db.wordProgress, db.partProgress, db.dailyStats, db.settings], async () => {
    await Promise.all([
      db.words.clear(),
      db.seedState.clear(),
      db.wordProgress.clear(),
      db.partProgress.clear(),
      db.dailyStats.clear(),
      db.settings.clear()
    ]);
  });
}

/**
 * Number of words with at least one direction due for review.
 */
export async function getDueWordsCount(): Promise<number> {
  const today = new Date().toISOString();
  return db.wordProgress.where('nextDueAt').belowOrEqual(today).count();
}

/**
 * Returns the WordProgress rows where any direction is currently due.
 */
export async function getDueWords(): Promise<WordProgress[]> {
  const today = new Date().toISOString();
  return db.wordProgress.where('nextDueAt').belowOrEqual(today).toArray();
}
