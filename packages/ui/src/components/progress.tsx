import { cn } from '../cn.ts';

const bar = {
  accent: 'bg-accent',
  algebra: 'bg-algebra',
  geometry: 'bg-geometry',
  physics: 'bg-physics',
  success: 'bg-success',
} as const;

export interface ProgressProps {
  value: number;
  max?: number;
  tone?: keyof typeof bar;
  /** Accessible name, e.g. the topic title. */
  label: string;
  className?: string;
}

/** Thin progress bar; colour follows the subject. */
export function Progress({ value, max = 100, tone = 'accent', label, className }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (100 * value) / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <div className={cn('h-full rounded-full', bar[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
