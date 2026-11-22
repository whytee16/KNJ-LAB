'use client';

import type { PendulumParams, PendulumState } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';

/** 2D view of the mathematical pendulum: pivot, string, bob, amplitude arc. Drawing only. */
export function PendulumSide2D({
  params,
  state,
  label,
  angleLabel,
}: {
  params: PendulumParams;
  state: PendulumState;
  label: string;
  angleLabel: string;
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 320;
  const len = H - 70; // px for the string at any l: the scene shows the shape, numbers show the size
  const cx = W / 2;
  const cy = 30;
  const th0 = (params.theta0 * Math.PI) / 180;
  const bx = cx + len * Math.sin(state.theta);
  const by = cy + len * Math.cos(state.theta);
  const r = 9 + 7 * Math.cbrt(params.m);
  const arc = `M${cx + len * Math.sin(-th0)},${cy + len * Math.cos(th0)} A${len},${len} 0 0 0 ${cx + len * Math.sin(th0)},${cy + len * Math.cos(th0)}`;
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <line x1={cx - 70} x2={cx + 70} y1={cy} y2={cy} className="stroke-text" strokeWidth={4} />
        <line
          x1={cx}
          x2={cx}
          y1={cy}
          y2={cy + len + 12}
          className="stroke-border"
          strokeDasharray="4 4"
        />
        <path
          d={arc}
          fill="none"
          className="stroke-accent/50"
          strokeWidth={2}
          strokeDasharray="6 5"
        />
        <line x1={cx} y1={cy} x2={bx} y2={by} className="stroke-text" strokeWidth={1.5} />
        <circle cx={bx} cy={by} r={r} className="fill-accent" />
        <circle cx={cx} cy={cy} r={4} className="fill-text" />
        <text x={cx + 10} y={cy + 60} className="fill-text-muted text-xs">
          {angleLabel}
        </text>
      </svg>
    </div>
  );
}
