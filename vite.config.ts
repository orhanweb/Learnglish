// vite.config.ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import path from 'path';
import type { Plugin } from 'vite';
import { parseWordsPayload } from './src/lib/words-payload';

const WORDS_MANIFEST_MODULE_ID = 'virtual:words-manifest';
const RESOLVED_WORDS_MANIFEST_MODULE_ID = `\0${WORDS_MANIFEST_MODULE_ID}`;

function wordsManifestPlugin(): Plugin {
  const wordsPath = path.resolve(__dirname, './src/data/words.json');

  return {
    name: 'learnglish-words-manifest',
    enforce: 'pre',
    resolveId(id) {
      return id === WORDS_MANIFEST_MODULE_ID ? RESOLVED_WORDS_MANIFEST_MODULE_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_WORDS_MANIFEST_MODULE_ID) return undefined;
      this.addWatchFile(wordsPath);
      const payload = parseWordsPayload(JSON.parse(readFileSync(wordsPath, 'utf8')) as unknown);
      return `export default ${JSON.stringify(payload.manifest)};`;
    }
  };
}

export default defineConfig({
  plugins: [wordsManifestPlugin(), react(), tailwindcss()],
  server: {
    host: true
  },
  base: '/Learnglish/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild'
  }
});
