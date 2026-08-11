// src/components/progress/LevelCard.tsx

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { LevelConfig } from '@/types';
import { Card, Badge, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { levelVariants } from '@/lib/level-variants';

interface LevelCardProps {
  config: LevelConfig;
  completedParts: number;
  totalParts: number;
  totalWords: number;
  completedWords: number;
}

const levelGradients: Record<string, string> = {
  A1: 'from-emerald-500/20 to-emerald-600/10',
  A2: 'from-teal-500/20 to-teal-600/10',
  B1: 'from-cyan-500/20 to-cyan-600/10',
  B2: 'from-blue-500/20 to-blue-600/10',
  C1: 'from-violet-500/20 to-violet-600/10'
};

export function LevelCard({ config, completedParts, totalParts, totalWords, completedWords }: LevelCardProps) {
  const progressPercentage = totalWords > 0 ? (completedWords / totalWords) * 100 : 0;

  return (
    <Link to={`/level/${config.level}`}>
      <Card variant="interactive" className={cn('relative overflow-hidden bg-linear-to-br', levelGradients[config.level])}>
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Badge variant={levelVariants[config.level]} className="text-sm font-bold">
                {config.level}
              </Badge>
              <h3 className="text-xl font-bold">{config.name}</h3>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedParts} / {totalParts} parts
              </span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} max={100} />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{totalWords} words</span>
            <span>•</span>
            <span>{completedWords} learned</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
