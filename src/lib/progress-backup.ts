// src/lib/progress-backup.ts

import { db } from './db';
import { computeNextDueAt, LEVELS_ORDERED, type DailyStats, type DirectionProgress, type Level, type PartProgress, type WordProgress } from '@/types';
import { isWordId } from './id';
import { generatePartId } from './utils';

export const PROGRESS_BACKUP_FORMAT = 'learnglish-progress-backup' as const;
export const PROGRESS_BACKUP_SCHEMA_VERSION = 1 as const;
export const MAX_PROGRESS_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

const CONTENT_HASH_PATTERN = /^[0-9a-f]{8}$/u;
const VOCABULARY_IDENTITY_PATTERN = /^1:djb2-v1:[0-9a-f]{8}$/u;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export interface ProgressBackupVocabulary {
  readonly identity: string | null;
  readonly wordCount: number;
}

export interface ProgressBackupData {
  readonly wordProgress: readonly WordProgress[];
  readonly partProgress: readonly PartProgress[];
  readonly dailyStats: readonly DailyStats[];
}

export interface ProgressBackup {
  readonly format: typeof PROGRESS_BACKUP_FORMAT;
  readonly schemaVersion: typeof PROGRESS_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly vocabulary: ProgressBackupVocabulary;
  readonly contentHash: string;
  readonly data: ProgressBackupData;
}

export interface ProgressBackupPreview {
  readonly exportedAt: string;
  readonly vocabularyMatches: boolean;
  readonly currentVocabularyWordCount: number;
  readonly backupVocabularyWordCount: number;
  readonly wordProgressRows: number;
  readonly skippedWordProgressRows: number;
  readonly partProgressRows: number;
  readonly skippedPartProgressRows: number;
  readonly dailyStatsRows: number;
}

export interface ProgressBackupRestoreResult extends ProgressBackupPreview {
  readonly restored: true;
}

export class ProgressBackupIntegrityError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[], options?: ErrorOptions) {
    super(`Progress backup integrity check failed:\n - ${issues.join('\n - ')}`, options);
    this.name = 'ProgressBackupIntegrityError';
    this.issues = issues;
  }
}

interface VocabularyReference {
  readonly identity: string | null;
  readonly wordIds: ReadonlySet<string>;
  readonly partIds: ReadonlySet<string>;
}

function fail(issue: string): never {
  throw new ProgressBackupIntegrityError([issue]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${label}: must be an object`);
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label}: expected keys ${wanted.join(', ')}, received ${actual.join(', ') || '<none>'}`);
  }
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label}: must be a non-empty string`);
  return value;
}

function readNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) fail(`${label}: must be a non-negative integer`);
  return Number(value);
}

function readNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${label}: must be a finite non-negative number`);
  }
  return value;
}

function readIsoTimestamp(value: unknown, label: string): string {
  const timestamp = readString(value, label);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    fail(`${label}: must be an ISO timestamp`);
  }
  return timestamp;
}

function readDateKey(value: unknown, label: string): string {
  const dateKey = readString(value, label);
  if (!DATE_KEY_PATTERN.test(dateKey)) fail(`${label}: must use YYYY-MM-DD`);
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey) {
    fail(`${label}: must be a valid calendar date`);
  }
  return dateKey;
}

function readLevel(value: unknown, label: string): Level {
  const level = LEVELS_ORDERED.find(candidate => candidate === value);
  if (level === undefined) fail(`${label}: must be a supported CEFR level`);
  return level;
}

function readDirectionProgress(value: unknown, label: string): DirectionProgress {
  const record = readRecord(value, label);
  exactKeys(
    record,
    ['easeFactor', 'interval', 'repetitions', 'nextReviewDate', 'correctCount', 'incorrectCount', 'mastered'],
    label
  );
  const easeFactor = readNonNegativeNumber(record['easeFactor'], `${label}.easeFactor`);
  if (easeFactor < 1) fail(`${label}.easeFactor: must be at least 1`);
  if (typeof record['mastered'] !== 'boolean') fail(`${label}.mastered: must be a boolean`);

  return {
    easeFactor,
    interval: readNonNegativeInteger(record['interval'], `${label}.interval`),
    repetitions: readNonNegativeInteger(record['repetitions'], `${label}.repetitions`),
    nextReviewDate: readIsoTimestamp(record['nextReviewDate'], `${label}.nextReviewDate`),
    correctCount: readNonNegativeInteger(record['correctCount'], `${label}.correctCount`),
    incorrectCount: readNonNegativeInteger(record['incorrectCount'], `${label}.incorrectCount`),
    mastered: record['mastered']
  };
}

