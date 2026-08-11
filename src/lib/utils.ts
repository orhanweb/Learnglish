// src/lib/utils.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind CSS merge support.
 * Handles conditional classes and resolves Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date to local date string (YYYY-MM-DD).
 * Uses local timezone to avoid UTC offset issues.
 */
export function formatDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates days between two dates.
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * Fisher-Yates shuffle algorithm for randomizing arrays.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}

/**
 * Generates a part ID from level and part number.
 */
export function generatePartId(level: string, partNumber: number): string {
  return `${level}-part-${partNumber}`;
}

/**
 * Parses a part ID into level and part number. Throws when the ID does not match the expected shape.
 */
export function parsePartId(partId: string): { level: string; partNumber: number } {
  const [level, partNumberRaw] = partId.split('-part-');
  if (!level || !partNumberRaw) {
    throw new Error(`Invalid partId: ${partId}`);
  }
  const partNumber = Number.parseInt(partNumberRaw, 10);
  if (Number.isNaN(partNumber)) {
    throw new Error(`Invalid partId number segment: ${partId}`);
  }
  return { level, partNumber };
}

/**
 * Debounces a function call.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

/**
 * Clamps a number between min and max values.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats percentage with optional decimal places.
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
