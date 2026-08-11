// src/components/word/WordCard.tsx

import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import type { Word } from '@/types';
import { Card, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { levelVariants } from '@/lib/level-variants';

interface WordCardProps {
  word: Word;
  showProgress?: boolean;
  progressPercentage?: number;
}

export function WordCard({ word, showProgress, progressPercentage = 0 }: WordCardProps) {
  return (
    <Link to={`/word/${word.id}`}>
      <Card variant="interactive" className="relative overflow-hidden p-4">
        {/* Progress indicator */}
        {showProgress && progressPercentage > 0 && (
          <div className="absolute bottom-0 left-0 h-1 bg-success/50 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{word.wordEn.join(', ')}</h3>
              <Badge variant="secondary" className="text-xs">
                {word.partOfSpeech}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{word.wordTr.join(', ')}</p>
          </div>

          <Badge variant={levelVariants[word.level]} className="shrink-0">
            {word.level}
          </Badge>
        </div>

        {/* Example preview */}
        {word.examples[0] && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 p-2">
            <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground line-clamp-1">{word.examples[0].en}</p>
          </div>
        )}

        {/* Mastery indicator */}
        {showProgress && progressPercentage >= 100 && (
          <div className="absolute right-2 top-2">
            <span className="text-lg">✓</span>
          </div>
        )}
      </Card>
    </Link>
  );
}

// Compact version for lists
interface WordCardCompactProps {
  word: Word;
  index: number;
  onClick?: () => void;
}

export function WordCardCompact({ word, index, onClick }: WordCardCompactProps) {
  const interactive = Boolean(onClick);
  const sharedClass = cn(
    'flex w-full items-center gap-4 rounded-lg border bg-card p-3 text-left transition-all duration-200',
    interactive && 'cursor-pointer hover:border-primary/30 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  );

  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{word.wordEn.join(', ')}</span>
          <Badge variant="secondary" className="text-[10px]">
            {word.partOfSpeech}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">{word.wordTr.join(', ')}</p>
      </div>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={sharedClass}>
        {content}
      </button>
    );
  }

  return <div className={sharedClass}>{content}</div>;
}
