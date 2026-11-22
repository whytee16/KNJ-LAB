'use client';

import type { InclinedPlaneParams } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { inclineFrame } from './incline-geometry';

export interface ForceLabels {
  mg: string;
  N: string;
  Ffr: string;
  ma: string;
}

/** 2D side view of the block on the slope with force arrows. Drawing only. */
export function InclineSide2D({
  params,
  tau,
  label,
  angleLabel,
  forceLabels,
}: {
  params: InclinedPlaneParams;
  tau: number;
  label: string;
  angleLabel: string;
  forceLabels: ForceLabels;
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 380;
  const f = inclineFrame(params, tau);
  // Room for force arrows (up to ~100 px) above and to the left of the block at the top.
  const pad = { l: 110, r: 30, t: 120, b: 30 };
  const spanX = Math.max(f.b, 1);
  const spanY = Math.max(f.h, 0.5);
  const s = Math.min((W - pad.l - pad.r) / spanX, (H - pad.t - pad.b) / spanY);
  const ox = pad.l;
  const oy = H - pad.b;
  const px = (x: number) => ox + x * s;
  const py = (y: number) => oy - y * s;
  const block = 30; // px
  const c = f.at(f.s);
  // Block centre: half a block above the slope surface.
  const cx = px(c.x) + (f.normal.x * block) / 2;
  const cy = py(c.y) - (f.normal.y * block) / 2;
  const k = 100 / Math.max(f.r.Fg, 1e-9); // px per newton
  const arrow = (fx: number, fy: number, cls: string, text: string, key: string) => {
    const len = Math.hypot(fx, fy);
    if (len < 4) return null;
    const x2 = cx + fx;
    const y2 = cy - fy;
    const ux = fx / len;
    const uy = -fy / len;
    const head = `${x2},${y2} ${x2 - 9 * ux - 4.5 * uy},${y2 - 9 * uy + 4.5 * ux} ${x2 - 9 * ux + 4.5 * uy},${y2 - 9 * uy - 4.5 * ux}`;
    return (
      <g key={key} className={cls} data-force={key}>
        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" strokeWidth={2.5} />
        <polygon points={head} fill="currentColor" />
        <text
          x={x2 + 8 * ux}
          y={y2 + 8 * uy + 4}
          fill="currentColor"
          className="text-xs font-semibold"
          textAnchor="middle"
        >
          {text}
        </text>
      </g>
    );
  };
  const deg = -params.angle;
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <line
          x1={12}
          x2={W - 12}
          y1={oy}
          y2={oy}
          className="stroke-text"
          strokeWidth={2}
        />
        <polygon
          points={`${px(0)},${py(0)} ${px(f.b)},${py(0)} ${px(0)},${py(f.h)}`}
          className="fill-surface-muted stroke-border"
          strokeWidth={1.5}
        />
        {params.angle > 0 ? (
          <text x={px(f.b) - 46} y={oy - 8} className="fill-text-muted text-xs">
            {angleLabel}
          </text>
        ) : null}
        <rect
          x={cx - block / 2}
          y={cy - block / 2}
          width={block}
          height={block}
          rx={3}
          transform={`rotate(${deg} ${cx} ${cy})`}
          className="fill-accent"
        />
        {arrow(0, -f.r.Fg * k, 'text-text', forceLabels.mg, 'mg')}
        {arrow(f.normal.x * f.r.N * k, f.normal.y * f.r.N * k, 'text-info', forceLabels.N, 'N')}
        {arrow(f.up.x * f.r.Ffr * k, f.up.y * f.r.Ffr * k, 'text-danger', forceLabels.Ffr, 'Ffr')}
        {f.r.moves
          ? arrow(
              f.down.x * params.m * f.r.a * k,
              f.down.y * params.m * f.r.a * k,
              'text-success',
              forceLabels.ma,
              'ma',
            )
          : null}
      </svg>
    </div>
  );
}
