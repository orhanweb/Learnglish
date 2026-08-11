// src/stores/settingsStore.ts

import { create } from 'zustand';
import type { UserSettings, Theme, QuizMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { db } from '@/lib/db';

const SETTINGS_ID = 1;

interface SettingsState extends UserSettings {
  hasHydrated: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  setQuizMode: (mode: QuizMode) => Promise<void>;
  setShuffleQuizOrder: (shuffle: boolean) => Promise<void>;
  setTolerateTypos: (tolerate: boolean) => Promise<void>;
  setShowTranslationsAlways: (show: boolean) => Promise<void>;
  resetSettings: () => Promise<void>;
  /** Loads persisted settings from IndexedDB. Idempotent. */
  hydrateFromIndexedDB: () => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;

async function persist(state: UserSettings): Promise<void> {
  await db.settings.put({ ...state, id: SETTINGS_ID });
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const update = async (patch: Partial<UserSettings>) => {
    set(patch);
    const next: UserSettings = {
      quizMode: get().quizMode,
      shuffleQuizOrder: get().shuffleQuizOrder,
      tolerateTypos: get().tolerateTypos,
      showTranslationsAlways: get().showTranslationsAlways,
      theme: get().theme
    };
    await persist(next);
  };

  return {
    ...DEFAULT_SETTINGS,
    hasHydrated: false,

    setTheme: theme => update({ theme }),
    setQuizMode: quizMode => update({ quizMode }),
    setShuffleQuizOrder: shuffleQuizOrder => update({ shuffleQuizOrder }),
    setTolerateTypos: tolerateTypos => update({ tolerateTypos }),
    setShowTranslationsAlways: showTranslationsAlways => update({ showTranslationsAlways }),

    resetSettings: async () => {
      set({ ...DEFAULT_SETTINGS });
      await persist(DEFAULT_SETTINGS);
    },

    hydrateFromIndexedDB: () => {
      if (get().hasHydrated) return Promise.resolve();
      if (hydrationPromise) return hydrationPromise;
      hydrationPromise = (async () => {
        try {
          const stored = await db.settings.get(SETTINGS_ID);
          if (stored) {
            set({ ...DEFAULT_SETTINGS, ...stored, hasHydrated: true });
          } else {
            set({ hasHydrated: true });
          }
        } catch (error) {
          console.error('Failed to hydrate settings:', error);
          set({ hasHydrated: false });
          throw error;
        } finally {
          hydrationPromise = null;
        }
      })();
      return hydrationPromise;
    }
  };
});
