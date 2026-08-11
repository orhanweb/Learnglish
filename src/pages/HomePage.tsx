// src/pages/HomePage.tsx

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCw, Target, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, LoadingState } from '@/components/ui';
import { LevelCard, StatsCard } from '@/components/progress';
import { LEVEL_CONFIGS, type Level, type LevelConfig } from '@/types';
import { useProgressStore, useSettingsStore } from '@/stores';
import { getPartWordIndexesForLevel, type PartWordIndex } from '@/data/words';
import { calculateWordIdsCompletion } from '@/lib/spaced-repetition';
import { calculateProgressStatistics } from '@/lib/progress-statistics';

interface LevelStats {
  completedParts: number;
  totalParts: number;
  totalWords: number;
  completedWords: number;
}

export function HomePage() {
  const { dueWordsCount, streakCount, isLoading, getTodayStats, wordProgressMap } = useProgressStore();
  const { quizMode } = useSettingsStore();
  const [partsByLevel, setPartsByLevel] = useState<Map<Level, PartWordIndex[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        LEVEL_CONFIGS.map(async config => {
          const parts = await getPartWordIndexesForLevel(config.level);
          return [config.level, parts] as const;
        })
      );
      if (cancelled) return;
      setPartsByLevel(new Map(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const levelStatsMap = useMemo<Map<Level, LevelStats> | null>(() => {
    if (!partsByLevel) return null;
    const map = new Map<Level, LevelStats>();
    for (const config of LEVEL_CONFIGS) {
      const parts = partsByLevel.get(config.level) ?? [];
      let totalWords = 0;
      let completedWords = 0;
      let completedParts = 0;
      for (const part of parts) {
        const completion = calculateWordIdsCompletion(part.wordIds, wordProgressMap, quizMode);
        totalWords += completion.total;
        completedWords += completion.completed;
        if (completion.isCompleted) completedParts += 1;
      }
      map.set(config.level, { completedParts, totalParts: parts.length, totalWords, completedWords });
    }
    return map;
  }, [partsByLevel, wordProgressMap, quizMode]);

  const todayStats = getTodayStats();
  const progressStatistics = useMemo(
    () => calculateProgressStatistics(wordProgressMap.values(), todayStats),
    [wordProgressMap, todayStats]
  );

  if (isLoading || !levelStatsMap) {
    return <LoadingState />;
  }

  const getLevelStats = (config: LevelConfig): LevelStats =>
    levelStatsMap.get(config.level) ?? { completedParts: 0, totalParts: 0, totalWords: 0, completedWords: 0 };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-linear-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Welcome to Learnglish</h1>
            <p className="text-muted-foreground max-w-lg">
              Master English vocabulary with brain-science-based learning. Active recall and spaced repetition for lasting results.
            </p>
          </div>

          {dueWordsCount > 0 && (
            <Link to="/review">
              <Button size="lg" className="gap-2 shadow-lg">
                <RefreshCw className="h-5 w-5" />
                Review {dueWordsCount} Words
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Words Practiced Today"
          value={progressStatistics.wordsPracticedToday}
          description={`${progressStatistics.todayAnswers} answers submitted`}
          icon={<BookOpen className="h-6 w-6" />}
        />
        <StatsCard
          title="Today's Accuracy"
          value={progressStatistics.todayAccuracy === null ? '—' : `${progressStatistics.todayAccuracy}%`}
          description={`${todayStats.correctAnswers} correct, ${todayStats.incorrectAnswers} incorrect`}
          icon={<Target className="h-6 w-6" />}
        />
        <StatsCard title="Due for Review" value={dueWordsCount} description="Words ready for practice" icon={<RefreshCw className="h-6 w-6" />} />
        <StatsCard
          title="Current Streak"
          value={streakCount > 0 ? `🔥 ${streakCount}` : '—'}
          description="Days in a row"
          icon={<Sparkles className="h-6 w-6" />}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Choose Your Level</h2>
          <Link to="/stats">
            <Button variant="ghost" size="sm">
              View all stats →
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEVEL_CONFIGS.map(config => {
            const stats = getLevelStats(config);
            return (
              <LevelCard
                key={config.level}
                config={config}
                completedParts={stats.completedParts}
                totalParts={stats.totalParts}
                totalWords={stats.totalWords}
                completedWords={stats.completedWords}
              />
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🧠 How Learnglish Works</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</div>
            <h4 className="font-medium">Active Recall</h4>
            <p className="text-sm text-muted-foreground">
              You write the answer before seeing it. This forces your brain to retrieve information, strengthening memory.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</div>
            <h4 className="font-medium">Spaced Repetition</h4>
            <p className="text-sm text-muted-foreground">Words you know are shown less frequently. Words you struggle with appear more often.</p>
          </div>
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">3</div>
            <h4 className="font-medium">Context Learning</h4>
            <p className="text-sm text-muted-foreground">
              Every word comes with 10 example sentences, from simple to complex, for deeper understanding.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
