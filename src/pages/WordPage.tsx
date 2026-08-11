// src/pages/WordPage.tsx

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { Button, Badge, Card, EmptyState, LoadingState } from '@/components/ui';
import { SentenceList, SynonymLinks } from '@/components/word';
import { useSettingsStore } from '@/stores';
import { getWordById } from '@/data/words';
import { levelVariants } from '@/lib/level-variants';
import type { Word } from '@/types';

export function WordPage() {
  const { id } = useParams<{ id: string }>();
  const { showTranslationsAlways } = useSettingsStore();
  const [word, setWord] = useState<Word | undefined>(undefined);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getWordById(id || '');
      setWord(data);
      setIsDataLoading(false);
    }
    load();
  }, [id]);

  if (isDataLoading) {
    return <LoadingState />;
  }

  if (!word) {
    return (
      <EmptyState
        title="Word not found"
        action={
          <Link to="/">
            <Button>Go back home</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/level/${word.level}/part/${word.partNumber}`}>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <span className="text-muted-foreground">Back to part {word.partNumber}</span>
      </div>

      {/* Word header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold">{word.wordEn.join(', ')}</h1>
              <Badge variant="secondary" className="text-sm">
                {word.partOfSpeech}
              </Badge>
            </div>
            <p className="text-xl text-primary font-medium">{word.wordTr.join(', ')}</p>
          </div>
          <Badge variant={levelVariants[word.level]}>{word.level}</Badge>
        </div>
      </div>

      {/* Definition */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground mt-1" />
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">English</p>
              <p className="leading-relaxed">{word.definitionEn}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Türkçe</p>
              <p className="leading-relaxed text-muted-foreground">{word.definitionTr}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Example sentences */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Example Sentences</h2>
        <SentenceList sentences={word.examples} showTranslationsAlways={showTranslationsAlways} highlightWord={word.wordEn[0]} />
      </div>

      {/* Synonyms */}
      {word.synonyms && word.synonyms.length > 0 && (
        <Card className="p-4">
          <SynonymLinks synonymIds={word.synonyms} />
        </Card>
      )}
    </div>
  );
}
