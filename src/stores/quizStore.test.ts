// src/stores/quizStore.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { useQuizStore } from './quizStore';
import type { QuizItem, Word } from '@/types';
import { buildTestWord } from '@/test/word-fixtures';

const words: Word[] = [buildTestWord({ wordEn: ['apple'], wordTr: ['elma'] }), buildTestWord({ wordEn: ['book'], wordTr: ['kitap'] })];

describe('quizStore', () => {
  beforeEach(() => {
    useQuizStore.getState().resetQuiz();
  });

  it('initializes with the provided words', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);
    const state = useQuizStore.getState();
    expect(state.items).toHaveLength(2);
    expect(state.currentIndex).toBe(0);
    expect(state.currentDirection).toBe('recognition');
  });

  it('uses the chosen direction in production mode', () => {
    useQuizStore.getState().initQuiz(words, 'production', false, true);
    expect(useQuizStore.getState().currentDirection).toBe('production');
  });

  it('grades a correct recognition answer', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);
    useQuizStore.getState().setUserAnswer('elma');
    const result = useQuizStore.getState().submitAnswer();
    expect(result?.isCorrect).toBe(true);
    expect(useQuizStore.getState().correctCount).toBe(1);
    expect(useQuizStore.getState().phase).toBe('result');
  });

  it('grades a wrong production answer', () => {
    useQuizStore.getState().initQuiz(words, 'production', false, true);
    useQuizStore.getState().setUserAnswer('xxx');
    const result = useQuizStore.getState().submitAnswer();
    expect(result?.isCorrect).toBe(false);
    expect(useQuizStore.getState().incorrectCount).toBe(1);
  });

  it('accepts only the first submission for the current question', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);
    useQuizStore.getState().setUserAnswer('elma');

    const first = useQuizStore.getState().submitAnswer();
    const duplicate = useQuizStore.getState().submitAnswer();

    expect(first?.isCorrect).toBe(true);
    expect(duplicate).toBeNull();
    expect(useQuizStore.getState().correctCount).toBe(1);
    expect(useQuizStore.getState().incorrectCount).toBe(0);
    expect(useQuizStore.getState().phase).toBe('result');
  });

  it('counts a duplicated wrong answer only once', () => {
    useQuizStore.getState().initQuiz(words, 'production', false, true);
    useQuizStore.getState().setUserAnswer('xxx');

    useQuizStore.getState().submitAnswer();
    useQuizStore.getState().submitAnswer();

    expect(useQuizStore.getState().correctCount).toBe(0);
    expect(useQuizStore.getState().incorrectCount).toBe(1);
  });

  it('rolls back an accepted submission when persistence fails', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);
    useQuizStore.getState().setUserAnswer('elma');
    const submission = useQuizStore.getState().submitAnswer();
    if (!submission) throw new Error('Expected an accepted submission');

    useQuizStore.getState().rollbackAnswerSubmission(submission.submissionId);

    const state = useQuizStore.getState();
    expect(state.phase).toBe('question');
    expect(state.isCorrect).toBeNull();
    expect(state.correctCount).toBe(0);
    expect(state.userAnswer).toBe('elma');
  });

  it('does not let a stale failure roll back a newer quiz submission', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);
    useQuizStore.getState().setUserAnswer('elma');
    const staleSubmission = useQuizStore.getState().submitAnswer();
    if (!staleSubmission) throw new Error('Expected the first submission');

    useQuizStore.getState().resetQuiz();
    useQuizStore.getState().initQuiz([words[1] as Word], 'recognition', false, true);
    useQuizStore.getState().setUserAnswer('kitap');
    const currentSubmission = useQuizStore.getState().submitAnswer();
    if (!currentSubmission) throw new Error('Expected the second submission');

    useQuizStore.getState().rollbackAnswerSubmission(staleSubmission.submissionId);

    const state = useQuizStore.getState();
    expect(currentSubmission.submissionId).not.toBe(staleSubmission.submissionId);
    expect(state.phase).toBe('result');
    expect(state.isCorrect).toBe(true);
    expect(state.correctCount).toBe(1);
    expect(state.acceptedSubmissionId).toBe(currentSubmission.submissionId);
  });

  it('advances to the next word and signals completion at the end', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);
    useQuizStore.getState().setUserAnswer('elma');
    useQuizStore.getState().submitAnswer();

    const moved = useQuizStore.getState().nextWord();
    expect(moved).toBe(true);
    expect(useQuizStore.getState().currentIndex).toBe(1);

    useQuizStore.getState().setUserAnswer('kitap');
    useQuizStore.getState().submitAnswer();
    expect(useQuizStore.getState().isQuizComplete()).toBe(true);

    const movedAgain = useQuizStore.getState().nextWord();
    expect(movedAgain).toBe(false);
  });

  it('does not advance before the current question is answered', () => {
    useQuizStore.getState().initQuiz(words, 'recognition', false, true);

    expect(useQuizStore.getState().nextWord()).toBe(false);
    expect(useQuizStore.getState().currentIndex).toBe(0);
  });

  it('uses the exact scheduled direction for every review item', () => {
    const items: QuizItem[] = [
      { word: words[0] as Word, direction: 'production' },
      { word: words[1] as Word, direction: 'recognition' }
    ];

    useQuizStore.getState().initReviewQuiz(items, false, true);
    expect(useQuizStore.getState().currentDirection).toBe('production');

    useQuizStore.getState().setUserAnswer('apple');
    useQuizStore.getState().submitAnswer();
    useQuizStore.getState().nextWord();

    expect(useQuizStore.getState().currentDirection).toBe('recognition');
    expect(useQuizStore.getState().getCurrentWord()?.id).toBe(words[1]?.id);
  });

  it('keeps each review direction paired with its word when shuffled', () => {
    const items: QuizItem[] = [
      { word: words[0] as Word, direction: 'production' },
      { word: words[1] as Word, direction: 'recognition' }
    ];
    const expectedDirections = new Map(items.map(item => [item.word.id, item.direction]));

    useQuizStore.getState().initReviewQuiz(items, true, true);

    for (const item of useQuizStore.getState().items) {
      expect(item.direction).toBe(expectedDirections.get(item.word.id));
    }
  });
});
