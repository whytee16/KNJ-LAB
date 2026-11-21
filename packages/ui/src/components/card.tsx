import type { HTMLAttributes } from 'react';
import { cn } from '../cn.ts';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface p-6 shadow-card', className)}
      {...props}
    />
  );
}
