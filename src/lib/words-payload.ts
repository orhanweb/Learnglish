// src/lib/words-payload.ts

import {
  LEVELS_ORDERED,
  PART_OF_SPEECH_VALUES,
  type Level,
  type PartOfSpeech,
  type Word
} from '../types/index.js';
import { validateWord, validateWords } from './word-validation.js';

export const WORDS_PAYLOAD_SCHEMA_VERSION = 1 as const;
export const WORDS_PAYLOAD_HASH_ALGORITHM = 'djb2-v1' as const;

export interface WordsLevelCounts {
  readonly words: number;
  readonly parts: number;
}

export interface WordsManifestCounts {
  readonly words: number;
  readonly examples: number;
  readonly levels: Record<Level, WordsLevelCounts>;
}

export interface WordsManifest {
  readonly schemaVersion: typeof WORDS_PAYLOAD_SCHEMA_VERSION;
  readonly hashAlgorithm: typeof WORDS_PAYLOAD_HASH_ALGORITHM;
  readonly contentHash: string;
  readonly counts: WordsManifestCounts;
}

export interface WordsPayload {
  readonly manifest: WordsManifest;
  readonly words: readonly Word[];
}

export interface WordsPayloadOptions {
  readonly allowEmpty?: boolean;
}

export class WordsPayloadIntegrityError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[], options?: ErrorOptions) {
    super(`words.json integrity check failed:\n - ${issues.join('\n - ')}`, options);
    this.name = 'WordsPayloadIntegrityError';
    this.issues = issues;
  }
}

const LEVEL_RANK = new Map<Level, number>(LEVELS_ORDERED.map((level, index) => [level, index]));
const PART_OF_SPEECH_RANK = new Map<PartOfSpeech, number>(
  PART_OF_SPEECH_VALUES.map((part, index) => [part, index])
);
const CONTENT_HASH_PATTERN = /^[0-9a-f]{8}$/;
const WORD_KEYS = new Set([
  'id',
  'source',
  'sourceRef',
  'wordEn',
  'wordTr',
  'partOfSpeech',
  'level',
  'partNumber',
  'definitionEn',
  'definitionTr',
  'examples',
  'synonyms'
]);
const EXAMPLE_KEYS = new Set(['en', 'tr', 'level']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareWords(left: Word, right: Word): number {
  const levelDelta =
    (LEVEL_RANK.get(left.level) ?? Number.MAX_SAFE_INTEGER) -
    (LEVEL_RANK.get(right.level) ?? Number.MAX_SAFE_INTEGER);
  if (levelDelta !== 0) return levelDelta;

  const partDelta = left.partNumber - right.partNumber;
  if (partDelta !== 0) return partDelta;

  const headwordDelta = compareText(left.wordEn[0] ?? '', right.wordEn[0] ?? '');
  if (headwordDelta !== 0) return headwordDelta;

  const partOfSpeechDelta =
    (PART_OF_SPEECH_RANK.get(left.partOfSpeech) ?? Number.MAX_SAFE_INTEGER) -
    (PART_OF_SPEECH_RANK.get(right.partOfSpeech) ?? Number.MAX_SAFE_INTEGER);
  if (partOfSpeechDelta !== 0) return partOfSpeechDelta;

  const sourceRefDelta = compareText(left.sourceRef ?? '', right.sourceRef ?? '');
  if (sourceRefDelta !== 0) return sourceRefDelta;

  return compareText(left.id, right.id);
}

function canonicalizeWord(word: Word): Word {
  return {
    id: word.id,
    source: 'system',
    ...(word.sourceRef !== undefined ? { sourceRef: word.sourceRef } : {}),
    wordEn: [...word.wordEn],
    wordTr: [...word.wordTr],
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    partNumber: word.partNumber,
    definitionEn: word.definitionEn,
    definitionTr: word.definitionTr,
    examples: word.examples.map(example => ({ en: example.en, tr: example.tr, level: example.level })),
    ...(word.synonyms !== undefined ? { synonyms: [...word.synonyms].sort(compareText) } : {})
  };
}

function validatePartSequence(words: readonly Word[]): void {
  const issues: string[] = [];

  for (const level of LEVELS_ORDERED) {
    const parts = [...new Set(words.filter(word => word.level === level).map(word => word.partNumber))].sort(
      (left, right) => left - right
    );
    parts.forEach((partNumber, index) => {
      const expected = index + 1;
      if (partNumber !== expected) {
        issues.push(
          `${level}: part numbers must be contiguous from 1; expected ${expected}, received ${partNumber}`
        );
      }
    });
  }

  if (issues.length > 0) throw new WordsPayloadIntegrityError(issues);
}

function collectUnexpectedKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string
): string[] {
  return Object.keys(value)
    .filter(key => !allowed.has(key))
    .map(key => `${label}: unexpected field "${key}"`);
}

