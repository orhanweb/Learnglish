// src/lib/answer-validation.test.ts

import { describe, it, expect } from 'vitest';
import { levenshteinDistance, maxTypoDistanceFor, normalizeText, validateAnswer, validateProductionAnswer } from './answer-validation';
import { buildTestWord } from '@/test/word-fixtures';

const word = buildTestWord({
  wordEn: ['house', 'home'],
  wordTr: ['ev'],
  partOfSpeech: 'noun',
  level: 'A1',
  partNumber: 1
});

const longWord = buildTestWord({
  wordEn: ['important'],
  wordTr: ['tamamlamak'],
  partOfSpeech: 'adjective',
  level: 'B1',
  partNumber: 1
});

const shortWord = buildTestWord({
  wordEn: ['go'],
  wordTr: ['git'],
  partOfSpeech: 'verb',
  level: 'A1',
  partNumber: 1
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('foo', 'foo')).toBe(0);
  });
  it('counts single substitution', () => {
    expect(levenshteinDistance('cat', 'cut')).toBe(1);
  });
  it('counts insertion + substitution', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('normalizeText', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeText('  Hello   World  ')).toBe('hello world');
  });
});

describe('maxTypoDistanceFor', () => {
  it('uses conservative length-aware boundaries', () => {
    expect(maxTypoDistanceFor('four')).toBe(0);
    expect(maxTypoDistanceFor('house')).toBe(1);
    expect(maxTypoDistanceFor('house', 'hous')).toBe(1);
    expect(maxTypoDistanceFor('12345678')).toBe(1);
    expect(maxTypoDistanceFor('123456789')).toBe(2);
    expect(maxTypoDistanceFor('123456789', '1234567')).toBe(0);
  });
});

describe('validateAnswer (recognition: EN -> TR)', () => {
  it('accepts an exact Turkish meaning', () => {
    const result = validateAnswer('ev', word, false);
    expect(result.isCorrect).toBe(true);
    expect(result.matchedMeaning).toBe('ev');
  });

  it('rejects an incorrect answer when typos are not tolerated', () => {
    const result = validateAnswer('eve', word, false);
    expect(result.isCorrect).toBe(false);
  });

  it('rejects a typo for a two-character target even when tolerance is on', () => {
    const result = validateAnswer('eve', word, true);
    expect(result.isCorrect).toBe(false);
  });

  it('accepts up to two edits for a long Turkish target', () => {
    expect(validateAnswer('tammlamk', longWord, true).isCorrect).toBe(true);
  });

  it('rejects more than two edits for a long Turkish target', () => {
    expect(validateAnswer('txmmlamk', longWord, true).isCorrect).toBe(false);
  });

  it('rejects empty input', () => {
    expect(validateAnswer('   ', word, true).isCorrect).toBe(false);
  });
});

describe('validateProductionAnswer (production: TR -> EN)', () => {
  it('accepts any of the English variants', () => {
    expect(validateProductionAnswer('home', word, false).isCorrect).toBe(true);
    expect(validateProductionAnswer('house', word, false).isCorrect).toBe(true);
  });

  it('tolerates typos when enabled', () => {
    expect(validateProductionAnswer('hous', word, true).isCorrect).toBe(true);
  });

  it('rejects two edits for a medium-length target', () => {
    expect(validateProductionAnswer('hse', word, true).isCorrect).toBe(false);
  });

  it('requires an exact answer for targets up to four characters', () => {
    expect(validateProductionAnswer('no', shortWord, true).isCorrect).toBe(false);
    expect(validateAnswer('giy', shortWord, true).isCorrect).toBe(false);
    expect(validateProductionAnswer('hone', word, true).isCorrect).toBe(false);
  });

  it('accepts two edits but rejects three for a long target', () => {
    expect(validateProductionAnswer('impurtent', longWord, true).isCorrect).toBe(true);
    expect(validateProductionAnswer('xmpurtent', longWord, true).isCorrect).toBe(false);
  });

  it('rejects a shortened answer that would borrow tolerance from the longer target', () => {
    expect(validateProductionAnswer('importa', longWord, true).isCorrect).toBe(false);
  });

  it('rejects nonsense even with typo tolerance', () => {
    expect(validateProductionAnswer('zzzzz', word, true).isCorrect).toBe(false);
  });
});
