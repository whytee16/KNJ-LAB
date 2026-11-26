'use client';

import { DIVERGING, type ThinLensParams } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { svgFrame } from './common';
import { benchSpan, STRETCH_Y } from './lens-geometry';

/** Textbook ray diagram: the axis, foci, the object and image arrows, rays and the screen. */
export function LensSide2D({
  params,
  label,
  labels,
}: {
  params: ThinLensParams;
  label: string;
  labels: { F: string; F2: string; screen: string; scale: string };
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 360;
  const { left, right, r, rays } = benchSpan(params);
  const top = Math.max(params.h, Math.abs(r.H), 4) + 2;
  const { X, Y } = svgFrame(W, H, { x0: left, x1: right, y0: -top, y1: top }, 24, STRETCH_Y);
  const arrow = (x: number, y: number, cls: string, dashed: boolean, key: string) => {
    const x0 = X(x);
    const y0 = Y(0);
    const y1 = Y(y);
    const dir = Math.sign(y1 - y0) || -1;
    return (
      <g key={key} className={cls} data-arrow={key}>
        <line
          x1={x0}
          y1={y0}
          x2={x0}
          y2={y1}
          stroke="currentColor"
          strokeWidth={3}
          strokeDasharray={dashed ? '5 4' : undefined}
        />
        <polygon
          points={`${x0},${y1} ${x0 - 6},${y1 - dir * 10} ${x0 + 6},${y1 - dir * 10}`}
          fill="currentColor"
        />
      </g>
    );
  };
  const lensH = Y(top - 1);
  const lensB = Y(-(top - 1));
  const diverging = params.kind === DIVERGING;
  const head = (y: number, up: boolean) => {
    const d = up !== diverging ? -1 : 1;
    return `${X(0)},${y} ${X(0) - 7},${y - d * 10} ${X(0) + 7},${y - d * 10}`;
  };
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <line x1={X(left)} x2={X(right)} y1={Y(0)} y2={Y(0)} className="stroke-text-muted" />
        <g className="text-info">
          <line x1={X(0)} x2={X(0)} y1={lensH} y2={lensB} stroke="currentColor" strokeWidth={3} />
          <polygon points={head(lensH, true)} fill="currentColor" />
          <polygon points={head(lensB, false)} fill="currentColor" />
        </g>
        {[-2, -1, 1, 2].map((k) => (
          <g key={k}>
            <circle cx={X(k * params.F)} cy={Y(0)} r={3.5} className="fill-text" />
            <text
              x={X(k * params.F)}
              y={Y(0) + 16}
              textAnchor="middle"
              className="fill-text-muted text-xs"
            >
              {Math.abs(k) === 1 ? labels.F : labels.F2}
            </text>
          </g>
        ))}
        {rays.map((s, i) => (
          <line
            key={i}
            x1={X(s.from.x)}
            y1={Y(s.from.y)}
            x2={X(s.to.x)}
            y2={Y(s.to.y)}
            className="stroke-accent"
            strokeWidth={s.virtual ? 1.2 : 1.8}
            strokeDasharray={s.virtual ? '4 4' : undefined}
            data-ray={s.virtual ? 'virtual' : 'real'}
          />
        ))}
        {arrow(-params.d, params.h, 'text-text', false, 'object')}
        {r.none ? null : arrow(r.f, r.H, 'text-success', !r.real, 'image')}
        <line
          x1={X(params.s)}
          x2={X(params.s)}
          y1={Y(top - 0.5)}
          y2={Y(-(top - 0.5))}
          className="stroke-text"
          strokeWidth={4}
          strokeOpacity={0.35}
        />
        <text
          x={X(params.s)}
          y={Y(top - 0.5) - 4}
          textAnchor="middle"
          className="fill-text-muted text-xs"
        >
          {labels.screen}
        </text>
        <text x={8} y={14} className="fill-text-muted text-xs">
          {labels.scale}
        </text>
      </svg>
    </div>
  );
}
