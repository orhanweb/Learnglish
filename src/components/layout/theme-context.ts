// src/components/layout/theme-context.ts

import { createContext } from 'react';
import type { Theme } from '@/types';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
