import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../cn.ts';

export const alertVariants = cva('rounded-md border px-4 py-3 text-sm', {
  variants: {
    tone: {
      error: 'border-danger/40 bg-danger/10 text-danger',
      success: 'border-success/40 bg-success/10 text-success',
      info: 'border-border bg-surface-muted text-text',
      warning: 'border-warning/40 bg-warning/10 text-warning',
    },
  },
  defaultVariants: { tone: 'info' },
});

export type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

/** Status message; errors are announced immediately, others politely. */
export function Alert({ className, tone, ...props }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