function readWordProgress(value: unknown, index: number): WordProgress {
  const label = `data.wordProgress[${index}]`;
  const record = readRecord(value, label);
  exactKeys(record, ['wordId', 'recognition', 'production', 'lastReviewedAt', 'nextDueAt'], label);
  const wordId = readString(record['wordId'], `${label}.wordId`);
  if (!isWordId(wordId)) fail(`${label}.wordId: must be a valid Learnglish word id`);

  const progress: WordProgress = {
    wordId,
    recognition: readDirectionProgress(record['recognition'], `${label}.recognition`),
    production: readDirectionProgress(record['production'], `${label}.production`),
    lastReviewedAt: readIsoTimestamp(record['lastReviewedAt'], `${label}.lastReviewedAt`),
    nextDueAt: readIsoTimestamp(record['nextDueAt'], `${label}.nextDueAt`)
  };
  if (progress.nextDueAt !== computeNextDueAt(progress)) {
    fail(`${label}.nextDueAt: must match the earliest direction review date`);
  }
  return progress;
}

function readPartProgress(value: unknown, index: number): PartProgress {
  const label = `data.partProgress[${index}]`;
  const record = readRecord(value, label);
  const hasCompletedAt = Object.prototype.hasOwnProperty.call(record, 'completedAt');
  exactKeys(record, hasCompletedAt ? ['partId', 'level', 'partNumber', 'startedAt', 'completedAt'] : ['partId', 'level', 'partNumber', 'startedAt'], label);
  const level = readLevel(record['level'], `${label}.level`);
  const partNumber = readNonNegativeInteger(record['partNumber'], `${label}.partNumber`);
  if (partNumber < 1) fail(`${label}.partNumber: must be a positive integer`);
  const partId = readString(record['partId'], `${label}.partId`);
  if (partId !== generatePartId(level, partNumber)) fail(`${label}.partId: does not match its level and part number`);
  const startedAt = readIsoTimestamp(record['startedAt'], `${label}.startedAt`);

  if (!hasCompletedAt) return { partId, level, partNumber, startedAt };
  return {
    partId,
    level,
    partNumber,
    startedAt,
    completedAt: readIsoTimestamp(record['completedAt'], `${label}.completedAt`)
  };
}

function readDailyStats(value: unknown, index: number): DailyStats {
  const label = `data.dailyStats[${index}]`;
  const record = readRecord(value, label);
  exactKeys(record, ['date', 'wordsStudied', 'correctAnswers', 'incorrectAnswers', 'timeSpentMinutes'], label);
  const correctAnswers = readNonNegativeInteger(record['correctAnswers'], `${label}.correctAnswers`);
  const incorrectAnswers = readNonNegativeInteger(record['incorrectAnswers'], `${label}.incorrectAnswers`);
  const wordsStudied = readNonNegativeInteger(record['wordsStudied'], `${label}.wordsStudied`);
  if (wordsStudied !== correctAnswers + incorrectAnswers) {
    fail(`${label}.wordsStudied: must equal correctAnswers + incorrectAnswers`);
  }

  return {
    date: readDateKey(record['date'], `${label}.date`),
    wordsStudied,
    correctAnswers,
    incorrectAnswers,
    timeSpentMinutes: readNonNegativeNumber(record['timeSpentMinutes'], `${label}.timeSpentMinutes`)
  };
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`${label}: duplicate primary keys are not allowed`);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalData(data: ProgressBackupData): ProgressBackupData {
  return {
    wordProgress: [...data.wordProgress].sort((left, right) => compareText(left.wordId, right.wordId)),
    partProgress: [...data.partProgress].sort((left, right) => compareText(left.partId, right.partId)),
    dailyStats: [...data.dailyStats].sort((left, right) => compareText(left.date, right.date))
  };
}

function djb2(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index++) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function backupContentHash(
  exportedAt: string,
  vocabulary: ProgressBackupVocabulary,
  data: ProgressBackupData
): string {
  return djb2(
    JSON.stringify({
      format: PROGRESS_BACKUP_FORMAT,
      schemaVersion: PROGRESS_BACKUP_SCHEMA_VERSION,
      exportedAt,
      vocabulary,
      data
    })
  );
}

