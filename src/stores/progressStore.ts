// src/stores/progressStore.ts

import { create } from 'zustand';
import type { DailyStats, DirectionProgress, Level, PartProgress, QuizDirection, QuizMode, WordProgress } from '@/types';
import { createInitialWordProgress, computeNextDueAt } from '@/types';
import { db } from '@/lib/db';
import { calculateNextReview, calculatePartCompletion, evaluateDirectionMastery, getQualityFromResult } from '@/lib/spaced-repetition';
import { formatDateKey, generatePartId } from '@/lib/utils';

interface ProgressState {
  wordProgressMap: Map<string, WordProgress>;
  partProgressMap: Map<string, PartProgress>;
  todayStats: DailyStats | null;
  dueWordsCount: number;
  streakCount: number;
  isLoading: boolean;
  hasLoaded: boolean;

  /** Loads everything from IndexedDB into memory. Idempotent; subsequent calls re-fetch. */
  loadProgress: () => Promise<void>;
  /** Loads only if not previously loaded (cheap to call from any page mount). */
  ensureLoaded: () => Promise<void>;
  getWordProgress: (wordId: string) => WordProgress | undefined;
  recordQuizAnswer: (wordId: string, direction: QuizDirection, isCorrect: boolean) => Promise<WordProgress>;
  getPartProgress: (partId: string) => PartProgress | undefined;
  syncPartCompletion: (level: Level, partNumber: number, mode: QuizMode) => Promise<void>;
  refreshDueWordsCount: () => void;
  getTodayStats: () => DailyStats;
}

const createEmptyDailyStats = (date: string): DailyStats => ({
  date,
  wordsStudied: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  timeSpentMinutes: 0
});

