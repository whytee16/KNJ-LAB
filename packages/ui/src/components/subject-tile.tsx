import type { ReactNode } from 'react';
import { cn } from '../cn.ts';

export type Subject = 'algebra' | 'geometry' | 'physics';

const tone: Record<Subject, string> = {
  algebra: 'border-algebra/25 bg-algebra/[0.09] text-algebra',
  geometry: 'border-geometry/25 bg-geometry/[0.09] text-geometry',
  physics: 'border-physics/25 bg-physics/[0.09] text-physics',
};

// Line icons drawn with the subject colour (currentColor).
const icons: Record<Subject, ReactNode> = {
  algebra: (
    <>
      <path d="M5 35h30M5 35V5" />
      <path d="M8 32C16 30 20 10 34 7" />
    </>
  ),
  geometry: (
    <>
      <path d="M6 34h28L6 8z" />
      <path d="M6 28h6v6" />
    </>
  ),
  physics: (
    <>
      <path d="M6 32h28M6 32 34 14" />
      <path d="m17.5 19.5 7.6-4.9 3.8 5.9-7.6 4.9z" />
    </>
  ),
};

export interface SubjectTileProps {
  subject: Subject;
  title: string;
  meta?: string;
  /** Render as a link when given (plain <a>; wrap app links yourself if routing is needed). */
  href?: string;
  className?: string;
}

/** Subject tile: 9 % tint of the subject colour, a hairline border and a line icon. */
export function SubjectTile({ subject, title, meta, href, className }: SubjectTileProps) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="text-lg font-bold tracking-tight">{title}</span>
        {meta ? <span className="text-sm">{meta}</span> : null}
      </span>
      <svg
        aria-hidden="true"
        width="36"
        height="36"
        viewBox="0 0 40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        className="shrink-0"
      >
        {icons[subject]}
      </svg>
    </>
  );
  const cls = cn(
    'flex items-center justify-between gap-4 rounded-lg border px-5 py-4',
    tone[subject],
    href && 'transition-colors duration-150 hover:border-current',
    className,
  );
  return href ? (
    <a href={href} className={cls} data-subject={subject}>
      {body}
    </a>
  ) : (
    <div className={cls} data-subject={subject}>
      {body}
    </div>
  );
}
