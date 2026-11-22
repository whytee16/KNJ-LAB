import type { ReactNode } from 'react';
import { cn } from '../cn.ts';

export interface Readout {
  id: string;
  label: string;
  symbol: string;
  value: string;
  unit: string;
}

/** Instrument readings; announced politely to screen readers when they change. */
export function GameReadouts({ title, items }: { title: string; items: Readout[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-text-muted">{title}</h3>
      <dl aria-live="polite" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((r) => (
          <div
            key={r.id}
            data-testid={`readout-${r.id}`}
            className="rounded-md border border-border bg-surface-muted px-3 py-2"
          >
            <dt className="text-xs text-text-muted">
              {r.label} <span className="italic">{r.symbol}</span>
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {r.value} <span className="text-sm font-normal text-text-muted">{r.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type Tone = 'correct' | 'wrong';

/** Result of a check: status colour + icon + text (never colour alone). */
export function GameFeedback({
  status,
  title,
  children,
}: {
  status: Tone;
  title: string;
  children?: ReactNode;
}) {
  const ok = status === 'correct';
  return (
    <div
      role="status"
      className={cn(
        'flex gap-3 rounded-md border px-4 py-3',
        ok ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10',
      )}
    >
      <span aria-hidden className={cn('text-xl leading-6', ok ? 'text-success' : 'text-danger')}>
        {ok ? '✓' : '✗'}
      </span>
      <div className="min-w-0">
        <p className={cn('font-semibold', ok ? 'text-success' : 'text-danger')}>{title}</p>
        {children ? <div className="mt-1 text-sm">{children}</div> : null}
      </div>
    </div>
  );
}

export function GameProgress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-text-muted">
          {done} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GameResults({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="lab-results"
      className="rounded-lg border border-border bg-surface p-5 shadow-card"
    >
      <h2 id="lab-results" className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
