// src/components/settings/LearningDataCard.tsx

import { useRef, useState } from 'react';
import { AlertTriangle, Download, LoaderCircle, ShieldCheck, Upload } from 'lucide-react';
import { Button, Card, Dialog } from '@/components/ui';
import {
  createProgressBackup,
  downloadProgressBackup,
  parseProgressBackupFile,
  previewProgressBackup,
  progressBackupFilename,
  restoreProgressBackup,
  type ProgressBackup,
  type ProgressBackupPreview
} from '@/lib/progress-backup';
import { useProgressStore } from '@/stores';

interface PendingRestore {
  readonly backup: ProgressBackup;
  readonly preview: ProgressBackupPreview;
}

type Operation = 'exporting' | 'reading' | 'restoring' | null;

export function LearningDataCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadProgress = useProgressStore(state => state.loadProgress);
  const [operation, setOperation] = useState<Operation>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isBusy = operation !== null;

  const handleExport = async () => {
    setOperation('exporting');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const backup = await createProgressBackup();
      downloadProgressBackup(backup, progressBackupFilename('learnglish-progress'));
      setSuccessMessage('Learning progress backup downloaded.');
    } catch (error) {
      console.error('Failed to export learning progress:', error);
      setErrorMessage('The learning progress backup could not be created. Please try again.');
    } finally {
      setOperation(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;

    setOperation('reading');
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const backup = await parseProgressBackupFile(file);
      const preview = await previewProgressBackup(backup);
      setPendingRestore({ backup, preview });
    } catch (error) {
      console.error('Failed to read progress backup:', error);
      setErrorMessage('The selected file is not a valid Learnglish progress backup.');
    } finally {
      setOperation(null);
    }
  };

  const handleRestore = async () => {
    if (pendingRestore === null) return;

    setOperation('restoring');
    setErrorMessage(null);
    let restoreCommitted = false;
    try {
      const recoveryBackup = await createProgressBackup();
      downloadProgressBackup(recoveryBackup, progressBackupFilename('learnglish-recovery-before-restore'));
      const result = await restoreProgressBackup(pendingRestore.backup);
      restoreCommitted = true;
      await loadProgress();
      setPendingRestore(null);
      setSuccessMessage(
        `Learning progress restored: ${result.wordProgressRows} words, ${result.partProgressRows} parts, and ${result.dailyStatsRows} daily records.`
      );
    } catch (error) {
      console.error('Failed to restore learning progress:', error);
      setErrorMessage(
        restoreCommitted
          ? 'Progress was restored, but the screen could not refresh. Reload the app to see the restored data.'
          : 'Nothing was restored. Your existing learning progress is unchanged.'
      );
    } finally {
      setOperation(null);
    }
  };

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Learning Data</h2>
            <p className="text-sm text-muted-foreground">Back up or restore your progress on this browser.</p>
          </div>
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          Backups contain quiz progress, part progress, and daily statistics. Vocabulary and app settings are never replaced.
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => void handleExport()} disabled={isBusy} className="flex-1 gap-2">
            {operation === 'exporting' ? <LoaderCircle className="animate-spin" /> : <Download />}
            Export backup
          </Button>
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={isBusy} className="flex-1 gap-2">
            {operation === 'reading' ? <LoaderCircle className="animate-spin" /> : <Upload />}
            Import backup
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Choose progress backup file"
            className="hidden"
            disabled={isBusy}
            onChange={event => void handleFileChange(event)}
          />
        </div>

        {errorMessage !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {successMessage !== null && (
          <p role="status" className="text-sm text-success">
            {successMessage}
          </p>
        )}
      </Card>

      <Dialog
        open={pendingRestore !== null}
        onOpenChange={open => {
          if (!open && operation !== 'restoring') setPendingRestore(null);
        }}
        preventClose={operation === 'restoring'}
        hideCloseButton
        className="max-w-lg"
      >
        {pendingRestore !== null && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Restore learning progress?</h2>
              <p className="text-sm text-muted-foreground">
                Backup created {new Date(pendingRestore.preview.exportedAt).toLocaleString()}.
              </p>
            </div>

            {!pendingRestore.preview.vocabularyMatches && (
              <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <p>
                  This backup uses a different vocabulary version. Progress for words or parts that no longer exist will be skipped safely.
                </p>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <PreviewRow label="Word progress" value={pendingRestore.preview.wordProgressRows} />
              <PreviewRow label="Part progress" value={pendingRestore.preview.partProgressRows} />
              <PreviewRow label="Daily records" value={pendingRestore.preview.dailyStatsRows} />
              <PreviewRow
                label="Skipped records"
                value={pendingRestore.preview.skippedWordProgressRows + pendingRestore.preview.skippedPartProgressRows}
              />
            </dl>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Your current progress will be downloaded as a recovery backup first. Vocabulary and settings will stay unchanged.
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" disabled={operation === 'restoring'} onClick={() => setPendingRestore(null)}>
                Cancel
              </Button>
              <Button disabled={operation === 'restoring'} onClick={() => void handleRestore()} className="gap-2">
                {operation === 'restoring' ? <LoaderCircle className="animate-spin" /> : <Upload />}
                {operation === 'restoring' ? 'Restoring...' : 'Restore progress'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

interface PreviewRowProps {
  readonly label: string;
  readonly value: number;
}

function PreviewRow({ label, value }: PreviewRowProps) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value.toLocaleString()}</dd>
    </div>
  );
}
