// src/lib/seed.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllData, db } from './db';
import { generateWordId } from './id';
import { isSeedNeeded, loadWordsPayload, performSeed } from './seed';
import {
  WordsPayloadIntegrityError,
  createWordsPayload,
  wordsPayloadIdentity,
  type WordsPayload
} from './words-payload';
import { createInitialWordProgress, type PartProgress, type Word } from '@/types';
import { buildTestWord } from '@/test/word-fixtures';

const sampleWord = buildTestWord({
  sourceRef: 'oxford:test:cat:noun:A1',
  wordEn: ['cat'],
  wordTr: ['kedi']
});
const payload = createWordsPayload([sampleWord]);

function cloneUnknown<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface MutablePayloadFixture {
  manifest: {
    contentHash: string;
    counts: { words: number };
  };
  words: Word[];
}

function mutableReplacementPayload(): MutablePayloadFixture {
  return cloneUnknown(replacementPayload()) as unknown as MutablePayloadFixture;
}

function replacementPayload(overrides: Partial<Word> = {}): WordsPayload {
  return createWordsPayload([
    buildTestWord({
      id: generateWordId(),
      sourceRef: `oxford:test:${generateWordId()}:noun:A1`,
      wordEn: ['dog'],
      wordTr: ['köpek'],
      ...overrides
    })
  ]);
}

async function databaseSnapshot() {
  const [words, seedState, wordProgress, partProgress] = await Promise.all([
    db.words.toArray(),
    db.seedState.toArray(),
    db.wordProgress.toArray(),
    db.partProgress.toArray()
  ]);
  return {
    words: words.sort((left, right) => left.id.localeCompare(right.id)),
    seedState: seedState.sort((left, right) => left.key.localeCompare(right.key)),
    wordProgress: wordProgress.sort((left, right) => left.wordId.localeCompare(right.wordId)),
    partProgress: partProgress.sort((left, right) => left.partId.localeCompare(right.partId))
  };
}

