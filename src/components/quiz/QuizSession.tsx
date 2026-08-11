// src/components/quiz/QuizSession.tsx

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button, Dialog, EmptyState, Input, Progress } from '@/components/ui';
import { QuizQuestion } from './QuizQuestion';
import { QuizResult } from './QuizResult';
import { QuizComplete } from './QuizComplete';
import { useProgressStore, useQuizStore, useSettingsStore } from '@/stores';
import type { QuizItem, Word } from '@/types';

interface QuizSessionBaseProps {
  exitTo: string;
  emptyMessage?: string;
  onAfterAnswer?: (word: Word) => Promise<void> | void;
}

type QuizSessionProps = QuizSessionBaseProps &
  ({ words: Word[]; reviewItems?: never } | { words?: never; reviewItems: QuizItem[] });

export function QuizSession({ words, reviewItems, exitTo, emptyMessage = 'Quiz not found', onAfterAnswer }: QuizSessionProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const submissionLockRef = useRef(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const {
    initQuiz,
    initReviewQuiz,
    currentIndex,
    currentDirection,
    phase,
    userAnswer,
    isCorrect,
    correctCount,
    incorrectCount,
    showComplete,
    setShowComplete,
    setUserAnswer,
    submitAnswer,
    rollbackAnswerSubmission,
    nextWord,
    getCurrentWord,
    getProgress,
    isQuizComplete,
    resetQuiz
  } = useQuizStore();

  const { quizMode, shuffleQuizOrder, tolerateTypos, showTranslationsAlways } = useSettingsStore();
  const { recordQuizAnswer } = useProgressStore();

  const itemCount = reviewItems?.length ?? words?.length ?? 0;
  const hasItems = itemCount > 0;
  const currentWord = getCurrentWord();
  const progress = getProgress();
  const isQuizActive = hasItems && !showComplete;
  const blocker = useBlocker(isQuizActive);

  // Re-initialise the quiz only when its source and options change.
  const initKey = useMemo(() => {
    if (!hasItems) return '';
    const sourceKey = reviewItems
      ? reviewItems.map(item => `${item.word.id}:${item.direction}`).join('|')
      : (words ?? []).map(word => word.id).join('|');
    const modeKey = reviewItems ? 'review' : quizMode;
    return `${sourceKey}:${modeKey}:${shuffleQuizOrder ? 'shuffle' : 'ordered'}:${tolerateTypos ? 'typos' : 'strict'}`;
  }, [hasItems, words, reviewItems, quizMode, shuffleQuizOrder, tolerateTypos]);

  const lastInitKeyRef = useRef<string>('');

  useEffect(() => {
    if (!hasItems || !initKey) return;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;
    if (reviewItems) {
      initReviewQuiz(reviewItems, shuffleQuizOrder, tolerateTypos);
      return;
    }
    if (words) {
      initQuiz(words, quizMode, shuffleQuizOrder, tolerateTypos);
    }
  }, [hasItems, initKey, words, reviewItems, quizMode, shuffleQuizOrder, tolerateTypos, initQuiz, initReviewQuiz]);

  useEffect(() => {
    if (phase === 'question' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, currentIndex]);

  const showLeaveDialog = blocker.state === 'blocked';

  useEffect(() => {
    if (!isQuizActive) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isQuizActive]);

  const confirmLeave = () => {
    resetQuiz();
    if (blocker.state === 'blocked') blocker.proceed();
  };

  const cancelLeave = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };

  const handleSubmit = async () => {
    if (submissionLockRef.current) return;

    submissionLockRef.current = true;
    let submissionId: number | null = null;

    try {
      const submission = submitAnswer();
      if (!submission) return;

      submissionId = submission.submissionId;
      setSubmissionError(null);
      setIsSavingAnswer(true);
      await recordQuizAnswer(submission.word.id, submission.direction, submission.isCorrect);

      if (onAfterAnswer) {
        try {
          await onAfterAnswer(submission.word);
        } catch (error) {
          console.error('Failed to refresh part progress:', error);
        }
      }
    } catch (error) {
      console.error('Failed to save quiz answer:', error);
      if (submissionId !== null) rollbackAnswerSubmission(submissionId);
      setSubmissionError('Your answer could not be saved. Please try again.');
    } finally {
      setIsSavingAnswer(false);
      submissionLockRef.current = false;
    }
  };

  const handleNext = () => {
    if (submissionLockRef.current || isSavingAnswer) return;
    if (isQuizComplete()) {
      setShowComplete(true);
    } else {
      nextWord();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (phase === 'question') {
        void handleSubmit();
      } else {
        handleNext();
      }
    }
  };

  const handleRetry = () => {
    setShowComplete(false);
    if (reviewItems) {
      initReviewQuiz(reviewItems, shuffleQuizOrder, tolerateTypos);
    } else if (words) {
      initQuiz(words, quizMode, shuffleQuizOrder, tolerateTypos);
    }
  };

  const handleExit = () => {
    navigate(exitTo);
  };

  const emptyState = useMemo(
    () => (
      <EmptyState
        title={emptyMessage}
        action={
          <Link to={exitTo}>
            <Button>Go back</Button>
          </Link>
        }
      />
    ),
    [emptyMessage, exitTo]
  );

  if (!hasItems || !currentWord) {
    return emptyState;
  }

  if (showComplete) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <QuizComplete correctCount={correctCount} incorrectCount={incorrectCount} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleExit} aria-label="Exit quiz">
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1 mx-4">
            <Progress value={progress.current} max={progress.total} className="h-2" />
          </div>
          <span className="text-sm text-muted-foreground">
            {progress.current}/{progress.total}
          </span>
        </div>

        <div className="py-8">
          {phase === 'question' ? (
            <div className="space-y-8">
              <QuizQuestion word={currentWord} direction={currentDirection} currentIndex={currentIndex} totalWords={progress.total} />

              <div className="max-w-md mx-auto space-y-4">
                <Input
                  ref={inputRef}
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSavingAnswer}
                  placeholder={currentDirection === 'recognition' ? 'Write Turkish meaning...' : 'Write English meaning ...'}
                  className="text-center text-lg h-14"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <Button onClick={() => void handleSubmit()} size="lg" className="w-full" disabled={!userAnswer.trim() || isSavingAnswer}>
                  Check Answer
                </Button>
                {submissionError && (
                  <p role="alert" className="text-sm text-center text-destructive">
                    {submissionError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <QuizResult
              word={currentWord}
              userAnswer={userAnswer}
              isCorrect={isCorrect ?? false}
              showTranslationsAlways={showTranslationsAlways}
              direction={currentDirection}
              isLastWord={isQuizComplete()}
              isSaving={isSavingAnswer}
              onNext={handleNext}
            />
          )}
        </div>
      </div>

      <Dialog open={showLeaveDialog} onOpenChange={open => (open ? null : cancelLeave())} preventClose hideCloseButton className="max-w-md">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Leave quiz?</h2>
          <p className="text-muted-foreground">Your current quiz will be discarded. Already-answered words have been saved.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={cancelLeave}>
              Stay
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Leave
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
