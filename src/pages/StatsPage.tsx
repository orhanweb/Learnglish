// src/pages/StatsPage.tsx

import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, Target, Clock, TrendingUp, Calendar } from 'lucide-react';
import { Card, Progress, LoadingState } from '@/components/ui';
import { StatsCard } from '@/components/progress';
import { useProgressStore, useSettingsStore } from '@/stores';
import { isWordMasteredForMode } from '@/lib/spaced-repetition';
import { getTotalWordCount } from '@/data/words';
import { calculateProgressStatistics } from '@/lib/progress-statistics';

export function StatsPage() {
  const { wordProgressMap, getTodayStats, dueWordsCount, isLoading } = useProgressStore();
  const { quizMode } = useSettingsStore();
  const [totalWords, setTotalWords] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const wordCount = await getTotalWordCount();
      if (!cancelled) {
        setTotalWords(wordCount);
        setIsDataLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayStats = getTodayStats();
  const progressValues = Array.from(wordProgressMap.values());
  const statistics = calculateProgressStatistics(progressValues, todayStats);
  const masteredWords = progressValues.filter(progress => isWordMasteredForMode(progress, quizMode)).length;

  if (isLoading || isDataLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">Track your learning progress</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Words Practiced"
          value={statistics.totalWordsPracticed}
          description={`Out of ${totalWords} total words`}
          icon={<BookOpen className="h-6 w-6" />}
        />
        <StatsCard title="Words Mastered" value={masteredWords} description="Full mastery achieved" icon={<Target className="h-6 w-6" />} />
        <StatsCard
          title="Overall Accuracy"
          value={statistics.overallAccuracy === null ? '—' : `${statistics.overallAccuracy}%`}
          description={`${statistics.totalCorrectAnswers} correct, ${statistics.totalIncorrectAnswers} incorrect`}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatsCard title="Due for Review" value={dueWordsCount} description="Words to practice today" icon={<Calendar className="h-6 w-6" />} />
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Summary
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Unique Words Practiced</p>
            <p className="text-3xl font-bold">{statistics.wordsPracticedToday}</p>
            <p className="text-sm text-muted-foreground">{statistics.todayAnswers} answers submitted</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Correct Answers</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-success">{todayStats.correctAnswers}</p>
              <span className="text-muted-foreground">/ {statistics.todayAnswers}</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Today's Accuracy</p>
            <p className="text-3xl font-bold">
              {statistics.todayAccuracy === null ? '—' : `${statistics.todayAccuracy}%`}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Overall Progress
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Words Practiced</span>
              <span className="font-medium">
                {statistics.totalWordsPracticed} / {totalWords}
              </span>
            </div>
            <Progress value={statistics.totalWordsPracticed} max={Math.max(totalWords, 1)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Words Mastered</span>
              <span className="font-medium">
                {masteredWords} / {statistics.totalWordsPracticed || 1}
              </span>
            </div>
            <Progress value={masteredWords} max={Math.max(statistics.totalWordsPracticed, 1)} variant="success" />
          </div>
        </div>
      </Card>

      {statistics.totalWordsPracticed === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>No learning data yet. Start a quiz to see your statistics!</p>
        </div>
      )}
    </div>
  );
}
