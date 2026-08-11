// src/pages/PartPage.tsx

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Play } from 'lucide-react';
import { Button, Badge, EmptyState, LoadingState } from '@/components/ui';
import { WordCardCompact } from '@/components/word';
import type { Level, Part } from '@/types';
import { getPart } from '@/data/words';
import { levelVariants } from '@/lib/level-variants';

export function PartPage() {
  const { level, partNumber } = useParams<{ level: string; partNumber: string }>();
  const navigate = useNavigate();
  const levelKey = (level?.toUpperCase() as Level | undefined) ?? 'A1';
  const [part, setPart] = useState<Part | undefined>(undefined);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getPart(levelKey, parseInt(partNumber || '1', 10));
      setPart(data);
      setIsDataLoading(false);
    }
    load();
  }, [levelKey, partNumber]);

  if (isDataLoading) {
    return <LoadingState />;
  }

  if (!part) {
    return (
      <EmptyState
        title="Part not found"
        action={
          <Link to={`/level/${level}`}>
            <Button>Go back to level</Button>
          </Link>
        }
      />
    );
  }

  const handleStartQuiz = () => {
    navigate(`/quiz/${level}/${partNumber}`);
  };

  const handleWordClick = (wordId: string) => {
    navigate(`/word/${wordId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/level/${level}`}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant={levelVariants[levelKey]} className="text-lg px-3 py-1">
              {levelKey}
            </Badge>
            <div>
              <h1 className="text-2xl font-bold">Part {partNumber}</h1>
              <p className="text-muted-foreground">{part.words.length} words to learn</p>
            </div>
          </div>
        </div>

        <Button onClick={handleStartQuiz} size="lg" className="gap-2">
          <Play className="h-5 w-5" />
          Start Quiz
        </Button>
      </div>

      {/* Word list */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-muted-foreground">Words in this part</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {part.words.map((word, index) => (
            <WordCardCompact key={word.id} word={word} index={index} onClick={() => handleWordClick(word.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
