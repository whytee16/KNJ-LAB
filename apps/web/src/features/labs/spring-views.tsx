'use client';

import type { SpringParams } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';

/** 2D view: wall, zigzag spring, block on a smooth surface, equilibrium mark. Drawing only. */
export function SpringSide2D({
  params,
  x,
  label,
  eqLabel,
}: {
  params: SpringParams;
  x: number;
  label: string;
  eqLabel: string;
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 200;
  const floor = 150;
  const wall = 30;
  const eq = W / 2; // equilibrium position of the block centre
  const pxPerM = Math.min((W / 2 - 90) / 0.3, 900); // the largest amplitude still fits
  const block = 56;
  const bx = eq + x * pxPerM;
  const springEnd = bx - block / 2;
  const coils = 14;
  const pts = Array.from({ length: coils * 2 + 1 }, (_, i) => {
    const px = wall + 12 + ((springEnd - wall - 24) * i) / (coils * 2);
    const py = floor - block / 2 + (i === 0 || i === coils * 2 ? 0 : i % 2 ? -12 : 12);
    return `${px},${py}`;
  });
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <rect
          x={0}
          y={20}
          width={wall}
          height={floor - 20}
          className="fill-surface-muted stroke-border"
        />
        <line x1={0} x2={W} y1={floor} y2={floor} className="stroke-text" strokeWidth={2} />
        <line
          x1={eq}
          x2={eq}
          y1={40}
          y2={floor + 14}
          className="stroke-text-muted"
          strokeDasharray="4 4"
        />
        <text x={eq} y={floor + 30} textAnchor="middle" className="fill-text-muted text-xs">
          {eqLabel}
        </text>
        <polyline
          points={[
            `${wall},${floor - block / 2}`,
            ...pts,
            `${springEnd},${floor - block / 2}`,
          ].join(' ')}
          fill="none"
          className="stroke-text"
          strokeWidth={2}
        />
        <rect
          x={bx - block / 2}
          y={floor - block}
          width={block}
          height={block}
          rx={4}
          className="fill-accent"
        />
        {params.A > 0 ? (
          <>
            <line
              x1={eq - params.A * pxPerM}
              x2={eq - params.A * pxPerM}
              y1={floor + 4}
              y2={floor + 12}
              className="stroke-accent"
            />
            <line
              x1={eq + params.A * pxPerM}
              x2={eq + params.A * pxPerM}
              y1={floor + 4}
              y2={floor + 12}
              className="stroke-accent"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
