// src/lib/level-variants.ts

import type { Level } from '@/types';

export type LevelVariant = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

export const levelVariants: Record<Level, LevelVariant> = {
  A1: 'a1',
  A2: 'a2',
  B1: 'b1',
  B2: 'b2',
  C1: 'c1'
};