describe('seed utilities', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('flags seed as needed before any seeding has happened', async () => {
    expect(await isSeedNeeded(payload.manifest)).toBe(true);
  });

  it('persists system words and records the versioned manifest identity', async () => {
    await performSeed(payload);

    const stored = await db.words.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.source).toBe('system');
    expect(await db.seedState.get('wordsHash')).toEqual({
      key: 'wordsHash',
      value: wordsPayloadIdentity(payload.manifest)
    });
    expect(await isSeedNeeded(payload.manifest)).toBe(false);
  });

  it('detects payload changes via manifest identity mismatch', async () => {
    await performSeed(payload);

    const modifiedPayload = createWordsPayload([{ ...sampleWord, wordEn: ['cat', 'kitty'] }]);
    expect(await isSeedNeeded(modifiedPayload.manifest)).toBe(true);

    await performSeed(modifiedPayload);
    expect(await isSeedNeeded(modifiedPayload.manifest)).toBe(false);
  });

  it('does not delete user-authored words on reseed', async () => {
    await performSeed(payload);

    const userWord = buildTestWord({ source: 'user', wordEn: ['custom'], wordTr: ['özel'] });
    await db.words.put(userWord);

    const modifiedPayload = replacementPayload({ wordEn: ['cat'], wordTr: ['kedi'] });
    await performSeed(modifiedPayload);

    const all = await db.words.toArray();
    const userWords = all.filter(word => word.source === 'user');
    expect(userWords).toHaveLength(1);
    expect(userWords[0]?.id).toBe(userWord.id);
  });

  it('removes word progress rows whose words no longer exist', async () => {
    await performSeed(payload);
    const orphanId = generateWordId();
    await db.wordProgress.bulkPut([createInitialWordProgress(sampleWord.id), createInitialWordProgress(orphanId)]);

    await performSeed(payload);

    expect(await db.wordProgress.get(sampleWord.id)).toBeDefined();
    expect(await db.wordProgress.get(orphanId)).toBeUndefined();
  });

  it('keeps user-authored word progress during reseed', async () => {
    const userWord = buildTestWord({ source: 'user', wordEn: ['custom'], wordTr: ['özel'] });
    await db.words.put(userWord);
    await db.wordProgress.put(createInitialWordProgress(userWord.id));

    await performSeed(payload);

    expect(await db.words.get(userWord.id)).toBeDefined();
    expect(await db.wordProgress.get(userWord.id)).toBeDefined();
  });

  it('removes part progress rows for parts that no longer exist', async () => {
    const validPart: PartProgress = {
      partId: 'A1-part-1',
      level: 'A1',
      partNumber: 1,
      startedAt: new Date().toISOString()
    };
    const stalePart: PartProgress = {
      partId: 'A1-part-2',
      level: 'A1',
      partNumber: 2,
      startedAt: new Date().toISOString()
    };
    const malformedPart: PartProgress = {
      partId: 'wrong-part-id',
      level: 'A1',
      partNumber: 1,
      startedAt: new Date().toISOString()
    };
    await db.partProgress.bulkPut([validPart, stalePart, malformedPart]);

    await performSeed(payload);

    expect(await db.partProgress.get(validPart.partId)).toBeDefined();
    expect(await db.partProgress.get(stalePart.partId)).toBeUndefined();
    expect(await db.partProgress.get(malformedPart.partId)).toBeUndefined();
  });

  it.each([
    ['missing manifest', () => ({ words: replacementPayload().words })],
    ['empty manifest', () => ({ manifest: {}, words: replacementPayload().words })],
    ['empty vocabulary', () => createWordsPayload([], { allowEmpty: true })],
    [
      'malformed word',
      () => {
        const candidate = mutableReplacementPayload();
        candidate.words[0]!.examples = [];
        return candidate;
      }
    ],
    [
      'count mismatch',
      () => {
        const candidate = mutableReplacementPayload();
        candidate.manifest.counts.words += 1;
        return candidate;
      }
    ],
    [
      'hash mismatch',
      () => {
        const candidate = mutableReplacementPayload();
        candidate.manifest.contentHash = '00000000';
        return candidate;
      }
    ]
  ])('preserves every local table when rejecting a %s payload', async (_label, createInvalidPayload) => {
    await performSeed(payload);
    const userWord = buildTestWord({ source: 'user', wordEn: ['custom'], wordTr: ['özel'] });
    const partProgress: PartProgress = {
      partId: 'A1-part-1',
      level: 'A1',
      partNumber: 1,
      startedAt: new Date().toISOString()
    };
    await Promise.all([
      db.words.put(userWord),
      db.wordProgress.bulkPut([
        createInitialWordProgress(sampleWord.id),
        createInitialWordProgress(userWord.id)
      ]),
      db.partProgress.put(partProgress)
    ]);
    const before = await databaseSnapshot();
    const candidate = createInvalidPayload();

    await expect(performSeed(candidate)).rejects.toBeInstanceOf(WordsPayloadIntegrityError);
    expect(await databaseSnapshot()).toEqual(before);
  });

  it('rejects an invalid lightweight manifest before reading seed state', async () => {
    const before = await databaseSnapshot();

    await expect(isSeedNeeded({})).rejects.toBeInstanceOf(WordsPayloadIntegrityError);

    expect(await databaseSnapshot()).toEqual(before);
  });

  it('downloads and parses the vocabulary response as unknown data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(payload)
    });
    vi.stubGlobal('fetch', fetchMock);
    const abortController = new AbortController();

    await expect(loadWordsPayload('/assets/words.json', abortController.signal)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith('/assets/words.json', { signal: abortController.signal });
  });

  it('rejects an unsuccessful vocabulary response without mutating local data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      })
    );
    const before = await databaseSnapshot();

    await expect(loadWordsPayload('/assets/words.json')).rejects.toThrow('Vocabulary download failed with HTTP 503');
    expect(await databaseSnapshot()).toEqual(before);
  });

  it('refuses an unexpectedly large automatic vocabulary removal and rolls back', async () => {
    const installedWords = Array.from({ length: 10 }, (_, index) =>
      buildTestWord({
        id: generateWordId(),
        sourceRef: `oxford:test:installed-${index}:noun:A1`,
        wordEn: [`installed-${index}`],
        wordTr: [`kurulu-${index}`]
      })
    );
    await performSeed(createWordsPayload(installedWords));
    const before = await databaseSnapshot();

    await expect(performSeed(createWordsPayload(installedWords.slice(0, 8)))).rejects.toThrow(
      'refusing to remove 2 of 10 installed system words automatically'
    );
    expect(await databaseSnapshot()).toEqual(before);
  });

  it('rolls back words, identity, and progress when a seed write fails', async () => {
    await performSeed(payload);
    const progress = createInitialWordProgress(sampleWord.id);
    const partProgress: PartProgress = {
      partId: 'A1-part-1',
      level: 'A1',
      partNumber: 1,
      startedAt: new Date().toISOString()
    };
    await Promise.all([db.wordProgress.put(progress), db.partProgress.put(partProgress)]);

    const nextPayload = replacementPayload();
    vi.spyOn(db.words, 'bulkPut').mockRejectedValueOnce(new Error('simulated seed write failure'));

    await expect(performSeed(nextPayload)).rejects.toThrow('simulated seed write failure');

    expect((await db.words.toArray()).map(word => word.id)).toEqual([sampleWord.id]);
    expect(await isSeedNeeded(payload.manifest)).toBe(false);
    expect(await isSeedNeeded(nextPayload.manifest)).toBe(true);
    expect(await db.wordProgress.get(progress.wordId)).toEqual(progress);
    expect(await db.partProgress.get(partProgress.partId)).toEqual(partProgress);
  });
});
