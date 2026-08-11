// src/lib/seed.ts

import { db } from './db.js';
import type { Word } from '../types/index.js';
import {
  WordsPayloadIntegrityError,
  parseWordsManifest,
  parseWordsPayload,
  wordsPayloadIdentity
} from './words-payload.js';

const SEED_STATE_KEY = 'wordsHash';
const MAX_AUTOMATIC_REMOVAL_RATIO = 0.1;

function partIdFor(word: Pick<Word, 'level' | 'partNumber'>): string {
  return `${word.level}-part-${word.partNumber}`;
}

/** Returns true when the published vocabulary manifest differs from the installed seed. */
export async function isSeedNeeded(manifestData: unknown): Promise<boolean> {
  const currentIdentity = wordsPayloadIdentity(parseWordsManifest(manifestData));
  const stored = await db.seedState.get(SEED_STATE_KEY);
  return stored?.value !== currentIdentity;
}

/** Downloads the full vocabulary only when its lightweight manifest changed. */
export async function loadWordsPayload(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Vocabulary download failed with HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  return payload;
}

/**
 * Replaces system-sourced words only after the bundled payload passes the full
 * manifest, schema, count, and content validation contract.
 */
export async function performSeed(wordsData: unknown): Promise<void> {
  const payload = parseWordsPayload(wordsData);
  const currentIdentity = wordsPayloadIdentity(payload.manifest);
  const systemWords: readonly Word[] = payload.words;

  await db.transaction('rw', db.words, db.seedState, db.wordProgress, db.partProgress, async () => {
    const existingSystemCount = await db.words.where('source').equals('system').count();
    const removedCount = Math.max(0, existingSystemCount - systemWords.length);
    if (existingSystemCount > 0 && removedCount / existingSystemCount > MAX_AUTOMATIC_REMOVAL_RATIO) {
      throw new WordsPayloadIntegrityError([
        `words: refusing to remove ${removedCount} of ${existingSystemCount} installed system words automatically`
      ]);
    }

    await db.words.where('source').equals('system').delete();
    await db.words.bulkPut(systemWords);

    const words = await db.words.toArray();
    const validWordIds = new Set(words.map(word => word.id));
    const validPartIds = new Set(words.map(partIdFor));

    const orphanWordProgressIds = (await db.wordProgress.toArray())
      .filter(progress => !validWordIds.has(progress.wordId))
      .map(progress => progress.wordId);
    if (orphanWordProgressIds.length > 0) {
      await db.wordProgress.bulkDelete(orphanWordProgressIds);
    }

    const stalePartProgressIds = (await db.partProgress.toArray())
      .filter(progress => progress.partId !== `${progress.level}-part-${progress.partNumber}` || !validPartIds.has(progress.partId))
      .map(progress => progress.partId);
    if (stalePartProgressIds.length > 0) {
      await db.partProgress.bulkDelete(stalePartProgressIds);
    }

    await db.seedState.put({ key: SEED_STATE_KEY, value: currentIdentity });
  });
}
