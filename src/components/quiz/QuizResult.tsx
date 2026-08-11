// src/components/quiz/QuizResult.tsx

import { CheckCircle, XCircle, BookOpen, ArrowRight } from 'lucide-react';
import type { QuizDirection, Word } from '@/types';
import { Button, Badge, Card } from '@/components/ui';
import { SentenceList } from '@/components/word/SentenceList';
import { SynonymLinks } from '@/components/word/SynonymLinks';
import { cn } from '@/lib/utils';

interface QuizResultProps {
  word: Word;
  userAnswer: string;
  isCorrect: boolean;
  showTranslationsAlways: boolean;
  direction: QuizDirection;
  isLastWord: boolean;
  isSaving: boolean;
  onNext: () => void;
}

export function QuizResult({ word, userAnswer, isCorrect, showTranslationsAlways, direction, isLastWord, isSaving, onNext }: QuizResultProps) {
  const isRecognition = direction === 'recognition';
  const correctAnswer = isRecognition ? word.wordTr.join(', ') : word.wordEn.join(', ');
  const promptText = isRecognition ? word.wordEn.join(', ') : word.wordTr.join(', ');
  const definitionPrimary = isRecognition ? word.definitionEn : word.definitionTr;
  const definitionSecondary = isRecognition ? word.definitionTr : word.definitionEn;
  const highlightWord = isRecognition ? word.wordEn[0] : word.wordTr[0];

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Result header */}
      <div
        className={cn(
          'flex items-center justify-center gap-3 rounded-xl p-4',
          isCorrect ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        )}
      >
        {isCorrect ? <CheckCircle className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        <span className="text-2xl font-bold">{isCorrect ? 'Correct!' : 'Incorrect'}</span>
      </div>

      {/* Answer comparison */}
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Your answer</p>
            <p className={cn('font-medium', isCorrect ? 'text-success' : 'text-destructive')}>{userAnswer || '(empty)'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Correct answer</p>
            <p className="font-medium">{correctAnswer}</p>
          </div>
        </div>

        {/* Prompt recap */}
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold">{promptText}</h3>
            {isRecognition && <Badge variant="secondary">{word.partOfSpeech}</Badge>}
          </div>
        </div>
      </Card>

      {/* Definition */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">{definitionPrimary}</p>
            <p className="text-sm text-muted-foreground">{definitionSecondary}</p>
          </div>
        </div>
      </Card>

      {/* Example sentences */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Example Sentences</h4>
        <SentenceList sentences={word.examples} showTranslationsAlways={showTranslationsAlways} direction={direction} highlightWord={highlightWord} />
      </div>

      {/* Synonyms */}
      {word.synonyms && word.synonyms.length > 0 && <SynonymLinks synonymIds={word.synonyms} />}

      {/* Next button */}
      <Button onClick={onNext} size="lg" className="w-full gap-2" disabled={isSaving}>
        {isSaving ? 'Saving...' : isLastWord ? 'View Results' : 'Next Word'}
        {!isSaving && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
