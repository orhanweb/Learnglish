// src/components/ui/loading.tsx

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks';

interface LoadingProps {
  messages?: string[];
  className?: string;
}

export function LoadingState({ messages = ['Loading...'], className }: LoadingProps) {
  useScrollLock(true);

  return (
    <div className={cn('fixed h-dvh w-dvw z-100 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm', className)}>
      <div className="flex flex-col items-center gap-4 p-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <div className="flex flex-col items-center gap-1">
          {messages.map((msg, i) => (
            <span key={i} className="text-lg font-medium text-foreground/80">
              {msg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
