// src/components/layout/AppInitError.tsx

import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useScrollLock } from '@/hooks';

export type AppInitStep = 'settings' | 'seeding-check' | 'seeding' | 'progress';

const STEP_MESSAGES: Record<AppInitStep, string> = {
  settings: 'Your local settings could not be read.',
  'seeding-check': 'The local vocabulary database could not be checked.',
  seeding: 'The local vocabulary database could not be prepared.',
  progress: 'Your saved learning progress could not be read.'
};

interface AppInitErrorProps {
  failedStep: AppInitStep;
  onRetry: () => void;
  onReload: () => void;
}

export function AppInitError({ failedStep, onRetry, onReload }: AppInitErrorProps) {
  useScrollLock(true);

  return (
    <div className="fixed inset-0 z-100 flex min-h-dvh items-center justify-center bg-background p-4" role="alert" aria-live="assertive">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="mt-6 space-y-3">
          <h1 className="text-2xl font-bold">Learnglish couldn't start</h1>
          <p className="text-muted-foreground">{STEP_MESSAGES[failedStep]}</p>
          <p className="text-sm text-muted-foreground">
            Your saved learning data has not been deleted. Check that this browser allows site storage, then try again.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" onClick={onReload} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reload app
          </Button>
        </div>
      </Card>
    </div>
  );
}
