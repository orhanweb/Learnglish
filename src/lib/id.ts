// src/lib/id.ts

/**
 * Stable identity helpers for vocabulary records.
 *
 * IDs are intentionally opaque (no semantic content) so they remain valid even
 * when a word's text, level, or part-of-speech changes. Stripe-style prefixes
 * keep them debuggable in URLs and logs without leaking meaning.
 */

/** Prefix marking a vocabulary word identifier. */
export const WORD_ID_PREFIX = 'wrd_';

/** Matches a well-formed word ID: prefix + RFC 4122 v4 UUID. */
const WORD_ID_PATTERN = /^wrd_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates a fresh, opaque word identifier backed by `crypto.randomUUID()`.
 * Uses the browser/Node 20+ native primitive to avoid any third-party dependency.
 */
export function generateWordId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is unavailable; modern browser or Node >= 20 required.');
  }
  return `${WORD_ID_PREFIX}${globalThis.crypto.randomUUID()}`;
}

/** Type guard validating that a string matches the canonical word ID shape. */
export function isWordId(value: unknown): value is string {
  return typeof value === 'string' && WORD_ID_PATTERN.test(value);
}
