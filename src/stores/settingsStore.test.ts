// src/stores/settingsStore.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { clearAllData, db } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/types';

describe('settingsStore', () => {
  beforeEach(async () => {
    await clearAllData();
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, hasHydrated: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps hydration retryable after an IndexedDB read failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const getSpy = vi.spyOn(db.settings, 'get').mockRejectedValueOnce(new Error('simulated settings read failure'));

    await expect(useSettingsStore.getState().hydrateFromIndexedDB()).rejects.toThrow('simulated settings read failure');
    expect(useSettingsStore.getState().hasHydrated).toBe(false);

    getSpy.mockRestore();
    await useSettingsStore.getState().hydrateFromIndexedDB();
    expect(useSettingsStore.getState().hasHydrated).toBe(true);
  });
});