/** Counts consecutive days with wordsStudied > 0, ending today (or yesterday if today is empty). */
async function calculateStreak(): Promise<number> {
  const allStats = await db.dailyStats.orderBy('date').reverse().toArray();
  if (allStats.length === 0) return 0;

  const statsMap = new Map(allStats.map(s => [s.date, s]));
  const now = new Date();
  const todayKey = formatDateKey(now);
  const todayActive = (statsMap.get(todayKey)?.wordsStudied ?? 0) > 0;

  let streak = todayActive ? 1 : 0;

  for (let i = 1; ; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() - i);
    const key = formatDateKey(checkDate);
    if ((statsMap.get(key)?.wordsStudied ?? 0) > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function countDueLocally(wordProgressMap: Map<string, WordProgress>): number {
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const progress of wordProgressMap.values()) {
    if (progress.nextDueAt <= nowIso) count += 1;
  }
  return count;
}

/** Applies a single review result to one direction of a word, returning the updated row. */
function applyReview(progress: WordProgress, direction: QuizDirection, isCorrect: boolean): WordProgress {
  const dirKey = direction;
  const dir = progress[dirKey];

  const updatedCounts: DirectionProgress = {
    ...dir,
    correctCount: dir.correctCount + (isCorrect ? 1 : 0),
    incorrectCount: dir.incorrectCount + (isCorrect ? 0 : 1)
  };

  const sr = calculateNextReview(updatedCounts, getQualityFromResult(isCorrect));
  const updatedDirection: DirectionProgress = {
    ...updatedCounts,
    ...sr,
    mastered: evaluateDirectionMastery(updatedCounts)
  };

  const nowIso = new Date().toISOString();
  const next: WordProgress = {
    ...progress,
    [dirKey]: updatedDirection,
    lastReviewedAt: nowIso,
    nextDueAt: ''
  };
  next.nextDueAt = computeNextDueAt(next);
  return next;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  wordProgressMap: new Map(),
  partProgressMap: new Map(),
  todayStats: null,
  dueWordsCount: 0,
  streakCount: 0,
  isLoading: true,
  hasLoaded: false,

  loadProgress: async () => {
    set({ isLoading: true });

    try {
      const [wordProgressList, partProgressList, streakCount] = await Promise.all([
        db.wordProgress.toArray(),
        db.partProgress.toArray(),
        calculateStreak()
      ]);

      const wordProgressMap = new Map<string, WordProgress>(wordProgressList.map(wp => [wp.wordId, wp]));
      const partProgressMap = new Map<string, PartProgress>(partProgressList.map(pp => [pp.partId, pp]));

      const today = formatDateKey();
      const todayStats = (await db.dailyStats.get(today)) ?? createEmptyDailyStats(today);

      set({
        wordProgressMap,
        partProgressMap,
        todayStats,
        dueWordsCount: countDueLocally(wordProgressMap),
        streakCount,
        isLoading: false,
        hasLoaded: true
      });
    } catch (error) {
      console.error('Failed to load progress:', error);
      set({ isLoading: false, hasLoaded: false });
      throw error;
    }
  },

  ensureLoaded: async () => {
    if (get().hasLoaded) return;
    await get().loadProgress();
  },

  getWordProgress: wordId => get().wordProgressMap.get(wordId),

  recordQuizAnswer: async (wordId, direction, isCorrect) => {
    const today = formatDateKey();
    const result = await db.transaction('rw', [db.wordProgress, db.dailyStats], async () => {
      const [storedProgress, storedStats] = await Promise.all([db.wordProgress.get(wordId), db.dailyStats.get(today)]);
      const progress = applyReview(storedProgress ?? createInitialWordProgress(wordId), direction, isCorrect);
      const baseStats = storedStats ?? createEmptyDailyStats(today);
      const isFirstStudyOfDay = baseStats.wordsStudied === 0;
      const stats: DailyStats = {
        ...baseStats,
        wordsStudied: baseStats.wordsStudied + 1,
        correctAnswers: baseStats.correctAnswers + (isCorrect ? 1 : 0),
        incorrectAnswers: baseStats.incorrectAnswers + (isCorrect ? 0 : 1)
      };

      await Promise.all([db.wordProgress.put(progress), db.dailyStats.put(stats)]);
      return { progress, stats, isFirstStudyOfDay };
    });

    set(state => {
      const wordProgressMap = new Map(state.wordProgressMap);
      wordProgressMap.set(wordId, result.progress);
      return {
        wordProgressMap,
        dueWordsCount: countDueLocally(wordProgressMap),
        todayStats: result.stats,
        streakCount: result.isFirstStudyOfDay ? state.streakCount + 1 : state.streakCount
      };
    });

    return result.progress;
  },

  getPartProgress: partId => get().partProgressMap.get(partId),

  syncPartCompletion: async (level, partNumber, mode) => {
    const partId = generatePartId(level, partNumber);
    const words = await db.words.where({ level, partNumber }).toArray();
    if (words.length === 0) return;

    const { wordProgressMap, partProgressMap } = get();
    const completion = calculatePartCompletion(words, wordProgressMap, mode);
    const existing = partProgressMap.get(partId);

    const startedAt = existing?.startedAt ?? new Date().toISOString();
    const completedAt = completion.isCompleted ? (existing?.completedAt ?? new Date().toISOString()) : undefined;

    if (existing && existing.startedAt === startedAt && existing.completedAt === completedAt) return;

    const updated: PartProgress =
      completedAt !== undefined ? { partId, level, partNumber, startedAt, completedAt } : { partId, level, partNumber, startedAt };

    await db.partProgress.put(updated);

    set(state => {
      const partProgressMap = new Map(state.partProgressMap);
      partProgressMap.set(partId, updated);
      return { partProgressMap };
    });
  },

  refreshDueWordsCount: () => {
    set({ dueWordsCount: countDueLocally(get().wordProgressMap) });
  },

  getTodayStats: () => {
    const { todayStats } = get();
    return todayStats ?? createEmptyDailyStats(formatDateKey());
  }
}));
