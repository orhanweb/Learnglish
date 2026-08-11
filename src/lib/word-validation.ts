// src/lib/word-validation.ts

import type { ExampleSentence, Level, PartOfSpeech, Word } from '../types/index.js';
import { EXAMPLE_LEVEL_SEQUENCE, EXAMPLES_REQUIRED, LEVELS_ORDERED, PART_OF_SPEECH_VALUES } from '../types/index.js';
import { isWordId } from './id.js';

/**
 * Aggregated validation failure for a single word, surfacing every offending
 * field at once so authors can fix the data in one pass.
 */
export class WordValidationError extends Error {
  readonly issues: readonly string[];
  readonly wordRef: string;

  constructor(wordRef: string, issues: readonly string[]) {
    super(`Word "${wordRef}" is invalid:\n - ${issues.join('\n - ')}`);
    this.name = 'WordValidationError';
    this.wordRef = wordRef;
    this.issues = issues;
  }
}

const PART_OF_SPEECH_SET: ReadonlySet<PartOfSpeech> = new Set(PART_OF_SPEECH_VALUES);
const LEVEL_SET: ReadonlySet<Level> = new Set(LEVELS_ORDERED);

const isNonEmptyTrimmedStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim().length > 0);

const isNonEmptyTrimmedString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Validates an example sentence in isolation; index is included only for error context. */
function collectExampleIssues(example: ExampleSentence | undefined, slot: number, expectedLevel: Level): string[] {
  const issues: string[] = [];
  if (!example || typeof example !== 'object') {
    issues.push(`examples[${slot}]: must be an object`);
    return issues;
  }
  if (!isNonEmptyTrimmedString(example.en)) issues.push(`examples[${slot}].en: must be a non-empty string`);
  if (!isNonEmptyTrimmedString(example.tr)) issues.push(`examples[${slot}].tr: must be a non-empty string`);
  if (!LEVEL_SET.has(example.level)) {
    issues.push(`examples[${slot}].level: "${String(example.level)}" is not a valid CEFR level`);
  } else if (example.level !== expectedLevel) {
    issues.push(`examples[${slot}].level: expected "${expectedLevel}", received "${example.level}"`);
  }
  return issues;
}

/** Returns the expected CEFR level for a given example slot (0-based index). */
export function expectedExampleLevel(slot: number): Level {
  if (slot < 0 || slot >= EXAMPLES_REQUIRED) {
    throw new RangeError(`Example slot ${slot} is outside [0, ${EXAMPLES_REQUIRED - 1}]`);
  }
  const fromSequence = EXAMPLE_LEVEL_SEQUENCE[slot];
  if (fromSequence) return fromSequence;
  // Slots beyond the graduated sequence are reinforced C1 usage.
  return 'C1';
}

/**
 * Validates a single `Word` object. Throws `WordValidationError` listing every
 * issue found; returns the word unchanged on success so it composes in a `.map`.
 */
export function validateWord(word: Word, knownIds?: ReadonlySet<string>): Word {
  const ref = word?.id ?? '<missing id>';
  const issues: string[] = [];

  if (!isWordId(word?.id)) {
    issues.push(`id: "${String(word?.id)}" must match the wrd_<uuid> shape`);
  }
  if (word?.source !== 'system' && word?.source !== 'user') {
    issues.push(`source: "${String(word?.source)}" must be "system" or "user"`);
  }
  if (
    word?.sourceRef !== undefined &&
    (!isNonEmptyTrimmedString(word.sourceRef) || word.sourceRef !== word.sourceRef.trim())
  ) {
    issues.push('sourceRef: must be a non-empty, trimmed string when present');
  }
  if (!isNonEmptyTrimmedStringArray(word?.wordEn)) issues.push('wordEn: must be a non-empty string array');
  if (!isNonEmptyTrimmedStringArray(word?.wordTr)) issues.push('wordTr: must be a non-empty string array');
  if (!PART_OF_SPEECH_SET.has(word?.partOfSpeech)) {
    issues.push(`partOfSpeech: "${String(word?.partOfSpeech)}" is not a recognized category`);
  }
  if (!LEVEL_SET.has(word?.level)) {
    issues.push(`level: "${String(word?.level)}" is not a valid CEFR level`);
  }
  if (!Number.isInteger(word?.partNumber) || word.partNumber < 1) {
    issues.push(`partNumber: "${String(word?.partNumber)}" must be a positive integer`);
  }
  if (!isNonEmptyTrimmedString(word?.definitionEn)) issues.push('definitionEn: must be a non-empty string');
  if (!isNonEmptyTrimmedString(word?.definitionTr)) issues.push('definitionTr: must be a non-empty string');

  if (!Array.isArray(word?.examples)) {
    issues.push(`examples: must be an array of length ${EXAMPLES_REQUIRED}`);
  } else if (word.examples.length !== EXAMPLES_REQUIRED) {
    issues.push(`examples: expected exactly ${EXAMPLES_REQUIRED} entries, received ${word.examples.length}`);
  } else {
    for (let i = 0; i < EXAMPLES_REQUIRED; i++) {
      issues.push(...collectExampleIssues(word.examples[i], i, expectedExampleLevel(i)));
    }
  }

  if (word?.synonyms !== undefined) {
    if (!Array.isArray(word.synonyms)) {
      issues.push('synonyms: must be a string array when present');
    } else {
      word.synonyms.forEach((synId: string, i: number) => {
        if (!isWordId(synId)) {
          issues.push(`synonyms[${i}]: "${String(synId)}" must match the wrd_<uuid> shape`);
        } else if (synId === word.id) {
          issues.push(`synonyms[${i}]: cannot reference the word itself`);
        } else if (knownIds && !knownIds.has(synId)) {
          issues.push(`synonyms[${i}]: "${synId}" does not match any known word id`);
        }
      });
    }
  }

  if (issues.length > 0) {
    throw new WordValidationError(ref, issues);
  }
  return word;
}

/**
 * Validates a collection of words. Cross-checks synonym references against the
 * full set so dangling links surface during seeding rather than at runtime.
 */
export function validateWords(words: readonly Word[]): readonly Word[] {
  const ids = new Set<string>();
  const sourceRefs = new Set<string>();
  for (const w of words) {
    if (isWordId(w?.id)) {
      if (ids.has(w.id)) {
        throw new WordValidationError(w.id, [`id: duplicate identifier "${w.id}" in payload`]);
      }
      ids.add(w.id);
    }
    if (isNonEmptyTrimmedString(w?.sourceRef) && w.sourceRef === w.sourceRef.trim()) {
      if (sourceRefs.has(w.sourceRef)) {
        throw new WordValidationError(w.id, [`sourceRef: duplicate source identity "${w.sourceRef}" in payload`]);
      }
      sourceRefs.add(w.sourceRef);
    }
  }
  for (const w of words) {
    validateWord(w, ids);
  }
  return words;
}
