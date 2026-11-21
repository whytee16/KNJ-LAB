import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../cn.ts';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-text-muted',
        accent: 'bg-accent/10 text-accent',
        algebra: 'bg-algebra/10 text-algebra',
        geometry: 'bg-geometry/10 text-geometry',
        physics: 'bg-physics/10 text-physics',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
