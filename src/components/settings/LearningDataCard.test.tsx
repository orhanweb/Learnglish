// src/components/settings/LearningDataCard.test.tsx

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningDataCard } from './LearningDataCard';
import { useProgressStore } from '@/stores';
import type { ProgressBackup, ProgressBackupPreview } from '@/lib/progress-backup';

const backupMocks = vi.hoisted(() => ({
  createProgressBackup: vi.fn(),
  downloadProgressBackup: vi.fn(),
  parseProgressBackupFile: vi.fn(),
  previewProgressBackup: vi.fn(),
  progressBackupFilename: vi.fn((prefix: string) => `${prefix}.json`),
  restoreProgressBackup: vi.fn()
}));

vi.mock('@/lib/progress-backup', () => backupMocks);

const backup: ProgressBackup = {
  format: 'learnglish-progress-backup',
  schemaVersion: 1,
  exportedAt: '2026-08-10T10:00:00.000Z',
  vocabulary: { identity: '1:djb2-v1:12345678', wordCount: 100 },
  contentHash: '12345678',
  data: { wordProgress: [], partProgress: [], dailyStats: [] }
};

const preview: ProgressBackupPreview = {
  exportedAt: backup.exportedAt,
  vocabularyMatches: false,
  currentVocabularyWordCount: 90,
  backupVocabularyWordCount: 100,
  wordProgressRows: 12,
  skippedWordProgressRows: 2,
  partProgressRows: 3,
  skippedPartProgressRows: 1,
  dailyStatsRows: 8
};

const originalLoadProgress = useProgressStore.getState().loadProgress;

describe('LearningDataCard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    backupMocks.createProgressBackup.mockReset().mockResolvedValue(backup);
    backupMocks.downloadProgressBackup.mockReset();
    backupMocks.parseProgressBackupFile.mockReset().mockResolvedValue(backup);
    backupMocks.previewProgressBackup.mockReset().mockResolvedValue(preview);
    backupMocks.progressBackupFilename.mockClear();
    backupMocks.restoreProgressBackup.mockReset().mockResolvedValue({ ...preview, restored: true });
    useProgressStore.setState({ loadProgress: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useProgressStore.setState({ loadProgress: originalLoadProgress });
  });

  it('previews an import and restores only after explicit confirmation', async () => {
    render(<LearningDataCard />);
    const file = new File(['{}'], 'progress.json', { type: 'application/json' });

    fireEvent.change(screen.getByLabelText('Choose progress backup file'), { target: { files: [file] } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Restore learning progress?')).toBeInTheDocument();
    expect(screen.getByText(/different vocabulary version/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Part progress').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Skipped records').parentElement).toHaveTextContent('3');
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(backupMocks.restoreProgressBackup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Restore progress' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Learning progress restored');
    expect(backupMocks.createProgressBackup).toHaveBeenCalledTimes(1);
    expect(backupMocks.downloadProgressBackup).toHaveBeenCalledWith(backup, 'learnglish-recovery-before-restore.json');
    expect(backupMocks.restoreProgressBackup).toHaveBeenCalledWith(backup);
    expect(backupMocks.downloadProgressBackup.mock.invocationCallOrder[0]).toBeLessThan(
      backupMocks.restoreProgressBackup.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(useProgressStore.getState().loadProgress).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('downloads a manual progress backup without including a restore step', async () => {
    render(<LearningDataCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Learning progress backup downloaded');
    expect(backupMocks.createProgressBackup).toHaveBeenCalledTimes(1);
    expect(backupMocks.downloadProgressBackup).toHaveBeenCalledWith(backup, 'learnglish-progress.json');
    expect(backupMocks.restoreProgressBackup).not.toHaveBeenCalled();
  });

  it('rejects an invalid file without opening the confirmation dialog', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    backupMocks.parseProgressBackupFile.mockRejectedValueOnce(new Error('invalid backup'));
    render(<LearningDataCard />);

    fireEvent.change(screen.getByLabelText('Choose progress backup file'), {
      target: { files: [new File(['broken'], 'broken.json', { type: 'application/json' })] }
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('not a valid Learnglish progress backup'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backupMocks.previewProgressBackup).not.toHaveBeenCalled();
    expect(backupMocks.restoreProgressBackup).not.toHaveBeenCalled();
  });
});
