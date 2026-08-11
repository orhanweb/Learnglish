// src/types/word.ts

/**
 * CEFR language proficiency levels.
 */
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

/** Ordered list of CEFR levels (easiest to hardest). */
export const LEVELS_ORDERED: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

/**
 * Origin of the word entry.
 */
export type WordSource = 'system' | 'user';

/**
 * Grammatical category of a word.
 *
 * `phrasal-verb`, `idiom`, and `phrase` are first-class entries because vocabulary
 * learners memorize them as units (not as the sum of their constituent words).
 * `determiner` is split out from `pronoun` to match modern grammar references.
 */
export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'determiner'
  | 'interjection'
  | 'phrasal-verb'
  | 'idiom'
  | 'phrase';

/** All allowed `PartOfSpeech` values, useful for validation and UI menus. */
export const PART_OF_SPEECH_VALUES: readonly PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'determiner',
  'interjection',
  'phrasal-verb',
  'idiom',
  'phrase'
] as const;

/**
 * Required number of example sentences per word.
 * First five follow `EXAMPLE_LEVEL_SEQUENCE`; remaining slots are reinforced C1 usage.
 */
export const EXAMPLES_REQUIRED = 10;

/**
 * Level distribution for a word's first five example sentences (graduated exposure).
 * Slots 6..N are always `'C1'` for advanced reinforcement.
 */
export const EXAMPLE_LEVEL_SEQUENCE: readonly Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

/**
 * Example sentence with CEFR level grading.
 */
export interface ExampleSentence {
  /** English sentence */
  en: string;
  /** Turkish translation */
  tr: string;
  /** CEFR level the sentence is calibrated for */
  level: Level;
}

/**
 * Core vocabulary word structure.
 */
export interface Word {
  /** Opaque, stable identifier (`wrd_<uuid>`); never derived from content. */
  id: string;
  /** Whether this word is system-provided or user-created */
  source: WordSource;
  /** Immutable identity of the canonical source row, when imported. */
  readonly sourceRef?: string;
  /** English word variants */
  wordEn: string[];
  /** Turkish word variants */
  wordTr: string[];
  /** Grammatical category */
  partOfSpeech: PartOfSpeech;
  /** CEFR level */
  level: Level;
  /** Part number within the level (1-based) */
  partNumber: number;

  /** English dictionary definition */
  definitionEn: string;
  /** Turkish dictionary definition */
  definitionTr: string;

  /** Exactly `EXAMPLES_REQUIRED` example sentences (ordered, level-graded). */
  examples: ExampleSentence[];
  /** Related word IDs for navigation */
  synonyms?: string[];
}

/**
 * A collection of words grouped by part.
 */
export interface Part {
  level: Level;
  partNumber: number;
  words: Word[];
}

/**
 * Static metadata for a level. Part counts are derived at runtime from the
 * actual word data and `PART_SIZE`, so they live outside this config.
 */
export interface LevelConfig {
  level: Level;
  name: string;
  description: string;
  color: string;
}

/**
 * All available levels configuration.
 */
export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 'A1',
    name: 'Beginner',
    description: 'Basic vocabulary for everyday situations',
    color: 'emerald'
  },
  {
    level: 'A2',
    name: 'Elementary',
    description: 'Common expressions and simple phrases',
    color: 'teal'
  },
  {
    level: 'B1',
    name: 'Intermediate',
    description: 'Independent language use',
    color: 'cyan'
  },
  {
    level: 'B2',
    name: 'Upper Intermediate',
    description: 'Complex texts and fluent interaction',
    color: 'blue'
  },
  {
    level: 'C1',
    name: 'Advanced',
    description: 'Demanding texts and implicit meaning',
    color: 'violet'
  }
];
