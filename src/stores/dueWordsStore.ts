// src/stores/dueWordsStore.ts

import { create } from 'zustand';
import type { Word, WordProgress } from '@/types';
import { db, getDueWords } from '@/lib/db';
import { useProgressStore } from './progressStore';

export interface DueWordEntry {
  progress: WordProgress;
  word: Word | undefined;
}

interface DueWordsState {
  isLoading: boolean;
  entries: DueWordEntry[];
  refresh: (enabled?: boolean) => Promise<void>;
}

export const useDueWordsStore = create<DueWordsState>(set => ({
  isLoading: true,
  entries: [],
  refresh: async (enabled = true) => {
    if (!enabled) {
      set({ entries: [], isLoading: false });
      return;
    }
    set({ isLoading: true });
    const progressList = await getDueWords();
    const ids = progressList.map(p => p.wordId);
    // Single batched DB call instead of N independent gets.
    const words = await db.words.bulkGet(ids);
    const entries: DueWordEntry[] = progressList.map((progress, index) => ({
      progress,
      word: words[index] ?? undefined
    }));
    set({ entries, isLoading: false });
    useProgressStore.getState().refreshDueWordsCount();
  }
}));
