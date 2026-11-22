'use client';

import { cn } from '../../cn.ts';

/** "3D / 2D" segmented switch for the workspace header. */
export function ViewToggle({
  view,
  canUse3d,
  onChange,
  label,
}: {
  view: '3d' | '2d';
  canUse3d: boolean;
  onChange: (view: '3d' | '2d') => void;
  label: string;
}) {
  const item = (v: '3d' | '2d', text: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      disabled={v === '3d' && !canUse3d}
      onClick={() => onChange(v)}
      className={cn(
        'min-h-11 min-w-12 px-3 text-sm font-medium disabled:opacity-40',
        view === v ? 'bg-text text-bg' : 'text-text-muted hover:bg-surface-muted',
      )}
    >
      {text}
    </button>
  );
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-border"
    >
      {item('3d', '3D')}
      {item('2d', '2D')}
    </div>
  );
}
