'use client';

import type { ProjectileParams } from '@knj/physics';
import { ticks, useMeasuredWidth } from '@knj/ui/game';
import { throwFrame, throwState, trajectory } from './projectile-geometry';

/** 2D side view of the throw (also the fallback when 3D is not available). Drawing only. */
export function ProjectileSide2D({
  params,
  tau,
  label,
  format,
  unit,
  vectorLabels,
}: {
  params: ProjectileParams;
  tau: number;
  label: string;
  format: (n: number) => string;
  unit: string;
  vectorLabels: { v: string; vx: string; vy: string };
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 300;
  const pad = { l: 44, r: 20, t: 24, b: 36 };
  const { r, top, right } = throwFrame(params);
  const xs = ticks(right, W < 400 ? 4 : 6);
  const ys = ticks(top, 4);
  const xMax = xs[xs.length - 1] || 1;
  const yMax = ys[ys.length - 1] || 1;
  // Same scale on both axes: the parabola keeps its true shape.
  const s = Math.min((W - pad.l - pad.r) / xMax, (H - pad.t - pad.b) / yMax);
  const px = (x: number) => pad.l + x * s;
  const py = (y: number) => H - pad.b - y * s;
  const path = trajectory(params, 61)
    .map((q, i) => `${i ? 'L' : 'M'}${px(q.x).toFixed(1)},${py(q.y).toFixed(1)}`)
    .join('');
  const { pos, vel } = throwState(params, tau);
  const k = 70 / Math.max(params.v0, 1); // px per m/s for velocity arrows
  const arrow = (dx: number, dy: number, cls: string, text: string) => {
    const len = Math.hypot(dx, dy);
    if (len < 4) return null;
    const x1 = px(pos.x);
    const y1 = py(pos.y);
    const x2 = x1 + dx;
    const y2 = y1 - dy;
    const ux = dx / len;
    const uy = -dy / len;
    const head = `${x2},${y2} ${x2 - 8 * ux - 4 * uy},${y2 - 8 * uy + 4 * ux} ${x2 - 8 * ux + 4 * uy},${y2 - 8 * uy - 4 * ux}`;
    return (
      <g className={cls}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={2.5} />
        <polygon points={head} fill="currentColor" />
        <text x={x2 + 6 * ux} y={y2 + 6 * uy} fill="currentColor" className="text-xs font-semibold">
          {text}
        </text>
      </g>
    );
  };
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <g className="text-border" stroke="currentColor">
          {xs.map((v) => (
            <line key={`x${v}`} x1={px(v)} x2={px(v)} y1={pad.t} y2={H - pad.b} />
          ))}
          {ys.map((v) => (
            <line key={`y${v}`} x1={pad.l} x2={W - pad.r} y1={py(v)} y2={py(v)} />
          ))}
        </g>
        <g className="fill-text-muted text-xs">
          {xs.map((v) => (
            <text key={`xt${v}`} x={px(v)} y={H - pad.b + 16} textAnchor="middle">
              {format(v)}
            </text>
          ))}
          {ys.map((v) => (
            <text key={`yt${v}`} x={pad.l - 6} y={py(v) + 4} textAnchor="end">
              {format(v)}
            </text>
          ))}
          <text x={W - pad.r} y={H - 4} textAnchor="end">
            {`x, ${unit}`}
          </text>
          <text x={pad.l} y={pad.t - 8} textAnchor="middle">
            {`y, ${unit}`}
          </text>
        </g>
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={py(0)}
          y2={py(0)}
          className="stroke-text"
          strokeWidth={2}
        />
        {params.h0 > 0 ? (
          <rect
            x={pad.l - 10}
            y={py(params.h0)}
            width={10}
            height={params.h0 * s}
            className="fill-surface-muted stroke-border"
          />
        ) : null}
        <path
          d={path}
          fill="none"
          className="stroke-accent/60"
          strokeWidth={2}
          strokeDasharray="6 5"
        />
        <line
          x1={px(0)}
          x2={px(r.L)}
          y1={py(0) + 1}
          y2={py(0) + 1}
          className="stroke-accent"
          strokeWidth={3}
        />
        <circle cx={px(pos.x)} cy={py(pos.y)} r={7} className="fill-accent" />
        {arrow(vel.vx * k, 0, 'text-info', vectorLabels.vx)}
        {arrow(0, vel.vy * k, 'text-success', vectorLabels.vy)}
        {arrow(vel.vx * k, vel.vy * k, 'text-accent', vectorLabels.v)}
      </svg>
    </div>
  );
}
