'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '../cn.ts';

/**
 * Lab frame: header, workspace and a parameter panel. Desktop — panel on the right;
 * mobile — workspace on top and the panel as a collapsible bottom sheet.
 */
export function GameLayout({
  header,
  workspace,
  panel,
  panelTitle,
  showPanelLabel,
  hidePanelLabel,
  children,
}: {
  header: ReactNode;
  workspace: ReactNode;
  panel: ReactNode;
  panelTitle: string;
  showPanelLabel: string;
  hidePanelLabel: string;
  /** Content below the lab (instructions, questions, navigation). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  return (
    <div className="pb-20 lg:pb-0">
      {header}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0">{workspace}</div>
        <aside
          aria-label={panelTitle}
          className={cn(
            'fixed inset-x-0 bottom-0 z-30 flex max-h-[55svh] flex-col rounded-t-lg border-t border-border bg-surface shadow-card',
            'lg:sticky lg:top-4 lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-lg lg:border',
          )}
        >
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 lg:pt-2">
            <h2 className="font-semibold">{panelTitle}</h2>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              className="min-h-11 rounded-md px-3 text-sm text-text-muted hover:bg-surface-muted lg:hidden"
            >
              {open ? hidePanelLabel : showPanelLabel}
            </button>
          </div>
          <div
            id={panelId}
            className={cn('overflow-y-auto px-4 pb-4', open ? 'block' : 'hidden lg:block')}
          >
            {panel}
          </div>
        </aside>
      </div>
      {children ? <div className="mt-10 flex flex-col gap-10">{children}</div> : null}
    </div>
  );
}

export function GameHeader({
  title,
  subject,
  meta,
  badge,
  exit,
}: {
  title: string;
  subject: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  exit?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          {subject}
          {meta}
          {badge}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight break-words">{title}</h1>
      </div>
      {exit ? <div className="shrink-0">{exit}</div> : null}
    </header>
  );
}

export function GameInstructions({
  title,
  goalLabel,
  goal,
  stepsLabel,
  steps,
  assumptionsLabel,
  assumptions,
}: {
  title: string;
  goalLabel: string;
  goal: string;
  stepsLabel: string;
  steps: string[];
  assumptionsLabel: string;
  assumptions: string[];
}) {
  return (
    <section aria-labelledby="lab-instructions" className="max-w-3xl">
      <h2 id="lab-instructions" className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <dl className="mt-4 flex flex-col gap-4">
        <div>
          <dt className="font-medium">{goalLabel}</dt>
          <dd className="mt-1 text-text-muted">{goal}</dd>
        </div>
        {steps.length ? (
          <div>
            <dt className="font-medium">{stepsLabel}</dt>
            <dd className="mt-1">
              <ol className="list-decimal pl-5 text-text-muted">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium">{assumptionsLabel}</dt>
          <dd className="mt-1">
            <ul className="list-disc pl-5 text-text-muted">
              {assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function GameHints({ title, hints }: { title: string; hints: string[] }) {
  if (!hints.length) return null;
  return (
    <section aria-labelledby="lab-hints" className="max-w-3xl">
      <h2 id="lab-hints" className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {hints.map((h, i) => (
          <details key={i} className="rounded-md border border-border bg-surface px-4 py-2">
            <summary className="min-h-9 cursor-pointer py-1 font-medium">
              {title} {i + 1}
            </summary>
            <p className="pb-2 text-text-muted">{h}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function GameNavigation({ children }: { children: ReactNode }) {
  return (
    <nav className="flex flex-wrap gap-3 border-t border-border pt-6" aria-label="lab">
      {children}
    </nav>
  );
}
