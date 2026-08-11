// src/components/ui/badge.tsx

import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        success: 'bg-success text-success-foreground',
        warning: 'bg-warning text-warning-foreground',
        outline: 'border text-foreground',
        // Level-specific badges
        a1: 'bg-level-a1/20 text-level-a1 border border-level-a1/30',
        a2: 'bg-level-a2/20 text-level-a2 border border-level-a2/30',
        b1: 'bg-level-b1/20 text-level-b1 border border-level-b1/30',
        b2: 'bg-level-b2/20 text-level-b2 border border-level-b2/30',
        c1: 'bg-level-c1/20 text-level-c1 border border-level-c1/30'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});
Badge.displayName = 'Badge';

export { Badge };
