# Learnglish

Learnglish is a privacy-friendly English vocabulary learning application built around active recall, spaced repetition, and contextual examples.

It runs entirely in the browser without user accounts or a backend. Vocabulary content ships with the application, while each learner's progress stays in that learner's browser.

## Features

- CEFR vocabulary levels from A1 through C1
- English-to-Turkish and Turkish-to-English quiz directions
- Spaced-repetition review scheduling
- English definitions, Turkish translations, and contextual examples
- Progress statistics and daily practice tracking
- Light, dark, and system themes
- Local progress backup and restore
- Static hosting with no application server required

## Privacy and local data

Learnglish does not require an account and does not send learning progress to a server.

The vocabulary library is bundled with the application and imported into IndexedDB in the browser. Quiz history, review schedules, statistics, and settings are also stored locally in IndexedDB.

Because progress is local to a browser profile, clearing site data removes it. Use the backup feature in Settings to download a recovery file before clearing browser data or moving to another browser.

## Development

Requirements:

- Node.js
- npm

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm test -- --run` | Run the test suite once |
| `npm run lint` | Run ESLint |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |

## Production

The application is designed as a static site and targets GitHub Pages. The production base path is `/Learnglish/`.

No backend service is required for the public learning experience.
