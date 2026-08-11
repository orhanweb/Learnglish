// src/pages/LevelPage.tsx

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button, Badge, EmptyState, LoadingState } from '@/components/ui';
import { PartGrid } from '@/components/progress';
import { LEVEL_CONFIGS, type Level } from '@/types';
import { useProgressStore, useSettingsStore } from '@/stores';
import { getPartWordIndexesForLevel, type PartWordIndex } from '@/data/words';
import { calculateWordIdsCompletion } from '@/lib/spaced-repetition';
import { levelVariants } from '@/lib/level-variants';

export function LevelPage() {
  const { level } = useParams<{ level: string }>();
  const { wordProgressMap } = useProgressStore();
  const { quizMode } = useSettingsStore();
  const [parts, setParts] = useState<PartWordIndex[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const levelConfig = LEVEL_CONFIGS.find(c => c.level === level);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getPartWordIndexesForLevel(level as Level);
      if (!cancelled) {
        setParts(data);
        setIsDataLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [level]);

  if (!levelConfig) {
    return (
      <EmptyState
        title="Level not found"
        action={
          <Link to="/">
            <Button>Go back home</Button>
          </Link>
        }
      />
    );
  }

  if (isDataLoading) {
    return <LoadingState />;
  }

  const partInfos = parts
    .slice()
    .sort((a, b) => a.partNumber - b.partNumber)
    .map(part => {
      const completion = calculateWordIdsCompletion(part.wordIds, wordProgressMap, quizMode);
      return {
        partNumber: part.partNumber,
        totalWords: completion.total,
        completedWords: completion.completed,
        isUnlocked: true
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant={levelVariants[levelConfig.level]} className="text-lg px-3 py-1">
            {levelConfig.level}
          </Badge>
          <div>
            <h1 className="text-2xl font-bold">{levelConfig.name}</h1>
            <p className="text-muted-foreground">{levelConfig.description}</p>
          </div>
        </div>
      </div>

      <PartGrid level={level as Level} parts={partInfos} />

      {parts.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No word data available for this level yet.</p>
          <p className="text-sm mt-2">
            Try the{' '}
            <Link to="/level/A1" className="text-primary hover:underline">
              A1 level
            </Link>{' '}
            which has sample data.
          </p>
        </div>
      )}
    </div>
  );
}
