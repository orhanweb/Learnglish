// src/test/word-fixtures.ts

import type { ExampleSentence, Word } from '@/types';
import { EXAMPLES_REQUIRED } from '@/types';
import { generateWordId } from '@/lib/id';
import { expectedExampleLevel } from '@/lib/word-validation';

/**
 * Builds a fully-valid `ExampleSentence[]` of length `EXAMPLES_REQUIRED`,
 * following the canonical level sequence so the result passes `validateWord`.
 */
export function buildTestExamples(label = 'sample'): ExampleSentence[] {
  return Array.from({ length: EXAMPLES_REQUIRED }, (_, i) => ({
    en: `${label} example ${i + 1}`,
    tr: `${label} örnek ${i + 1}`,
    level: expectedExampleLevel(i)
  }));
}

/**
 * Builds a fully-valid `Word` with sensible defaults; pass overrides for any
 * field. Useful when a test needs a word that survives `validateWord` without
 * littering every spec with the same boilerplate.
 */
export function buildTestWord(overrides: Partial<Word> = {}): Word {
  const wordEnFromOverride = overrides.wordEn?.[0];
  return {
    id: generateWordId(),
    source: 'system',
    wordEn: ['sample'],
    wordTr: ['örnek'],
    partOfSpeech: 'noun',
    level: 'A1',
    partNumber: 1,
    definitionEn: 'A representative item used in tests.',
    definitionTr: 'Testlerde kullanılan örnek bir öğe.',
    examples: buildTestExamples(wordEnFromOverride ?? 'sample'),
    ...overrides
  };
}
