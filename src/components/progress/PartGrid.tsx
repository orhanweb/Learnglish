// src/components/progress/PartGrid.tsx

import { Link } from 'react-router-dom';
import { Play, CheckCircle, Lock } from 'lucide-react';
import type { Level } from '@/types';
import { Button, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';

interface PartInfo {
  partNumber: number;
  totalWords: number;
  completedWords: number;
  isUnlocked: boolean;
}

interface PartGridProps {
  level: Level;
  parts: PartInfo[];
}

export function PartGrid({ level, parts }: PartGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {parts.map(part => {
        const hasWords = part.totalWords > 0;
        const isComplete = hasWords && part.completedWords >= part.totalWords;
        const progress = hasWords ? (part.completedWords / part.totalWords) * 100 : 0;

        return (
          <Link
            key={part.partNumber}
            to={part.isUnlocked ? `/level/${level}/part/${part.partNumber}` : '#'}
            className={cn(!part.isUnlocked && 'pointer-events-none')}
            aria-disabled={!part.isUnlocked}
            tabIndex={part.isUnlocked ? undefined : -1}
          >
            <div
              className={cn(
                'group relative rounded-xl border bg-card p-4 transition-all duration-200',
                part.isUnlocked && 'cursor-pointer hover:border-primary/30 hover:bg-accent/50 hover:shadow-md',
                !part.isUnlocked && 'opacity-50'
              )}
            >
              <div className="absolute right-3 top-3">
                {isComplete ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : !part.isUnlocked ? (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                ) : null}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Part</p>
                  <p className="text-2xl font-bold">{part.partNumber}</p>
                </div>

                {part.isUnlocked && (
                  <>
                    <Progress value={progress} max={100} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {part.completedWords}/{part.totalWords} words
                      </span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </>
                )}
              </div>

              {part.isUnlocked && !isComplete && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" className="gap-2">
                    <Play className="h-4 w-4" />
                    Start Quiz
                  </Button>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
