// src/lib/word-validation.test.ts

import { describe, it, expect } from 'vitest';
import { EXAMPLES_REQUIRED } from '@/types';
import { generateWordId } from './id';
import { expectedExampleLevel, validateWord, validateWords, WordValidationError } from './word-validation';
import { buildTestExamples as buildExamples, buildTestWord as buildWord } from '@/test/word-fixtures';

describe('expectedExampleLevel', () => {
  it('graduates the first five slots through CEFR levels', () => {
    expect(expectedExampleLevel(0)).toBe('A1');
    expect(expectedExampleLevel(1)).toBe('A2');
    expect(expectedExampleLevel(2)).toBe('B1');
    expect(expectedExampleLevel(3)).toBe('B2');
    expect(expectedExampleLevel(4)).toBe('C1');
  });

  it('reinforces remaining slots as C1', () => {
    for (let i = 5; i < EXAMPLES_REQUIRED; i++) {
      expect(expectedExampleLevel(i)).toBe('C1');
    }
  });

  it('rejects out-of-range slots', () => {
    expect(() => expectedExampleLevel(-1)).toThrow(RangeError);
    expect(() => expectedExampleLevel(EXAMPLES_REQUIRED)).toThrow(RangeError);
  });
});

describe('validateWord', () => {
  it('accepts a fully valid word and returns it unchanged', () => {
    const word = buildWord();
    expect(validateWord(word)).toBe(word);
  });

  it('rejects a malformed id', () => {
    const word = buildWord({ id: 'cat-noun-1' });
    expect(() => validateWord(word)).toThrow(WordValidationError);
  });

  it('rejects unknown part of speech', () => {
    const word = buildWord({ partOfSpeech: 'gerund' as never });
    expect(() => validateWord(word)).toThrow(/partOfSpeech/);
  });

  it('accepts an absent sourceRef and rejects blank or untrimmed sourceRefs', () => {
    expect(() => validateWord(buildWord())).not.toThrow();
    expect(() => validateWord(buildWord({ sourceRef: '' }))).toThrow(/sourceRef/);
    expect(() => validateWord(buildWord({ sourceRef: ' oxford:v1:abc' }))).toThrow(/sourceRef/);
  });

  it('rejects empty wordEn or wordTr arrays', () => {
    expect(() => validateWord(buildWord({ wordEn: [] }))).toThrow(/wordEn/);
    expect(() => validateWord(buildWord({ wordTr: [''] }))).toThrow(/wordTr/);
  });

  it('rejects when example count differs from EXAMPLES_REQUIRED', () => {
    const word = buildWord({ examples: buildExamples().slice(0, 6) });
    expect(() => validateWord(word)).toThrow(/examples: expected exactly 10/);
  });

  it('rejects when example level sequence is broken', () => {
    const examples = buildExamples();
    examples[0] = { en: 'x', tr: 'y', level: 'C1' };
    const word = buildWord({ examples });
    expect(() => validateWord(word)).toThrow(/examples\[0\]\.level/);
  });

  it('rejects synonyms that reference the word itself', () => {
    const id = generateWordId();
    const word = buildWord({ id, synonyms: [id] });
    expect(() => validateWord(word)).toThrow(/cannot reference the word itself/);
  });

  it('rejects synonyms that point to unknown ids when knownIds is provided', () => {
    const word = buildWord({ synonyms: [generateWordId()] });
    expect(() => validateWord(word, new Set([word.id]))).toThrow(/does not match any known word id/);
  });

  it('aggregates multiple issues into a single error', () => {
    const word = buildWord({ id: 'broken', wordEn: [], partOfSpeech: 'verbish' as never });
    try {
      validateWord(word);
      throw new Error('expected validation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(WordValidationError);
      const issues = (err as WordValidationError).issues;
      expect(issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('validateWords', () => {
  it('accepts a payload with cross-referenced synonyms', () => {
    const a = buildWord();
    const b = buildWord({ synonyms: [a.id] });
    expect(() => validateWords([a, b])).not.toThrow();
  });

  it('rejects duplicate ids in the payload', () => {
    const a = buildWord();
    const b = buildWord({ id: a.id });
    expect(() => validateWords([a, b])).toThrow(/duplicate identifier/);
  });

  it('rejects duplicate sourceRefs while allowing words without source metadata', () => {
    const sourceRef = 'oxford:v1:deterministic-source-reference';
    const a = buildWord({ sourceRef });
    const b = buildWord({ sourceRef });
    const legacy = buildWord();

    expect(() => validateWords([a, b, legacy])).toThrow(/duplicate source identity/);
    expect(() => validateWords([a, legacy])).not.toThrow();
  });

  it('rejects dangling synonym references', () => {
    const a = buildWord({ synonyms: [generateWordId()] });
    expect(() => validateWords([a])).toThrow(/does not match any known word id/);
  });
});
