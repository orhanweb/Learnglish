// src/components/quiz/QuizQuestion.tsx

import { Badge } from '@/components/ui';
import type { QuizDirection, Word } from '@/types';

interface QuizQuestionProps {
  word: Word;
  direction: QuizDirection;
  currentIndex: number;
  totalWords: number;
}

export function QuizQuestion({ word, direction, currentIndex, totalWords }: QuizQuestionProps) {
  return (
    <div className="flex flex-col items-center space-y-6 animate-scale-in">
      {/* Progress indicator */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {currentIndex + 1} / {totalWords}
        </span>
        <Badge variant="outline" className="capitalize">
          {direction === 'recognition' ? 'EN → TR' : 'TR → EN'}
        </Badge>
      </div>

      {/* Question */}
      <div className="text-center space-y-3">
        {direction === 'recognition' ? (
          <>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{word.wordEn.join(', ')}</h2>
            <Badge variant="secondary" className="text-sm">
              {word.partOfSpeech}
            </Badge>
          </>
        ) : (
          <>
            <p className="text-lg text-muted-foreground">What is the English word for:</p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{word.wordTr.join(', ')}</h2>
          </>
        )}
      </div>

      {/* Instruction */}
      <p className="text-sm text-muted-foreground">{direction === 'recognition' ? 'Type the Turkish meaning' : 'Type the English word'}</p>
    </div>
  );
}
