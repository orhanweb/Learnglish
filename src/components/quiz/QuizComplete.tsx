// src/components/quiz/QuizComplete.tsx

import { Trophy, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';

interface QuizCompleteProps {
  correctCount: number;
  incorrectCount: number;
  onRetry: () => void;
}

export function QuizComplete({ correctCount, incorrectCount, onRetry }: QuizCompleteProps) {
  const total = correctCount + incorrectCount;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const getGrade = () => {
    if (percentage >= 90) return { label: 'Excellent!', emoji: '🌟', color: 'text-success' };
    if (percentage >= 70) return { label: 'Good job!', emoji: '👍', color: 'text-primary' };
    if (percentage >= 50) return { label: 'Keep practicing!', emoji: '💪', color: 'text-warning' };
    return { label: 'Need more practice', emoji: '📚', color: 'text-destructive' };
  };

  const grade = getGrade();

  return (
    <div className="mx-auto max-w-md space-y-6 animate-[scale-in_0.3s_ease-out]">
      {/* Trophy header */}
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-3xl font-bold">Quiz Complete!</h2>
          <p className={cn('text-xl mt-1', grade.color)}>
            {grade.emoji} {grade.label}
          </p>
        </div>
      </div>

      {/* Score card */}
      <Card className="p-6 space-y-4">
        <div className="text-center">
          <div className="text-5xl font-bold">{percentage}%</div>
          <p className="text-muted-foreground mt-1">Accuracy</p>
        </div>

        <Progress
          value={correctCount}
          max={total}
          variant={percentage >= 70 ? 'success' : percentage >= 50 ? 'warning' : 'destructive'}
          className="h-3"
        />

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-lg bg-success/10 p-3">
            <div className="text-2xl font-bold text-success">{correctCount}</div>
            <p className="text-sm text-muted-foreground">Correct</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-3">
            <div className="text-2xl font-bold text-destructive">{incorrectCount}</div>
            <p className="text-sm text-muted-foreground">Incorrect</p>
          </div>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <Button onClick={onRetry} size="lg" variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Link to="/">
          <Button size="lg" className="w-full gap-2">
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