function buildProgressBackup(
  exportedAt: string,
  vocabulary: ProgressBackupVocabulary,
  data: ProgressBackupData
): ProgressBackup {
  const canonical = canonicalData(data);
  return {
    format: PROGRESS_BACKUP_FORMAT,
    schemaVersion: PROGRESS_BACKUP_SCHEMA_VERSION,
    exportedAt,
    vocabulary,
    contentHash: backupContentHash(exportedAt, vocabulary, canonical),
    data: canonical
  };
}

export function parseProgressBackup(value: unknown): ProgressBackup {
  const envelope = readRecord(value, 'backup');
  exactKeys(envelope, ['format', 'schemaVersion', 'exportedAt', 'vocabulary', 'contentHash', 'data'], 'backup');
  if (envelope['format'] !== PROGRESS_BACKUP_FORMAT) fail(`backup.format: expected "${PROGRESS_BACKUP_FORMAT}"`);
  if (envelope['schemaVersion'] !== PROGRESS_BACKUP_SCHEMA_VERSION) {
    fail(`backup.schemaVersion: expected ${PROGRESS_BACKUP_SCHEMA_VERSION}`);
  }
  const exportedAt = readIsoTimestamp(envelope['exportedAt'], 'backup.exportedAt');
  const vocabularyRecord = readRecord(envelope['vocabulary'], 'backup.vocabulary');
  exactKeys(vocabularyRecord, ['identity', 'wordCount'], 'backup.vocabulary');
  const identity = vocabularyRecord['identity'];
  if (identity !== null && (typeof identity !== 'string' || !VOCABULARY_IDENTITY_PATTERN.test(identity))) {
    fail('backup.vocabulary.identity: must be null or a supported vocabulary identity');
  }
  const vocabulary: ProgressBackupVocabulary = {
    identity,
    wordCount: readNonNegativeInteger(vocabularyRecord['wordCount'], 'backup.vocabulary.wordCount')
  };
  const dataRecord = readRecord(envelope['data'], 'backup.data');
  exactKeys(dataRecord, ['wordProgress', 'partProgress', 'dailyStats'], 'backup.data');
  if (!Array.isArray(dataRecord['wordProgress'])) fail('backup.data.wordProgress: must be an array');
  if (!Array.isArray(dataRecord['partProgress'])) fail('backup.data.partProgress: must be an array');
  if (!Array.isArray(dataRecord['dailyStats'])) fail('backup.data.dailyStats: must be an array');

  const data = canonicalData({
    wordProgress: dataRecord['wordProgress'].map(readWordProgress),
    partProgress: dataRecord['partProgress'].map(readPartProgress),
    dailyStats: dataRecord['dailyStats'].map(readDailyStats)
  });
  assertUnique(data.wordProgress.map(row => row.wordId), 'backup.data.wordProgress');
  assertUnique(data.partProgress.map(row => row.partId), 'backup.data.partProgress');
  assertUnique(data.dailyStats.map(row => row.date), 'backup.data.dailyStats');

  const contentHash = readString(envelope['contentHash'], 'backup.contentHash');
  if (!CONTENT_HASH_PATTERN.test(contentHash)) fail('backup.contentHash: must be an 8-character lowercase hexadecimal string');
  const expectedHash = backupContentHash(exportedAt, vocabulary, data);
  if (contentHash !== expectedHash) fail(`backup.contentHash: expected ${expectedHash}, received ${contentHash}`);

  return {
    format: PROGRESS_BACKUP_FORMAT,
    schemaVersion: PROGRESS_BACKUP_SCHEMA_VERSION,
    exportedAt,
    vocabulary,
    contentHash: expectedHash,
    data
  };
}

export function serializeProgressBackup(backup: ProgressBackup): string {
  return `${JSON.stringify(parseProgressBackup(backup), null, 2)}\n`;
}

async function readVocabularyReference(): Promise<VocabularyReference> {
  const [seedState, wordIds, levelPartKeys] = await Promise.all([
    db.seedState.get('wordsHash'),
    db.words.toCollection().primaryKeys(),
    db.words.orderBy('[level+partNumber]').uniqueKeys()
  ]);
  const partIds = new Set<string>();
  for (const key of levelPartKeys as unknown[]) {
    if (!Array.isArray(key) || key.length !== 2) continue;
    const [levelValue, partNumberValue] = key;
    const level = LEVELS_ORDERED.find(candidate => candidate === levelValue);
    if (level !== undefined && typeof partNumberValue === 'number' && Number.isInteger(partNumberValue)) {
      partIds.add(generatePartId(level, partNumberValue));
    }
  }
  return {
    identity: seedState?.value ?? null,
    wordIds: new Set(wordIds),
    partIds
  };
}

