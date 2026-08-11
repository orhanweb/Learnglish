// src/components/quiz/QuizSession.test.tsx

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSession } from './QuizSession';
import { useProgressStore, useQuizStore, useSettingsStore } from '@/stores';
import { createInitialWordProgress, type WordProgress } from '@/types';
import { buildTestWord } from '@/test/word-fixtures';

const word = buildTestWord({ wordEn: ['apple'], wordTr: ['elma'] });
const originalRecordQuizAnswer = useProgressStore.getState().recordQuizAnswer;
const originalSubmitAnswer = useQuizStore.getState().submitAnswer;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderQuiz(recordQuizAnswer: (wordId: string, direction: 'recognition' | 'production', isCorrect: boolean) => Promise<WordProgress>) {
  const onAfterAnswer = vi.fn();
  useProgressStore.setState({ recordQuizAnswer });

  const router = createMemoryRouter(
    [
      { path: '/', element: <QuizSession words={[word]} exitTo="/exit" onAfterAnswer={onAfterAnswer} /> },
      { path: '/exit', element: <div>Exited</div> }
    ],
    { initialEntries: ['/'] }
  );

  const view = render(<RouterProvider router={router} />);
  return { ...view, onAfterAnswer };
}

describe('QuizSession answer persistence', () => {
  beforeEach(() => {
    useQuizStore.getState().resetQuiz();
    useProgressStore.setState({ recordQuizAnswer: originalRecordQuizAnswer });
    useSettingsStore.setState({
      quizMode: 'recognition',
      shuffleQuizOrder: false,
      tolerateTypos: false,
      showTranslationsAlways: false,
      theme: 'system'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useProgressStore.setState({ recordQuizAnswer: originalRecordQuizAnswer });
      useQuizStore.setState({ submitAnswer: originalSubmitAnswer });
      useQuizStore.getState().resetQuiz();
    });
  });

  it('persists only once after two immediate clicks and blocks navigation until saving finishes', async () => {
    const deferred = createDeferred<WordProgress>();
    const recordQuizAnswer = vi.fn(() => deferred.promise);
    const { onAfterAnswer } = renderQuiz(recordQuizAnswer);
    const input = await screen.findByPlaceholderText('Write Turkish meaning...');
    fireEvent.change(input, { target: { value: 'elma' } });
    const submitButton = screen.getByRole('button', { name: 'Check Answer' });

    act(() => {
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
    });

    expect(recordQuizAnswer).toHaveBeenCalledTimes(1);
    expect(recordQuizAnswer).toHaveBeenCalledWith(word.id, 'recognition', true);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(onAfterAnswer).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(createInitialWordProgress(word.id));
      await deferred.promise;
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'View Results' })).toBeEnabled());
    expect(onAfterAnswer).toHaveBeenCalledTimes(1);
  });

  it('persists only once after two immediate Enter events', async () => {
    const deferred = createDeferred<WordProgress>();
    const recordQuizAnswer = vi.fn(() => deferred.promise);
    renderQuiz(recordQuizAnswer);
    const input = await screen.findByPlaceholderText('Write Turkish meaning...');
    fireEvent.change(input, { target: { value: 'elma' } });

    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(recordQuizAnswer).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(createInitialWordProgress(word.id));
      await deferred.promise;
    });
  });

  it('retries cleanly without counting a failed persistence attempt', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recordQuizAnswer = vi
      .fn()
      .mockRejectedValueOnce(new Error('simulated persistence failure'))
      .mockResolvedValueOnce(createInitialWordProgress(word.id));
    const { onAfterAnswer } = renderQuiz(recordQuizAnswer);
    const input = await screen.findByPlaceholderText('Write Turkish meaning...');
    fireEvent.change(input, { target: { value: 'elma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your answer could not be saved. Please try again.');
    expect(screen.getByPlaceholderText('Write Turkish meaning...')).toHaveValue('elma');
    expect(useQuizStore.getState().correctCount).toBe(0);
    expect(useQuizStore.getState().phase).toBe('question');

    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'View Results' })).toBeEnabled());
    expect(recordQuizAnswer).toHaveBeenCalledTimes(2);
    expect(useQuizStore.getState().correctCount).toBe(1);
    expect(onAfterAnswer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('does not let an old failed save roll back a newer quiz result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const staleSave = createDeferred<WordProgress>();
    const firstView = renderQuiz(vi.fn(() => staleSave.promise));
    const firstInput = await screen.findByPlaceholderText('Write Turkish meaning...');
    fireEvent.change(firstInput, { target: { value: 'elma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    firstView.unmount();
    useQuizStore.getState().resetQuiz();

    renderQuiz(vi.fn(() => Promise.resolve(createInitialWordProgress(word.id))));
    const secondInput = await screen.findByPlaceholderText('Write Turkish meaning...');
    fireEvent.change(secondInput, { target: { value: 'elma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'View Results' })).toBeEnabled());

    await act(async () => {
      staleSave.reject(new Error('stale save failure'));
      await staleSave.promise.catch(() => undefined);
    });

    await waitFor(() => expect(useQuizStore.getState().phase).toBe('result'));
    expect(useQuizStore.getState().correctCount).toBe(1);
    expect(screen.getByText('Correct!')).toBeInTheDocument();
  });

  it('releases the submission lock after an unexpected synchronous error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const throwingSubmit = vi.fn(() => {
      throw new Error('simulated validation failure');
    });
    useQuizStore.setState({ submitAnswer: throwingSubmit });
    renderQuiz(vi.fn(() => Promise.resolve(createInitialWordProgress(word.id))));
    const input = await screen.findByPlaceholderText('Write Turkish meaning...');
    fireEvent.change(input, { target: { value: 'elma' } });

    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    expect(throwingSubmit).toHaveBeenCalledTimes(2);
  });
});
