// src/stores/progressStore.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProgressStore } from './progressStore';
import { db, clearAllData } from '@/lib/db';
import { createInitialWordProgress, type Word, type WordProgress } from '@/types';
import { formatDateKey } from '@/lib/utils';

function createTestWord(id: string, partNumber: number): Word {
  return {
    id,
    source: 'system',
    sourceRef: `test:${id}`,
    wordEn: [id],
    wordTr: [`${id}-tr`],
    partOfSpeech: 'noun',
    level: 'A1',
    partNumber,
    definitionEn: `${id} definition`,
    definitionTr: `${id} tanımı`,
    examples: []
  };
}

function createMasteredProgress(wordId: string, direction: 'recognition' | 'production' = 'recognition'): WordProgress {
  const progress = createInitialWordProgress(wordId);
  progress[direction] = {
    ...progress[direction],
    correctCount: 5,
    repetitions: 5,
    mastered: true
  };
  return progress;
}

function resetStore() {
  useProgressStore.setState({
    wordProgressMap: new Map(),
    partProgressMap: new Map(),
    todayStats: null,
    dueWordsCount: 0,
    streakCount: 0,
    isLoading: true,
    hasLoaded: false
  });
}

describe('progressStore', () => {
  beforeEach(async () => {
    await clearAllData();
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads previously persisted word progress from IndexedDB', async () => {
    const wordId = 'test-word-1';
    const seed = createInitialWordProgress(wordId);
    await db.wordProgress.add(seed);

    await useProgressStore.getState().loadProgress();

    const { wordProgressMap, isLoading, hasLoaded } = useProgressStore.getState();
    expect(isLoading).toBe(false);
    expect(hasLoaded).toBe(true);
    expect(wordProgressMap.get(wordId)?.wordId).toBe(wordId);
  });

  it('keeps a failed progress load retryable without replacing the current in-memory state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const existing = createInitialWordProgress('existing-memory-word');
    useProgressStore.setState({ wordProgressMap: new Map([[existing.wordId, existing]]) });
    const toArraySpy = vi.spyOn(db.wordProgress, 'toArray').mockRejectedValueOnce(new Error('simulated progress read failure'));

    await expect(useProgressStore.getState().loadProgress()).rejects.toThrow('simulated progress read failure');
    expect(useProgressStore.getState().hasLoaded).toBe(false);
    expect(useProgressStore.getState().isLoading).toBe(false);
    expect(useProgressStore.getState().wordProgressMap.get(existing.wordId)).toBe(existing);

    toArraySpy.mockRestore();
    await useProgressStore.getState().loadProgress();
    expect(useProgressStore.getState().hasLoaded).toBe(true);
  });

  it('records a recognition review against the recognition direction only', async () => {
    const wordId = 'test-word-2';

    await useProgressStore.getState().recordQuizAnswer(wordId, 'recognition', true);

    const stored = await db.wordProgress.get(wordId);
    expect(stored).toBeDefined();
    expect(stored?.recognition.correctCount).toBe(1);
    expect(stored?.recognition.repetitions).toBe(1);
    expect(stored?.production.correctCount).toBe(0);
    expect(stored?.production.repetitions).toBe(0);
  });

  it('marks the direction mastered after five correct answers in a row', async () => {
    const wordId = 'mastery-word';

    for (let i = 0; i < 5; i++) {
      await useProgressStore.getState().recordQuizAnswer(wordId, 'production', true);
    }

    const stored = await db.wordProgress.get(wordId);
    expect(stored?.production.mastered).toBe(true);
    expect(stored?.recognition.mastered).toBe(false);
  });

  it('counts streaks across consecutive days', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const fmt = (d: Date): string => {
      const segment = d.toISOString().split('T')[0];
      if (!segment) throw new Error('unreachable');
      return segment;
    };

    await db.dailyStats.bulkAdd([
      { date: fmt(yesterday), wordsStudied: 10, correctAnswers: 8, incorrectAnswers: 2, timeSpentMinutes: 5 },
      { date: fmt(today), wordsStudied: 5, correctAnswers: 5, incorrectAnswers: 0, timeSpentMinutes: 2 }
    ]);

    await useProgressStore.getState().loadProgress();

    expect(useProgressStore.getState().streakCount).toBeGreaterThanOrEqual(2);
  });

  it('preserves every word and daily-stat update across parallel answers', async () => {
    await Promise.all([
      useProgressStore.getState().recordQuizAnswer('parallel-word-1', 'recognition', true),
      useProgressStore.getState().recordQuizAnswer('parallel-word-1', 'production', false),
      useProgressStore.getState().recordQuizAnswer('parallel-word-2', 'recognition', true)
    ]);

    const [firstWord, secondWord, dailyStats] = await Promise.all([
      db.wordProgress.get('parallel-word-1'),
      db.wordProgress.get('parallel-word-2'),
      db.dailyStats.get(formatDateKey())
    ]);

    expect(firstWord?.recognition.correctCount).toBe(1);
    expect(firstWord?.production.incorrectCount).toBe(1);
    expect(secondWord?.recognition.correctCount).toBe(1);
    expect(dailyStats?.wordsStudied).toBe(3);
    expect(dailyStats?.correctAnswers).toBe(2);
    expect(dailyStats?.incorrectAnswers).toBe(1);
  });

  it('rolls back word progress when the matching daily-stat write fails', async () => {
    vi.spyOn(db.dailyStats, 'put').mockRejectedValueOnce(new Error('simulated write failure'));

    await expect(useProgressStore.getState().recordQuizAnswer('atomic-word', 'recognition', true)).rejects.toThrow('simulated write failure');

    expect(await db.wordProgress.get('atomic-word')).toBeUndefined();
    expect(await db.dailyStats.get(formatDateKey())).toBeUndefined();
    expect(useProgressStore.getState().wordProgressMap.has('atomic-word')).toBe(false);
  });

  it('calculates part completion from every persisted word instead of a due-word subset', async () => {
    const firstWord = createTestWord('part-word-1', 1);
    const secondWord = createTestWord('part-word-2', 1);
    await db.words.bulkPut([firstWord, secondWord]);

    const firstProgress = createMasteredProgress(firstWord.id);
    const secondProgress = createInitialWordProgress(secondWord.id);
    const stalePartProgress = {
      partId: 'A1-part-1',
      level: 'A1' as const,
      partNumber: 1,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-02T00:00:00.000Z'
    };
    await db.partProgress.put(stalePartProgress);
    useProgressStore.setState({
      wordProgressMap: new Map([
        [firstWord.id, firstProgress],
        [secondWord.id, secondProgress]
      ]),
      partProgressMap: new Map([[stalePartProgress.partId, stalePartProgress]])
    });

    await useProgressStore.getState().syncPartCompletion('A1', 1, 'recognition');

    expect((await db.partProgress.get(stalePartProgress.partId))?.completedAt).toBeUndefined();
    expect(useProgressStore.getState().partProgressMap.get(stalePartProgress.partId)?.completedAt).toBeUndefined();

    const masteredSecondProgress = createMasteredProgress(secondWord.id);
    useProgressStore.setState(state => ({
      wordProgressMap: new Map(state.wordProgressMap).set(secondWord.id, masteredSecondProgress)
    }));
    await useProgressStore.getState().syncPartCompletion('A1', 1, 'recognition');

    expect((await db.partProgress.get(stalePartProgress.partId))?.completedAt).toBeDefined();
  });

  it('merges concurrent completion updates for different parts into the in-memory map', async () => {
    const firstWord = createTestWord('parallel-part-word-1', 1);
    const secondWord = createTestWord('parallel-part-word-2', 2);
    await db.words.bulkPut([firstWord, secondWord]);
    useProgressStore.setState({
      wordProgressMap: new Map([
        [firstWord.id, createMasteredProgress(firstWord.id)],
        [secondWord.id, createMasteredProgress(secondWord.id)]
      ])
    });

    await Promise.all([
      useProgressStore.getState().syncPartCompletion('A1', 1, 'recognition'),
      useProgressStore.getState().syncPartCompletion('A1', 2, 'recognition')
    ]);

    expect(useProgressStore.getState().partProgressMap.has('A1-part-1')).toBe(true);
    expect(useProgressStore.getState().partProgressMap.has('A1-part-2')).toBe(true);
    expect(await db.partProgress.get('A1-part-1')).toBeDefined();
    expect(await db.partProgress.get('A1-part-2')).toBeDefined();
  });
});
