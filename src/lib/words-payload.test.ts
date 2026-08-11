// src/lib/words-payload.test.ts

import { describe, expect, it } from 'vitest';
import wordsData from '@/data/words.json';
import type { Word } from '@/types';
import { buildTestWord } from '@/test/word-fixtures';
import {
  WORDS_PAYLOAD_HASH_ALGORITHM,
  WORDS_PAYLOAD_SCHEMA_VERSION,
  WordsPayloadIntegrityError,
  createWordsPayload,
  parseWordsManifest,
  parseWordsPayload,
  serializeCanonicalWordFragment,
  serializeWordsPayload
} from './words-payload';

const FIRST_ID = 'wrd_00000000-0000-4000-8000-000000000001';
const SECOND_ID = 'wrd_00000000-0000-4000-8000-000000000002';

function makeWord(overrides: Partial<Word> = {}): Word {
  return buildTestWord({
    id: FIRST_ID,
    sourceRef: 'oxford:test:first:noun:A1',
    wordEn: ['alpha'],
    wordTr: ['alfa'],
    ...overrides
  });
}

function cloneUnknown<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('words payload contract', () => {
  it('produces deterministic bytes and ordering across equivalent input permutations', () => {
    const alpha = makeWord();
    const alphaVerb = makeWord({
      id: SECOND_ID,
      sourceRef: 'oxford:test:second:verb:A1',
      partOfSpeech: 'verb'
    });

    expect(serializeWordsPayload([alphaVerb, alpha])).toBe(serializeWordsPayload([alpha, alphaVerb]));
    expect(parseWordsPayload(createWordsPayload([alphaVerb, alpha])).words.map(word => word.id)).toEqual([
      FIRST_ID,
      SECOND_ID
    ]);
  });

  it('keeps the canonical hash contract locked to a golden vector', () => {
    expect(createWordsPayload([makeWord()]).manifest.contentHash).toBe('8f5b5c90');
  });

  it('builds a complete manifest from the canonical vocabulary', () => {
    const payload = createWordsPayload([makeWord()]);

    expect(payload.manifest).toEqual({
      schemaVersion: WORDS_PAYLOAD_SCHEMA_VERSION,
      hashAlgorithm: WORDS_PAYLOAD_HASH_ALGORITHM,
      contentHash: expect.stringMatching(/^[0-9a-f]{8}$/),
      counts: {
        words: 1,
        examples: 10,
        levels: {
          A1: { words: 1, parts: 1 },
          A2: { words: 0, parts: 0 },
          B1: { words: 0, parts: 0 },
          B2: { words: 0, parts: 0 },
          C1: { words: 0, parts: 0 }
        }
      }
    });
  });

  it('validates the lightweight manifest without loading vocabulary rows', () => {
    const manifest = createWordsPayload([makeWord()]).manifest;

    expect(parseWordsManifest(manifest)).toEqual(manifest);
    expect(() => parseWordsManifest({ ...manifest, schemaVersion: 2 })).toThrow(WordsPayloadIntegrityError);
    expect(() => parseWordsManifest({ ...manifest, contentHash: 'invalid' })).toThrow(WordsPayloadIntegrityError);
    expect(() =>
      parseWordsManifest({
        ...manifest,
        counts: {
          ...manifest.counts,
          levels: {
            ...manifest.counts.levels,
            A1: { ...manifest.counts.levels.A1, words: 0 }
          }
        }
      })
    ).toThrow(WordsPayloadIntegrityError);
  });

  it.each([
    ['missing manifest', { words: [makeWord()] }],
    ['empty manifest', { manifest: {}, words: [makeWord()] }],
    ['empty vocabulary', createWordsPayload([], { allowEmpty: true })]
  ])('rejects %s', (_label, candidate) => {
    expect(() => parseWordsPayload(candidate)).toThrow(WordsPayloadIntegrityError);
  });

  it('allows an empty payload only when an isolated caller explicitly opts in', () => {
    const empty = createWordsPayload([], { allowEmpty: true });

    expect(parseWordsPayload(empty, { allowEmpty: true })).toEqual(empty);
    expect(() => parseWordsPayload(empty)).toThrow(WordsPayloadIntegrityError);
  });

  it.each([
    ['schema version', (payload: ReturnType<typeof createWordsPayload>) => ({ ...payload.manifest, schemaVersion: 2 })],
    ['hash algorithm', (payload: ReturnType<typeof createWordsPayload>) => ({ ...payload.manifest, hashAlgorithm: 'other' })],
    [
      'word count',
      (payload: ReturnType<typeof createWordsPayload>) => ({
        ...payload.manifest,
        counts: { ...payload.manifest.counts, words: payload.manifest.counts.words + 1 }
      })
    ],
    [
      'example count',
      (payload: ReturnType<typeof createWordsPayload>) => ({
        ...payload.manifest,
        counts: { ...payload.manifest.counts, examples: payload.manifest.counts.examples - 1 }
      })
    ],
    [
      'level count',
      (payload: ReturnType<typeof createWordsPayload>) => ({
        ...payload.manifest,
        counts: {
          ...payload.manifest.counts,
          levels: {
            ...payload.manifest.counts.levels,
            A1: { ...payload.manifest.counts.levels.A1, words: 0 }
          }
        }
      })
    ],
    [
      'part count',
      (payload: ReturnType<typeof createWordsPayload>) => ({
        ...payload.manifest,
        counts: {
          ...payload.manifest.counts,
          levels: {
            ...payload.manifest.counts.levels,
            A1: { ...payload.manifest.counts.levels.A1, parts: 0 }
          }
        }
      })
    ],
    ['content hash', (payload: ReturnType<typeof createWordsPayload>) => ({ ...payload.manifest, contentHash: '00000000' })]
  ])('rejects a manifest with a mismatched %s', (_label, mutateManifest) => {
    const payload = createWordsPayload([makeWord()]);
    const candidate = { ...payload, manifest: mutateManifest(payload) };

    expect(() => parseWordsPayload(candidate)).toThrow(WordsPayloadIntegrityError);
  });

  it('rejects malformed, non-system, and schema-drifted word rows', () => {
    const valid = createWordsPayload([makeWord()]);
    const malformed = cloneUnknown(valid);
    malformed.words[0]!.examples = [];
    const nonSystem = cloneUnknown(valid) as unknown as { words: Array<Record<string, unknown>> };
    nonSystem.words[0]!['source'] = 'user';
    const drifted = cloneUnknown(valid) as unknown as { words: Array<Record<string, unknown>> };
    drifted.words[0]!['futureField'] = true;

    expect(() => parseWordsPayload(malformed)).toThrow(WordsPayloadIntegrityError);
    expect(() => parseWordsPayload(nonSystem)).toThrow(WordsPayloadIntegrityError);
    expect(() => parseWordsPayload(drifted)).toThrow(WordsPayloadIntegrityError);
  });

  it('accepts legitimate non-empty additions and removals with a fresh manifest', () => {
    const first = makeWord();
    const second = makeWord({
      id: SECOND_ID,
      sourceRef: 'oxford:test:second:noun:A1',
      wordEn: ['beta'],
      wordTr: ['beta']
    });

    expect(parseWordsPayload(createWordsPayload([first, second])).words).toHaveLength(2);
    expect(parseWordsPayload(createWordsPayload([second])).words).toHaveLength(1);
  });

  it('rejects gapped parts and duplicate synonym identifiers', () => {
    const first = makeWord({ partNumber: 2 });
    const second = makeWord({
      id: SECOND_ID,
      sourceRef: 'oxford:test:second:noun:A1',
      wordEn: ['beta'],
      synonyms: [FIRST_ID, FIRST_ID]
    });

    expect(() => createWordsPayload([first])).toThrow(WordsPayloadIntegrityError);
    expect(() => createWordsPayload([makeWord(), second])).toThrow(WordsPayloadIntegrityError);
  });

  it('serializes a validated single-word audit fragment without applying corpus part sequencing', () => {
    const word = makeWord({ partNumber: 7 });
    const fragment = serializeCanonicalWordFragment(word);

    expect(fragment).toContain('"partNumber": 7');
    expect(fragment).not.toContain('"manifest"');
    expect(() => serializeCanonicalWordFragment({ ...word, examples: [] })).toThrow(WordsPayloadIntegrityError);
  });

  it('verifies the checked-in production vocabulary and its manifest', () => {
    const payload = parseWordsPayload(wordsData);

    expect(payload.manifest.counts).toEqual({
      words: 5_945,
      examples: 59_450,
      levels: {
        A1: { words: 1_074, parts: 54 },
        A2: { words: 991, parts: 50 },
        B1: { words: 908, parts: 46 },
        B2: { words: 1_570, parts: 79 },
        C1: { words: 1_402, parts: 71 }
      }
    });
  });
});