function collectWordShapeIssues(words: readonly unknown[]): string[] {
  return words.flatMap((word, wordIndex) => {
    if (!isRecord(word)) return [];

    const issues = collectUnexpectedKeys(word, WORD_KEYS, `words[${wordIndex}]`);
    const examples = word['examples'];
    if (!Array.isArray(examples)) return issues;

    return [
      ...issues,
      ...examples.flatMap((example, exampleIndex) =>
        isRecord(example)
          ? collectUnexpectedKeys(example, EXAMPLE_KEYS, `words[${wordIndex}].examples[${exampleIndex}]`)
          : []
      )
    ];
  });
}

function prepareSystemWords(
  words: readonly unknown[],
  options: WordsPayloadOptions = {},
  wrapValidationError = true
): Word[] {
  if (!options.allowEmpty && words.length === 0) {
    throw new WordsPayloadIntegrityError(['words: vocabulary payload must contain at least one word']);
  }

  const sourceIssues = words.flatMap((word, index) => {
    if (!isRecord(word)) return [];
    const source = word['source'];
    return source === undefined || source === 'system'
      ? []
      : [`words[${index}].source: must be "system" when present`];
  });
  const duplicateSynonymIssues = words.flatMap((word, index) => {
    if (!isRecord(word) || !Array.isArray(word['synonyms'])) return [];
    const synonyms = word['synonyms'];
    return new Set(synonyms).size === synonyms.length
      ? []
      : [`words[${index}].synonyms: duplicate identifiers are not allowed`];
  });
  const preparationIssues = [...sourceIssues, ...duplicateSynonymIssues];
  if (preparationIssues.length > 0) throw new WordsPayloadIntegrityError(preparationIssues);

  const normalized = words.map(word =>
    isRecord(word) ? ({ ...word, source: 'system' } as unknown as Word) : (word as Word)
  );

  try {
    validateWords(normalized);
  } catch (error) {
    if (!wrapValidationError) throw error;
    throw new WordsPayloadIntegrityError(['words: one or more entries failed validation'], { cause: error });
  }

  validatePartSequence(normalized);
  return normalized.map(canonicalizeWord).sort(compareWords);
}

function prepareSystemWordFragment(word: Word): Word {
  if (word.source !== undefined && word.source !== 'system') {
    throw new WordsPayloadIntegrityError(['word.source: must be "system" when present']);
  }
  if (word.synonyms !== undefined && new Set(word.synonyms).size !== word.synonyms.length) {
    throw new WordsPayloadIntegrityError(['word.synonyms: duplicate identifiers are not allowed']);
  }

  const normalized = { ...word, source: 'system' } satisfies Word;
  try {
    validateWord(normalized);
  } catch (error) {
    throw new WordsPayloadIntegrityError(['word: entry failed validation'], { cause: error });
  }
  return canonicalizeWord(normalized);
}

function djb2(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index++) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function serializePreparedWordsCore(words: readonly Word[]): string {
  return `${JSON.stringify({ words }, null, 2)}\n`;
}

function createCounts(words: readonly Word[]): WordsManifestCounts {
  const levels = Object.fromEntries(
    LEVELS_ORDERED.map(level => {
      const levelWords = words.filter(word => word.level === level);
      return [
        level,
        {
          words: levelWords.length,
          parts: new Set(levelWords.map(word => word.partNumber)).size
        }
      ];
    })
  ) as Record<Level, WordsLevelCounts>;

  return {
    words: words.length,
    examples: words.reduce((total, word) => total + word.examples.length, 0),
    levels
  };
}

function createManifest(words: readonly Word[]): WordsManifest {
  return {
    schemaVersion: WORDS_PAYLOAD_SCHEMA_VERSION,
    hashAlgorithm: WORDS_PAYLOAD_HASH_ALGORITHM,
    contentHash: djb2(serializePreparedWordsCore(words)),
    counts: createCounts(words)
  };
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string, issues: string[]): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    issues.push(`${label}: expected keys ${wanted.join(', ')}, received ${actual.join(', ') || '<none>'}`);
  }
}

