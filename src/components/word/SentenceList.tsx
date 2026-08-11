// src/components/word/SentenceList.tsx

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ExampleSentence } from '@/types';
import { cn } from '@/lib/utils';

interface SentenceListProps {
  sentences: ExampleSentence[];
  showTranslationsAlways: boolean;
  direction?: 'recognition' | 'production';
  highlightWord?: string;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function SentenceList({ sentences, showTranslationsAlways, direction = 'recognition', highlightWord }: SentenceListProps) {
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());
  const highlightRegex = useMemo(() => {
    if (!highlightWord) return null;
    return new RegExp(`(${escapeRegex(highlightWord)})`, 'gi');
  }, [highlightWord]);

  const toggleSentence = (index: number) => {
    if (showTranslationsAlways) return;

    const newSet = new Set(expandedIndexes);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedIndexes(newSet);
  };

  const highlightText = (text: string) => {
    if (!highlightRegex) return text;

    const parts = text.split(highlightRegex);

    return parts.map((part, i) =>
      part.toLowerCase() === highlightWord?.toLowerCase() ? (
        <span key={i} className="font-semibold text-primary">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-2">
      {sentences.map((sentence, index) => {
        const isExpanded = showTranslationsAlways || expandedIndexes.has(index);

        return (
          <div
            key={index}
            onClick={() => toggleSentence(index)}
            className={cn(
              'group rounded-lg border bg-card p-3 transition-all duration-200',
              !showTranslationsAlways && 'cursor-pointer hover:border-primary/30 hover:bg-accent/50'
            )}
          >
            <div className="flex items-start gap-2">
              {!showTranslationsAlways && (
                <ChevronRight
                  className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-90')}
                />
              )}
              <div className="flex-1 space-y-1">
                <p className="text-sm leading-relaxed">
                  {highlightWord
                    ? highlightText(direction === 'production' ? sentence.tr : sentence.en)
                    : direction === 'production'
                      ? sentence.tr
                      : sentence.en}
                </p>
                {isExpanded && (
                  <p className="text-sm text-muted-foreground animate-fade-in">→ {direction === 'production' ? sentence.en : sentence.tr}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {sentence.level}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
