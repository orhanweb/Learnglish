// src/hooks/useScrollLock.ts

import { useLayoutEffect } from 'react';

// Global state to track lock count and original styles across multiple components
let lockCount = 0;
let originalStyle: {
  overflow: string;
  position: string;
  top: string;
  width: string;
} | null = null;
let savedScrollY = 0;

/**
 * A custom hook that locks the body scroll when the `isLocked` condition is true.
 * Uses a global reference counting mechanism to handle nested locks safely.
 * Implements iOS-specific scroll locking strategy (position: fixed) to prevent
 * rubber-banding and background scrolling.
 */
export function useScrollLock(isLocked: boolean) {
  useLayoutEffect(() => {
    if (!isLocked) return;

    lockCount++;

    if (lockCount === 1) {
      // First lock: Capture current state and apply lock
      savedScrollY = window.scrollY;

      originalStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width
      };

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = '100%';
    }

    return () => {
      lockCount--;

      if (lockCount === 0 && originalStyle) {
        // Last unlock: Restore original state
        document.body.style.overflow = originalStyle.overflow;
        document.body.style.position = originalStyle.position;
        document.body.style.top = originalStyle.top;
        document.body.style.width = originalStyle.width;

        // Restore scroll position immediately
        window.scrollTo(0, savedScrollY);

        // Reset global state
        originalStyle = null;
        savedScrollY = 0;
      }
    };
  }, [isLocked]);
}
