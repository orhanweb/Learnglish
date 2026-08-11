// src/components/ui/progress.tsx

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, max = 100, variant = 'default', ...props }, ref) => {
  const safeMax = max > 0 ? max : 1;
  const percentage = Math.min(Math.max((value / safeMax) * 100, 0), 100);

  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive'
  };

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div className={cn('h-full transition-all duration-300 ease-out', variantClasses[variant])} style={{ width: `${percentage}%` }} />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
