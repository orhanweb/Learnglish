// src/components/progress/StatsCard.tsx

import type { ReactNode } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, description, icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <span className={cn('text-sm font-medium', trend.isPositive ? 'text-success' : 'text-destructive')}>
                {trend.isPositive ? '+' : '-'}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {icon && <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>}
      </div>
    </Card>
  );
}
