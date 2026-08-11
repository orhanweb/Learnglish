// src/hooks/useDueWords.ts

import { useEffect, useMemo } from 'react';
import type { Level, Word, WordProgress } from '@/types';
import { useDueWordsStore } from '@/stores/dueWordsStore';

export interface UseDueWordsOptions {
  level?: Level;
  enabled?: boolean;
}

export interface UseDueWordsResult {
  isLoading: boolean;
  entries: Array<{ progress: WordProgress; word: Word | undefined }>;
  filteredEntries: Array<{ progress: WordProgress; word: Word }>;
  words: Word[];
  refresh: () => Promise<void>;
}

export function useDueWords(options: UseDueWordsOptions = {}): UseDueWordsResult {
  const { level, enabled = true } = options;
  const { entries, isLoading, refresh } = useDueWordsStore();

  useEffect(() => {
    void refresh(enabled);
  }, [enabled, refresh]);

  const filteredEntries = useMemo(() => {
    const withWord = entries.filter((entry): entry is { progress: WordProgress; word: Word } => Boolean(entry.word));
    if (!level) return withWord;
    return withWord.filter(entry => entry.word.level === level);
  }, [entries, level]);

  const words = useMemo(() => filteredEntries.map(entry => entry.word), [filteredEntries]);

  return useMemo(
    () => ({ isLoading, entries, filteredEntries, words, refresh: () => refresh(enabled) }),
    [isLoading, entries, filteredEntries, words, refresh, enabled]
  );
}
