// src/stores/quizStore.ts

import { create } from 'zustand';
import type { QuizDirection, QuizItem, QuizMode, Word } from '@/types';
import { shuffleArray } from '@/lib/utils';
import { validateAnswer, validateProductionAnswer } from '@/lib/answer-validation';

type QuizPhase = 'question' | 'result';

export interface QuizSubmissionResult {
  submissionId: number;
  word: Word;
  direction: QuizDirection;
  isCorrect: boolean;
  matchedMeaning: string | null;
}

interface QuizState {
  // Configuration
  items: QuizItem[];
  mode: QuizMode;
  tolerateTypos: boolean;

  // Per-question runtime
  currentIndex: number;
  currentDirection: QuizDirection;
  phase: QuizPhase;
  userAnswer: string;
  isCorrect: boolean | null;
  matchedMeaning: string | null;
  showComplete: boolean;

  // Aggregates
  correctCount: number;
  incorrectCount: number;
  submissionSequence: number;
  acceptedSubmissionId: number | null;

  // Actions
  initQuiz: (words: Word[], mode: QuizMode, shuffle: boolean, tolerateTypos: boolean) => void;
  initReviewQuiz: (items: QuizItem[], shuffle: boolean, tolerateTypos: boolean) => void;
  setShowComplete: (showComplete: boolean) => void;
  setUserAnswer: (answer: string) => void;
  submitAnswer: () => QuizSubmissionResult | null;
  rollbackAnswerSubmission: (submissionId: number) => void;
  nextWord: () => boolean;
  resetQuiz: () => void;

  // Getters
  getCurrentWord: () => Word | null;
  getProgress: () => { current: number; total: number };
  isQuizComplete: () => boolean;
}

const initialState = {
  items: [] as QuizItem[],
  mode: 'mixed' as QuizMode,
  tolerateTypos: true,
  currentIndex: 0,
  currentDirection: 'recognition' as QuizDirection,
  phase: 'question' as QuizPhase,
  userAnswer: '',
  isCorrect: null as boolean | null,
  matchedMeaning: null as string | null,
  showComplete: false,
  correctCount: 0,
  incorrectCount: 0,
  submissionSequence: 0,
  acceptedSubmissionId: null as number | null
};

/** Picks the direction for a single question based on the active quiz mode. */
function pickDirection(mode: QuizMode): QuizDirection {
  if (mode === 'mixed') return Math.random() > 0.5 ? 'recognition' : 'production';
  return mode;
}

function orderItems(items: QuizItem[], shuffle: boolean): QuizItem[] {
  return shuffle ? shuffleArray(items) : [...items];
}

export const useQuizStore = create<QuizState>((set, get) => ({
  ...initialState,

  initQuiz: (words, mode, shuffle, tolerateTypos) => {
    const orderedItems = orderItems(
      words.map(word => ({ word, direction: pickDirection(mode) })),
      shuffle
    );
    set(state => ({
      ...initialState,
      submissionSequence: state.submissionSequence,
      items: orderedItems,
      mode,
      tolerateTypos,
      currentDirection: orderedItems[0]?.direction ?? 'recognition'
    }));
  },

  initReviewQuiz: (items, shuffle, tolerateTypos) => {
    const orderedItems = orderItems(items, shuffle);
    set(state => ({
      ...initialState,
      submissionSequence: state.submissionSequence,
      items: orderedItems,
      mode: 'mixed',
      tolerateTypos,
      currentDirection: orderedItems[0]?.direction ?? 'recognition'
    }));
  },

  setShowComplete: showComplete => set({ showComplete }),

  setUserAnswer: answer => set({ userAnswer: answer }),

  submitAnswer: () => {
    const { items, currentIndex, currentDirection, phase, userAnswer, tolerateTypos, submissionSequence } = get();
    const word = items[currentIndex]?.word;

    if (phase !== 'question' || !word || !userAnswer.trim()) return null;

    const result =
      currentDirection === 'recognition'
        ? validateAnswer(userAnswer, word, tolerateTypos)
        : validateProductionAnswer(userAnswer, word, tolerateTypos);

    const submissionId = submissionSequence + 1;
    set(state => ({
      phase: 'result',
      isCorrect: result.isCorrect,
      matchedMeaning: result.matchedMeaning ?? null,
      correctCount: state.correctCount + (result.isCorrect ? 1 : 0),
      incorrectCount: state.incorrectCount + (result.isCorrect ? 0 : 1),
      submissionSequence: submissionId,
      acceptedSubmissionId: submissionId
    }));

    return {
      submissionId,
      word,
      direction: currentDirection,
      isCorrect: result.isCorrect,
      matchedMeaning: result.matchedMeaning ?? null
    };
  },

  rollbackAnswerSubmission: submissionId => {
    const { phase, isCorrect, acceptedSubmissionId } = get();
    if (phase !== 'result' || isCorrect === null || acceptedSubmissionId !== submissionId) return;

    set(state => ({
      phase: 'question',
      isCorrect: null,
      matchedMeaning: null,
      acceptedSubmissionId: null,
      correctCount: Math.max(0, state.correctCount - (isCorrect ? 1 : 0)),
      incorrectCount: Math.max(0, state.incorrectCount - (isCorrect ? 0 : 1))
    }));
  },

  nextWord: () => {
    const { currentIndex, items, phase } = get();
    if (phase !== 'result') return false;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= items.length) return false;

    set({
      currentIndex: nextIndex,
      currentDirection: items[nextIndex]?.direction ?? 'recognition',
      phase: 'question',
      userAnswer: '',
      isCorrect: null,
      matchedMeaning: null,
      acceptedSubmissionId: null
    });

    return true;
  },

  resetQuiz: () => set(state => ({ ...initialState, submissionSequence: state.submissionSequence })),

  getCurrentWord: () => {
    const { items, currentIndex } = get();
    return items[currentIndex]?.word ?? null;
  },

  getProgress: () => {
    const { currentIndex, items } = get();
    return { current: currentIndex + 1, total: items.length };
  },

  isQuizComplete: () => {
    const { currentIndex, items, phase } = get();
    return phase === 'result' && currentIndex >= items.length - 1;
  }
}));