function createPreview(backup: ProgressBackup, vocabulary: VocabularyReference): ProgressBackupPreview {
  const validWordProgress = backup.data.wordProgress.filter(row => vocabulary.wordIds.has(row.wordId));
  const validPartProgress = backup.data.partProgress.filter(row => vocabulary.partIds.has(row.partId));
  return {
    exportedAt: backup.exportedAt,
    vocabularyMatches: backup.vocabulary.identity === vocabulary.identity,
    currentVocabularyWordCount: vocabulary.wordIds.size,
    backupVocabularyWordCount: backup.vocabulary.wordCount,
    wordProgressRows: validWordProgress.length,
    skippedWordProgressRows: backup.data.wordProgress.length - validWordProgress.length,
    partProgressRows: validPartProgress.length,
    skippedPartProgressRows: backup.data.partProgress.length - validPartProgress.length,
    dailyStatsRows: backup.data.dailyStats.length
  };
}

export async function createProgressBackup(now: Date = new Date()): Promise<ProgressBackup> {
  const snapshot = await db.transaction(
    'r',
    [db.words, db.seedState, db.wordProgress, db.partProgress, db.dailyStats],
    async () => {
      const [vocabulary, wordProgress, partProgress, dailyStats] = await Promise.all([
        readVocabularyReference(),
        db.wordProgress.toArray(),
        db.partProgress.toArray(),
        db.dailyStats.toArray()
      ]);
      return { vocabulary, wordProgress, partProgress, dailyStats };
    }
  );
  const backup = buildProgressBackup(
    now.toISOString(),
    { identity: snapshot.vocabulary.identity, wordCount: snapshot.vocabulary.wordIds.size },
    {
      wordProgress: snapshot.wordProgress,
      partProgress: snapshot.partProgress,
      dailyStats: snapshot.dailyStats
    }
  );
  return parseProgressBackup(backup);
}

export async function previewProgressBackup(value: unknown): Promise<ProgressBackupPreview> {
  const backup = parseProgressBackup(value);
  const vocabulary = await db.transaction('r', [db.words, db.seedState], readVocabularyReference);
  return createPreview(backup, vocabulary);
}

export async function restoreProgressBackup(value: unknown): Promise<ProgressBackupRestoreResult> {
  const backup = parseProgressBackup(value);
  return db.transaction(
    'rw',
    [db.words, db.seedState, db.wordProgress, db.partProgress, db.dailyStats],
    async () => {
      const vocabulary = await readVocabularyReference();
      const preview = createPreview(backup, vocabulary);
      const wordProgress = backup.data.wordProgress.filter(row => vocabulary.wordIds.has(row.wordId));
      const partProgress = backup.data.partProgress.filter(row => vocabulary.partIds.has(row.partId));

      await Promise.all([db.wordProgress.clear(), db.partProgress.clear(), db.dailyStats.clear()]);
      await Promise.all([
        wordProgress.length > 0 ? db.wordProgress.bulkPut(wordProgress) : Promise.resolve(),
        partProgress.length > 0 ? db.partProgress.bulkPut(partProgress) : Promise.resolve(),
        backup.data.dailyStats.length > 0 ? db.dailyStats.bulkPut(backup.data.dailyStats) : Promise.resolve()
      ]);
      return { ...preview, restored: true as const };
    }
  );
}

export async function parseProgressBackupFile(file: File): Promise<ProgressBackup> {
  if (file.size > MAX_PROGRESS_BACKUP_FILE_BYTES) {
    throw new ProgressBackupIntegrityError([
      `file: exceeds the ${Math.floor(MAX_PROGRESS_BACKUP_FILE_BYTES / (1024 * 1024))} MB limit`
    ]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch (error) {
    throw new ProgressBackupIntegrityError(['file: must contain valid JSON'], { cause: error });
  }
  return parseProgressBackup(parsed);
}

export function progressBackupFilename(prefix: string, now: Date = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/gu, '-');
  return `${prefix}-${timestamp}.json`;
}

export function downloadProgressBackup(backup: ProgressBackup, filename: string): void {
  const blob = new Blob([serializeProgressBackup(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
