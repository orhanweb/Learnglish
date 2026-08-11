// src/components/layout/ThemeProvider.tsx

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Theme } from '@/types';
import { useSettingsStore } from '@/stores';
import { ThemeContext } from './theme-context';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Applies the theme class to <html>. Reads theme from settings store; assumes
 * settings have been hydrated by AppInitProvider before any UI is rendered.
 */
function getInitialResolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, setTheme } = useSettingsStore();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getInitialResolvedTheme(theme));

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (newTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (event: MediaQueryListEvent) => applyTheme(event.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    applyTheme(theme);
  }, [theme]);

  const handleSetTheme = useCallback(
    (next: Theme) => {
      void setTheme(next);
    },
    [setTheme]
  );

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme: handleSetTheme }), [theme, resolvedTheme, handleSetTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
