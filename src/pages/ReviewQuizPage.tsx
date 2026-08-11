// src/pages/ReviewQuizPage.tsx

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, LoadingState, EmptyState } from '@/components/ui';
import { QuizSession } from '@/components/quiz';
import { useProgressStore, useSettingsStore } from '@/stores';
import { useDueWords } from '@/hooks/useDueWords';
import { getDueDirections } from '@/lib/spaced-repetition';
import type { Level, QuizItem, Word } from '@/types';

export function ReviewQuizPage() {
  const { level } = useParams<{ level?: string }>();
  const { syncPartCompletion } = useProgressStore();
  const { quizMode } = useSettingsStore();

  const levelKey = level?.toUpperCase() as Level | undefined;
  const exitTo = levelKey ? `/review/${levelKey}` : '/review';

  const { filteredEntries: reviewEntries, isLoading } = useDueWords({ level: levelKey });

  const reviewItems = useMemo<QuizItem[]>(
    () =>
      reviewEntries.flatMap(({ progress, word }) =>
        getDueDirections(progress).map(direction => ({
          word,
          direction
        }))
      ),
    [reviewEntries]
  );

  const emptyState = useMemo(
    () => (
      <EmptyState
        title="No words to review"
        action={
          <Link to={exitTo}>
            <Button>Go back to review</Button>
          </Link>
        }
      />
    ),
    [exitTo]
  );

  const handleAfterAnswer = async (word: Word) => {
    await syncPartCompletion(word.level, word.partNumber, quizMode);
  };

  if (isLoading) {
    return <LoadingState messages={['Loading review quiz...']} />;
  }

  if (reviewItems.length === 0) {
    return emptyState;
  }

  return <QuizSession reviewItems={reviewItems} exitTo={exitTo} onAfterAnswer={handleAfterAnswer} emptyMessage="No review quiz available" />;
}
