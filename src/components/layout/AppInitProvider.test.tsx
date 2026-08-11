// src/components/layout/AppInitProvider.test.tsx

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppInitProvider } from './AppInitProvider';
import { useProgressStore, useSettingsStore } from '@/stores';

const seedMocks = vi.hoisted(() => ({
  isSeedNeeded: vi.fn(),
  loadWordsPayload: vi.fn(),
  performSeed: vi.fn()
}));

vi.mock('@/lib/seed', () => seedMocks);
vi.mock('@/data/words.json?url', () => ({ default: '/test-words.json' }));
vi.mock('virtual:words-manifest', () => ({
  default: {
    schemaVersion: 1,
    hashAlgorithm: 'djb2-v1',
    contentHash: '12345678',
    counts: { words: 1, examples: 10, levels: {} }
  }
}));

const originalHydrateSettings = useSettingsStore.getState().hydrateFromIndexedDB;
const originalLoadProgress = useProgressStore.getState().loadProgress;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderProvider() {
  return render(
    <AppInitProvider>
      <div>Application ready</div>
    </AppInitProvider>
  );
}

describe('AppInitProvider', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    seedMocks.isSeedNeeded.mockReset();
    seedMocks.loadWordsPayload.mockReset();
    seedMocks.performSeed.mockReset();
    seedMocks.isSeedNeeded.mockResolvedValue(false);
    seedMocks.loadWordsPayload.mockResolvedValue({ manifest: {}, words: [] });
    seedMocks.performSeed.mockResolvedValue(undefined);
    useSettingsStore.setState({ hydrateFromIndexedDB: vi.fn().mockResolvedValue(undefined) });
    useProgressStore.setState({ loadProgress: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    act(() => {
      useSettingsStore.setState({ hydrateFromIndexedDB: originalHydrateSettings });
      useProgressStore.setState({ loadProgress: originalLoadProgress });
    });
  });

  it('runs the no-seed startup steps in order before rendering the app', async () => {
    const calls: string[] = [];
    useSettingsStore.setState({ hydrateFromIndexedDB: vi.fn(async () => void calls.push('settings')) });
    seedMocks.isSeedNeeded.mockImplementation(async () => {
      calls.push('seed-check');
      return false;
    });
    useProgressStore.setState({ loadProgress: vi.fn(async () => void calls.push('progress')) });

    renderProvider();

    expect(await screen.findByText('Application ready')).toBeInTheDocument();
    expect(calls).toEqual(['settings', 'seed-check', 'progress']);
    expect(seedMocks.loadWordsPayload).not.toHaveBeenCalled();
    expect(seedMocks.performSeed).not.toHaveBeenCalled();
  });

  it('writes the seed before loading progress when bundled words changed', async () => {
    const calls: string[] = [];
    useSettingsStore.setState({ hydrateFromIndexedDB: vi.fn(async () => void calls.push('settings')) });
    seedMocks.isSeedNeeded.mockImplementation(async () => {
      calls.push('seed-check');
      return true;
    });
    seedMocks.loadWordsPayload.mockImplementation(async () => {
      calls.push('seed-download');
      return { manifest: {}, words: [] };
    });
    seedMocks.performSeed.mockImplementation(async () => void calls.push('seed-write'));
    useProgressStore.setState({ loadProgress: vi.fn(async () => void calls.push('progress')) });

    renderProvider();

    expect(await screen.findByText('Application ready')).toBeInTheDocument();
    expect(calls).toEqual(['settings', 'seed-check', 'seed-download', 'seed-write', 'progress']);
  });

  it('shows a recoverable error when the seed check fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    seedMocks.isSeedNeeded.mockRejectedValueOnce(new Error('seed check failed'));
    const loadProgress = vi.fn().mockResolvedValue(undefined);
    useProgressStore.setState({ loadProgress });

    renderProvider();

    expect(await screen.findByRole('alert')).toHaveTextContent("Learnglish couldn't start");
    expect(screen.getByText('The local vocabulary database could not be checked.')).toBeInTheDocument();
    expect(screen.queryByText('Application ready')).not.toBeInTheDocument();
    expect(loadProgress).not.toHaveBeenCalled();
  });

  it('retries settings hydration after a transient read failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hydrateSettings = vi.fn().mockRejectedValueOnce(new Error('settings read failed')).mockResolvedValueOnce(undefined);
    useSettingsStore.setState({ hydrateFromIndexedDB: hydrateSettings });

    renderProvider();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your local settings could not be read.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Application ready')).toBeInTheDocument();
    expect(hydrateSettings).toHaveBeenCalledTimes(2);
  });

  it('does not continue to progress when the seed write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    seedMocks.isSeedNeeded.mockResolvedValueOnce(true);
    seedMocks.performSeed.mockRejectedValueOnce(new Error('seed write failed'));
    const loadProgress = vi.fn().mockResolvedValue(undefined);
    useProgressStore.setState({ loadProgress });

    renderProvider();

    expect(await screen.findByRole('alert')).toHaveTextContent('The local vocabulary database could not be prepared.');
    expect(loadProgress).not.toHaveBeenCalled();
  });

  it('fails closed when the changed vocabulary cannot be downloaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    seedMocks.isSeedNeeded.mockResolvedValueOnce(true);
    seedMocks.loadWordsPayload.mockRejectedValueOnce(new Error('download failed'));
    const loadProgress = vi.fn().mockResolvedValue(undefined);
    useProgressStore.setState({ loadProgress });

    renderProvider();

    expect(await screen.findByRole('alert')).toHaveTextContent('The local vocabulary database could not be prepared.');
    expect(seedMocks.performSeed).not.toHaveBeenCalled();
    expect(loadProgress).not.toHaveBeenCalled();
  });

  it('fails closed when saved progress cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useProgressStore.setState({ loadProgress: vi.fn().mockRejectedValue(new Error('progress read failed')) });

    renderProvider();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your saved learning progress could not be read.');
    expect(screen.queryByText('Application ready')).not.toBeInTheDocument();
  });

  it('retries the full pipeline after a transient failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    seedMocks.isSeedNeeded.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(false);

    renderProvider();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Application ready')).toBeInTheDocument();
    expect(seedMocks.isSeedNeeded).toHaveBeenCalledTimes(2);
    expect(useProgressStore.getState().loadProgress).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale failure after the provider unmounts', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deferred = createDeferred<void>();
    useSettingsStore.setState({ hydrateFromIndexedDB: vi.fn(() => deferred.promise) });
    const view = renderProvider();

    view.unmount();
    await act(async () => {
      deferred.reject(new Error('late failure'));
      await deferred.promise.catch(() => undefined);
    });

    await waitFor(() => expect(errorSpy).not.toHaveBeenCalled());
  });

  it('does not continue startup when settings finish after unmount', async () => {
    const deferred = createDeferred<void>();
    useSettingsStore.setState({ hydrateFromIndexedDB: vi.fn(() => deferred.promise) });
    const view = renderProvider();

    view.unmount();
    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(seedMocks.isSeedNeeded).not.toHaveBeenCalled();
    expect(useProgressStore.getState().loadProgress).not.toHaveBeenCalled();
  });

  it('advances the seed and progress pipeline once in StrictMode', async () => {
    seedMocks.isSeedNeeded.mockResolvedValue(true);

    render(
      <StrictMode>
        <AppInitProvider>
          <div>Application ready</div>
        </AppInitProvider>
      </StrictMode>
    );

    expect(await screen.findByText('Application ready')).toBeInTheDocument();
    expect(seedMocks.isSeedNeeded).toHaveBeenCalledTimes(1);
    expect(seedMocks.loadWordsPayload).toHaveBeenCalledTimes(1);
    expect(seedMocks.performSeed).toHaveBeenCalledTimes(1);
    expect(useProgressStore.getState().loadProgress).toHaveBeenCalledTimes(1);
  });
});
