'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn.ts';

/** Simulation area with an optional full-screen mode (when the browser allows it). */
export function GameWorkspace({
  label,
  fullscreenLabel,
  exitFullscreenLabel,
  children,
  className,
}: {
  label: string;
  fullscreenLabel: string;
  exitFullscreenLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const onChange = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen();
  };

  return (
    <section
      ref={ref}
      aria-label={label}
      className={cn(
        'relative flex flex-col gap-4 rounded-lg border border-border bg-surface p-3 sm:p-4',
        full && 'overflow-y-auto bg-bg p-6',
        className,
      )}
    >
      {canFullscreen ? (
        <button
          type="button"
          onClick={toggle}
          className="absolute top-2 right-2 z-10 min-h-11 rounded-md px-3 text-sm text-text-muted hover:bg-surface-muted"
        >
          {full ? exitFullscreenLabel : fullscreenLabel}
        </button>
      ) : null}
      {children}
    </section>
  );
}
