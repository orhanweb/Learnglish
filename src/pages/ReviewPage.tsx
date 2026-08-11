// src/pages/ReviewPage.tsx

import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import { Button, Card, LoadingState, EmptyState } from '@/components/ui';
import { useDueWords } from '@/hooks/useDueWords';

export function ReviewPage() {
  const { entries: dueWords, isLoading, refresh } = useDueWords();

  const dueWordsTotal = dueWords.length;

  if (isLoading) {
    return <LoadingState />;
  }

  if (dueWordsTotal === 0) {
    return (
      <EmptyState
        className="max-w-md mx-auto py-16"
        title="All caught up!"
        description="You have no words due for review. Great job keeping up with your practice!"
        icon={<CheckCircle className="h-10 w-10 text-success" />}
        iconContainerClassName="bg-success/10"
        action={
          <Link to="/">
            <Button size="lg" className="gap-2">
              Learn New Words
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />
    );
  }

  // Group due words by level
  const wordsByLevel = dueWords.reduce(
    (acc, item) => {
      if (!item.word) return acc;
      const level = item.word.level;
      if (!acc[level]) acc[level] = [];
      acc[level].push(item);
      return acc;
    },
    {} as Record<string, typeof dueWords>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review</h1>
          <p className="text-muted-foreground">{dueWordsTotal} words are ready for review</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/review/quiz">
            <Button className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Start Review Quiz
            </Button>
          </Link>
          <Button onClick={refresh} variant="outline" size="icon" aria-label="Refresh review list">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Review cards by level */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(wordsByLevel).map(([level, words]) => (
          <Card key={level} className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{level}</h3>
              <span className="text-2xl font-bold text-primary">{words.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {words.length} word{words.length !== 1 ? 's' : ''} to review
            </p>
            <Link to={`/review/${level}`}>
              <Button className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Start Review
              </Button>
            </Link>
          </Card>
        ))}
      </div>

      {/* All words quick view */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Words Due Today</h3>
        <div className="flex flex-wrap gap-2">
          {dueWords.slice(0, 20).map(({ word }) =>
            word ? (
              <Link key={word.id} to={`/word/${word.id}`}>
                <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm hover:bg-accent transition-colors">
                  {word.wordEn.join(', ')}
                </span>
              </Link>
            ) : null
          )}
          {dueWords.length > 20 && (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              +{dueWords.length - 20} more
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
