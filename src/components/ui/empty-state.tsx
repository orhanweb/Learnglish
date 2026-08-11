// src/components/ui/empty-state.tsx

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  iconContainerClassName?: string;
}

export function EmptyState({ title, description, action, icon, className, iconContainerClassName }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12 space-y-6', className)}>
      {icon ? (
        <div className={cn('mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted/60', iconContainerClassName)}>{icon}</div>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
