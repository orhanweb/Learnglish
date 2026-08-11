// src/pages/ReviewLevelPage.tsx

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { Button, Card, Badge, LoadingState, EmptyState } from '@/components/ui';
import { WordCardCompact } from '@/components/word';
import { levelVariants } from '@/lib/level-variants';
import { useDueWords } from '@/hooks/useDueWords';
import type { Level, Word, WordProgress } from '@/types';

export function ReviewLevelPage() {
  const { level } = useParams<{ level: string }>();
  const levelKey = level?.toUpperCase() as Level | undefined;
  const levelVariant = levelKey ? levelVariants[levelKey] : undefined;

  const {
    filteredEntries: dueWords,
    isLoading,
    refresh
  } = useDueWords({
    level: levelKey,
    enabled: Boolean(levelKey)
  });

  const groupedByPart = useMemo(() => {
    return dueWords.reduce(
      (acc, item) => {
        const partNumber = item.word.partNumber;
        if (!acc[partNumber]) acc[partNumber] = [];
        acc[partNumber].push(item);
        return acc;
      },
      {} as Record<number, Array<{ progress: WordProgress; word: Word }>>
    );
  }, [dueWords]);

  if (!levelKey || !levelVariant) {
    return (
      <EmptyState
        title="Level not found"
        action={
          <Link to="/review">
            <Button>Go back to review</Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/review">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={levelVariant} className="text-base px-2 py-0.5">
                {levelKey}
              </Badge>
              <h1 className="text-2xl font-bold">Review</h1>
            </div>
            <p className="text-muted-foreground">{dueWords.length} words due for this level</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dueWords.length > 0 && (
            <Link to={`/review/${levelKey}/quiz`}>
              <Button className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Start Review Quiz
              </Button>
            </Link>
          )}
          <Button onClick={() => void refresh()} variant="outline" size="icon" aria-label="Refresh review list">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {dueWords.length === 0 ? (
        <EmptyState title="All caught up for this level." className="py-8" />
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByPart).map(([partNumber, items]) => (
            <Card key={partNumber} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Part {partNumber}</h2>
                <span className="text-sm text-muted-foreground">{items.length} due</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item, index) => (
                  <WordCardCompact key={item.word.id} word={item.word} index={index} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
