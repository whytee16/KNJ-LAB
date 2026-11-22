'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Width of an element in CSS pixels (updates on resize). Drawings use it as their viewBox width,
 * so one unit is one pixel and labels keep their size on phones and wide screens alike.
 */
export function useMeasuredWidth<T extends HTMLElement>(
  fallback: number,
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** "Nice" tick step for an axis of the given length. */
export function niceStep(max: number, target = 5): number {
  if (!(max > 0)) return 1;
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

export function ticks(max: number, target = 5): number[] {
  const step = niceStep(max, target);
  const out: number[] = [];
  // The last tick is the first one at or above `max`, so the data always fits inside the grid.
  for (let i = 0; ; i++) {
    const v = Number((i * step).toFixed(6));
    out.push(v);
    if (v >= max - step * 1e-9) break;
  }
  return out;
}

const H = 240;
const M = { l: 48, r: 16, t: 12, b: 40 };
const fmt = (n: number) => String(Number(n.toFixed(2))).replace('.', ',');

/**
 * Dependency chart in plain SVG (no chart library): axes, grid, the line and the current point.
 * Axes start at zero; limits are fixed by the caller so the scale does not jump while playing.
 */
export function GameChart({
  title,
  xLabel,
  yLabel,
  series,
  xMax,
  yMax,
  marker,
  description,
  more,
  label,
  yMin = 0,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  series: { x: number; y: number }[];
  xMax: number;
  yMax: number;
  marker?: { x: number; y: number };
  description: string;
  /** Extra lines with a legend (e.g. kinetic and potential energy). */
  more?: {
    points: { x: number; y: number }[];
    tone: 'info' | 'success' | 'muted';
    label: string;
  }[];
  /** Legend label of the main line (shown when there are extra lines). */
  label?: string;
  /** Lower bound of the y axis (negative for oscillations); ticks are symmetric then. */
  yMin?: number;
}) {
  const [ref, W] = useMeasuredWidth<HTMLElement>(560);
  const xs = ticks(xMax, W < 400 ? 4 : 6);
  const ysUp = ticks(yMax, yMin < 0 ? 3 : 5);
  const ys =
    yMin < 0
      ? [
          ...ysUp
            .slice(1)
            .map((v) => -v)
            .reverse(),
          ...ysUp,
        ]
      : ysUp;
  const xTop = xs[xs.length - 1]! || 1;
  const yTop = ys[ys.length - 1]! || 1;
  const yBottom = yMin < 0 ? -yTop : 0;
  const px = (x: number) => M.l + (x / xTop) * (W - M.l - M.r);
  const py = (y: number) => H - M.b - ((y - yBottom) / (yTop - yBottom)) * (H - M.t - M.b);
  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join('');
  const d = path(series);
  const toneClass = {
    info: 'stroke-info',
    success: 'stroke-success',
    muted: 'stroke-text-muted',
  } as const;

  return (
    <figure ref={ref} className="flex flex-col gap-1">
      <figcaption className="text-sm font-medium text-text-muted">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${description}`}
        className="w-full"
      >
        <g className="text-border" stroke="currentColor" strokeWidth="1">
          {xs.map((v) => (
            <line key={`x${v}`} x1={px(v)} x2={px(v)} y1={M.t} y2={H - M.b} />
          ))}
          {ys.map((v) => (
            <line key={`y${v}`} x1={M.l} x2={W - M.r} y1={py(v)} y2={py(v)} />
          ))}
        </g>
        <g className="fill-text-muted text-xs">
          {xs.map((v) => (
            <text key={`xt${v}`} x={px(v)} y={H - M.b + 14} textAnchor="middle">
              {fmt(v)}
            </text>
          ))}
          {ys.map((v) => (
            <text key={`yt${v}`} x={M.l - 6} y={py(v) + 3} textAnchor="end">
              {fmt(v)}
            </text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
            {xLabel}
          </text>
          <text
            x={10}
            y={(M.t + H - M.b) / 2}
            textAnchor="middle"
            transform={`rotate(-90 10 ${(M.t + H - M.b) / 2})`}
          >
            {yLabel}
          </text>
        </g>
        {(more ?? []).map((m) => (
          <path
            key={m.label}
            d={path(m.points)}
            fill="none"
            className={toneClass[m.tone]}
            strokeWidth="2"
            strokeDasharray={m.tone === 'muted' ? '5 4' : undefined}
          />
        ))}
        <path
          d={d}
          fill="none"
          className="stroke-accent"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {marker ? (
          <circle
            cx={px(marker.x)}
            cy={py(marker.y)}
            r="5"
            className="fill-accent stroke-surface"
            strokeWidth="2"
          />
        ) : null}
      </svg>
      {more?.length ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
          {label ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 bg-accent" />
              {label}
            </li>
          ) : null}
          {more.map((m) => (
            <li key={m.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block h-0.5 w-4 ${m.tone === 'info' ? 'bg-info' : m.tone === 'success' ? 'bg-success' : 'bg-text-muted'}`}
              />
              {m.label}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