function collectNonNegativeIntegerIssue(value: unknown, label: string): string[] {
  return Number.isInteger(value) && Number(value) >= 0 ? [] : [`${label}: must be a non-negative integer`];
}

export function parseWordsManifest(value: unknown, options: WordsPayloadOptions = {}): WordsManifest {
  if (!isRecord(value)) throw new WordsPayloadIntegrityError(['manifest: must be an object']);
  const issues: string[] = [];
  exactKeys(value, ['schemaVersion', 'hashAlgorithm', 'contentHash', 'counts'], 'manifest', issues);
  if (value['schemaVersion'] !== WORDS_PAYLOAD_SCHEMA_VERSION) {
    issues.push(`manifest.schemaVersion: expected ${WORDS_PAYLOAD_SCHEMA_VERSION}`);
  }
  if (value['hashAlgorithm'] !== WORDS_PAYLOAD_HASH_ALGORITHM) {
    issues.push(`manifest.hashAlgorithm: expected ${WORDS_PAYLOAD_HASH_ALGORITHM}`);
  }
  if (typeof value['contentHash'] !== 'string' || !CONTENT_HASH_PATTERN.test(value['contentHash'])) {
    issues.push('manifest.contentHash: must be an 8-character lowercase hexadecimal string');
  }

  const counts = value['counts'];
  if (!isRecord(counts)) {
    issues.push('manifest.counts: must be an object');
  } else {
    exactKeys(counts, ['words', 'examples', 'levels'], 'manifest.counts', issues);
    issues.push(...collectNonNegativeIntegerIssue(counts['words'], 'manifest.counts.words'));
    issues.push(...collectNonNegativeIntegerIssue(counts['examples'], 'manifest.counts.examples'));

    if (!options.allowEmpty && counts['words'] === 0) {
      issues.push('manifest.counts.words: vocabulary payload must contain at least one word');
    }

    const levels = counts['levels'];
    if (!isRecord(levels)) {
      issues.push('manifest.counts.levels: must be an object');
    } else {
      exactKeys(levels, LEVELS_ORDERED, 'manifest.counts.levels', issues);
      let levelWordTotal = 0;
      for (const level of LEVELS_ORDERED) {
        const levelCounts = levels[level];
        if (!isRecord(levelCounts)) {
          issues.push(`manifest.counts.levels.${level}: must be an object`);
          continue;
        }
        exactKeys(levelCounts, ['words', 'parts'], `manifest.counts.levels.${level}`, issues);
        issues.push(
          ...collectNonNegativeIntegerIssue(levelCounts['words'], `manifest.counts.levels.${level}.words`),
          ...collectNonNegativeIntegerIssue(levelCounts['parts'], `manifest.counts.levels.${level}.parts`)
        );
        if (Number.isInteger(levelCounts['words'])) levelWordTotal += Number(levelCounts['words']);
      }
      if (Number.isInteger(counts['words']) && levelWordTotal !== counts['words']) {
        issues.push(
          `manifest.counts.levels: word counts total ${levelWordTotal}, expected ${String(counts['words'])}`
        );
      }
    }
  }

  if (issues.length > 0) throw new WordsPayloadIntegrityError(issues);
  return value as unknown as WordsManifest;
}

export function readWordsPayloadManifest(value: unknown, options: WordsPayloadOptions = {}): WordsManifest {
  if (!isRecord(value)) throw new WordsPayloadIntegrityError(['payload: must be an object']);

  const issues: string[] = [];
  exactKeys(value, ['manifest', 'words'], 'payload', issues);
  const words = value['words'];
  if (!Array.isArray(words)) issues.push('words: must be an array');
  if (issues.length > 0) throw new WordsPayloadIntegrityError(issues);

  const manifest = parseWordsManifest(value['manifest'], options);
  if (Array.isArray(words) && words.length !== manifest.counts.words) {
    throw new WordsPayloadIntegrityError([
      `manifest.counts.words: expected ${words.length}, received ${manifest.counts.words}`
    ]);
  }
  return manifest;
}

