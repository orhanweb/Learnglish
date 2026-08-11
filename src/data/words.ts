// src/data/words.ts

import Dexie from 'dexie';
import { db } from '@/lib/db';
import type { Level, Part, Word } from '@/types';

export interface PartWordIndex {
  level: Level;
  partNumber: number;
  wordIds: string[];
}

export async function getAllWords(): Promise<Word[]> {
  return db.words.toArray();
}

export async function getWordsForLevel(level: Level): Promise<Word[]> {
  return db.words.where('level').equals(level).toArray();
}

export async function getWordCountForLevel(level: Level): Promise<number> {
  return db.words.where('level').equals(level).count();
}

export async function getTotalWordCount(): Promise<number> {
  return db.words.count();
}

export async function getPartWordIndexesForLevel(level: Level): Promise<PartWordIndex[]> {
  const partMap = new Map<number, string[]>();

  await db.words
    .where('[level+partNumber]')
    .between([level, Dexie.minKey], [level, Dexie.maxKey], true, true)
    .eachPrimaryKey((wordId, cursor) => {
      const indexKey: unknown = cursor.key;
      if (!Array.isArray(indexKey) || indexKey[0] !== level || typeof indexKey[1] !== 'number') {
        throw new Error(`Invalid word index for level ${level}.`);
      }

      const partNumber = indexKey[1];
      const existing = partMap.get(partNumber);
      if (existing) {
        existing.push(wordId);
        return;
      }
      partMap.set(partNumber, [wordId]);
    });

  return Array.from(partMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([partNumber, wordIds]) => ({
      level,
      partNumber,
      wordIds: wordIds.sort()
    }));
}

export async function getPartsForLevel(level: Level): Promise<Part[]> {
  const levelWords = await db.words.where('level').equals(level).toArray();
  const partMap = new Map<number, Word[]>();

  levelWords.forEach(word => {
    const existing = partMap.get(word.partNumber);
    if (existing) {
      existing.push(word);
      return;
    }
    partMap.set(word.partNumber, [word]);
  });

  return Array.from(partMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([partNumber, partWords]) => ({
      level,
      partNumber,
      words: partWords
    }));
}

export async function getPart(level: Level, partNumber: number): Promise<Part | undefined> {
  const partWords = await db.words.where({ level, partNumber }).toArray();
  if (partWords.length === 0) return undefined;
  return { level, partNumber, words: partWords };
}

export async function getWordById(id: string): Promise<Word | undefined> {
  return db.words.get(id);
}
