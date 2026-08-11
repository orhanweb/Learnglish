// src/components/layout/AppInitProvider.tsx

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LoadingState } from '@/components/ui';
import { useProgressStore, useSettingsStore } from '@/stores';
import { isSeedNeeded, loadWordsPayload, performSeed } from '@/lib/seed';
import wordsPayloadUrl from '@/data/words.json?url';
import wordsManifest from 'virtual:words-manifest';
import { AppInitError, type AppInitStep } from './AppInitError';

type InitState =
  | { status: 'running'; step: AppInitStep; attempt: number }
  | { status: 'failed'; step: AppInitStep; attempt: number }
  | { status: 'ready'; attempt: number };

const PHASE_MESSAGES: Record<AppInitStep, string[]> = {
  settings: ['Loading your settings...'],
  'seeding-check': ['Checking for word updates...'],
  seeding: ['Preparing words...', 'This only happens once.'],
  progress: ['Loading your progress...']
};

interface AppInitProviderProps {
  children: ReactNode;
}

/**
 * Bootstraps the application in a deterministic order:
 *  1) Hydrate user settings (so UI mode/theme are correct from first paint).
 *  2) Seed bundled word data into IndexedDB if changed.
 *  3) Load user progress (word + part + daily stats + streak).
 *
 * Pages do NOT need to call loadProgress() themselves; this provider guarantees it.
 */
export function AppInitProvider({ children }: AppInitProviderProps) {
  const hydrateSettings = useSettingsStore(state => state.hydrateFromIndexedDB);
  const loadProgress = useProgressStore(state => state.loadProgress);
  const [attempt, setAttempt] = useState(1);
  const [initState, setInitState] = useState<InitState>({ status: 'running', step: 'settings', attempt: 1 });
  const runTokenRef = useRef(0);
  const retryLockRef = useRef(false);

  useEffect(() => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    const abortController = new AbortController();
    let cancelled = false;
    let currentStep: AppInitStep = 'settings';
    retryLockRef.current = true;

    const isCurrent = () => !cancelled && runTokenRef.current === runToken;
    const setRunningStep = (step: AppInitStep) => {
      currentStep = step;
      if (isCurrent()) setInitState({ status: 'running', step, attempt });
    };

    async function run() {
      try {
        setRunningStep('settings');
        await hydrateSettings();
        if (!isCurrent()) return;

        setRunningStep('seeding-check');
        const needed = await isSeedNeeded(wordsManifest);
        if (!isCurrent()) return;

        if (needed) {
          setRunningStep('seeding');
          const wordsData = await loadWordsPayload(wordsPayloadUrl, abortController.signal);
          if (!isCurrent()) return;
          await performSeed(wordsData);
          if (!isCurrent()) return;
        }

        setRunningStep('progress');
        await loadProgress();
        if (!isCurrent()) return;

        setInitState({ status: 'ready', attempt });
      } catch (error) {
        if (!isCurrent()) return;
        console.error(`Application initialization failed during ${currentStep}:`, error);
        retryLockRef.current = false;
        setInitState({ status: 'failed', step: currentStep, attempt });
      }
    }

    void run();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [attempt, hydrateSettings, loadProgress]);

  const handleRetry = () => {
    if (initState.status !== 'failed' || retryLockRef.current) return;
    retryLockRef.current = true;
    const nextAttempt = initState.attempt + 1;
    setInitState({ status: 'running', step: 'settings', attempt: nextAttempt });
    setAttempt(nextAttempt);
  };

  if (initState.status === 'failed') {
    return <AppInitError failedStep={initState.step} onRetry={handleRetry} onReload={() => window.location.reload()} />;
  }

  if (initState.status === 'running') {
    return <LoadingState messages={PHASE_MESSAGES[initState.step]} />;
  }

  return <>{children}</>;
}