export function wordsPayloadIdentity(manifest: WordsManifest): string {
  return `${manifest.schemaVersion}:${manifest.hashAlgorithm}:${manifest.contentHash}`;
}

function compareManifest(value: unknown, expected: WordsManifest): void {
  const issues: string[] = [];
  if (!isRecord(value)) throw new WordsPayloadIntegrityError(['manifest: must be an object']);

  exactKeys(value, ['schemaVersion', 'hashAlgorithm', 'contentHash', 'counts'], 'manifest', issues);
  if (value['schemaVersion'] !== expected.schemaVersion) issues.push(`manifest.schemaVersion: expected ${expected.schemaVersion}`);
  if (value['hashAlgorithm'] !== expected.hashAlgorithm) issues.push(`manifest.hashAlgorithm: expected ${expected.hashAlgorithm}`);
  if (typeof value['contentHash'] !== 'string' || !CONTENT_HASH_PATTERN.test(value['contentHash'])) {
    issues.push('manifest.contentHash: must be an 8-character lowercase hexadecimal string');
  } else if (value['contentHash'] !== expected.contentHash) {
    issues.push(`manifest.contentHash: expected ${expected.contentHash}, received ${value['contentHash']}`);
  }

  const counts = value['counts'];
  if (!isRecord(counts)) {
    issues.push('manifest.counts: must be an object');
  } else {
    exactKeys(counts, ['words', 'examples', 'levels'], 'manifest.counts', issues);
    if (counts['words'] !== expected.counts.words) {
      issues.push(`manifest.counts.words: expected ${expected.counts.words}, received ${String(counts['words'])}`);
    }
    if (counts['examples'] !== expected.counts.examples) {
      issues.push(`manifest.counts.examples: expected ${expected.counts.examples}, received ${String(counts['examples'])}`);
    }

    const levels = counts['levels'];
    if (!isRecord(levels)) {
      issues.push('manifest.counts.levels: must be an object');
    } else {
      exactKeys(levels, LEVELS_ORDERED, 'manifest.counts.levels', issues);
      for (const level of LEVELS_ORDERED) {
        const levelCounts = levels[level];
        if (!isRecord(levelCounts)) {
          issues.push(`manifest.counts.levels.${level}: must be an object`);
          continue;
        }
        exactKeys(levelCounts, ['words', 'parts'], `manifest.counts.levels.${level}`, issues);
        if (levelCounts['words'] !== expected.counts.levels[level].words) {
          issues.push(
            `manifest.counts.levels.${level}.words: expected ${expected.counts.levels[level].words}, received ${String(levelCounts['words'])}`
          );
        }
        if (levelCounts['parts'] !== expected.counts.levels[level].parts) {
          issues.push(
            `manifest.counts.levels.${level}.parts: expected ${expected.counts.levels[level].parts}, received ${String(levelCounts['parts'])}`
          );
        }
      }
    }
  }

  if (issues.length > 0) throw new WordsPayloadIntegrityError(issues);
}

export function createWordsPayload(words: readonly Word[], options: WordsPayloadOptions = {}): WordsPayload {
  const prepared = prepareSystemWords(words, options, false);
  return {
    manifest: createManifest(prepared),
    words: prepared
  };
}

export function parseWordsPayload(value: unknown, options: WordsPayloadOptions = {}): WordsPayload {
  readWordsPayloadManifest(value, options);
  const envelope = value as Record<string, unknown>;

  const rawWords = envelope['words'] as unknown[];
  const shapeIssues = collectWordShapeIssues(rawWords);
  if (shapeIssues.length > 0) throw new WordsPayloadIntegrityError(shapeIssues);

  const prepared = prepareSystemWords(rawWords, options);
  const expectedManifest = createManifest(prepared);
  compareManifest(envelope['manifest'], expectedManifest);

  return {
    manifest: expectedManifest,
    words: prepared
  };
}

export function serializeWordsPayload(words: readonly Word[], options: WordsPayloadOptions = {}): string {
  return `${JSON.stringify(createWordsPayload(words, options), null, 2)}\n`;
}

export function serializeCanonicalWordsCore(words: readonly Word[], options: WordsPayloadOptions = {}): string {
  return serializePreparedWordsCore(prepareSystemWords(words, options));
}

export function serializeCanonicalWordFragment(word: Word): string {
  return serializePreparedWordsCore([prepareSystemWordFragment(word)]);
}
