// src/components/ui/dialog.tsx

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  className?: string;
  preventClose?: boolean;
  hideCloseButton?: boolean;
}

export function Dialog({ open, onOpenChange, children, className, preventClose = false, hideCloseButton = false }: DialogProps) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!preventClose) onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange, preventClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !preventClose && onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative z-10 w-full max-w-3xl rounded-2xl border bg-card p-6 text-card-foreground shadow-xl', className)}
      >
        {!preventClose && !hideCloseButton && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            className="absolute right-10 top-4 rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
