// src/pages/QuizPage.tsx

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, LoadingState } from '@/components/ui';
import { QuizSession } from '@/components/quiz';
import { useProgressStore, useSettingsStore } from '@/stores';
import { getPart } from '@/data/words';
import type { Level, Part, Word } from '@/types';

export function QuizPage() {
  const { level, partNumber } = useParams<{ level: string; partNumber: string }>();
  const { syncPartCompletion } = useProgressStore();
  const { quizMode } = useSettingsStore();
  const [part, setPart] = useState<Part | undefined>(undefined);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getPart(level as Level, parseInt(partNumber || '1', 10));
      if (!cancelled) {
        setPart(data);
        setIsDataLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [level, partNumber]);

  if (isDataLoading) {
    return <LoadingState />;
  }

  if (!part) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Quiz not found</h2>
        <Link to="/">
          <Button className="mt-4">Go back home</Button>
        </Link>
      </div>
    );
  }

  const handleAfterAnswer = async (word: Word) => {
    if (word.partNumber !== part.partNumber || word.level !== part.level) return;
    await syncPartCompletion(part.level, part.partNumber, quizMode);
  };

  return <QuizSession words={part.words} exitTo={`/level/${level}/part/${partNumber}`} onAfterAnswer={handleAfterAnswer} />;
}
