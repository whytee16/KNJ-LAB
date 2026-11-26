'use client';

import { mediaOf, refractionGeometry, type RefractionParams } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { svgFrame } from './common';

/** Side view: the boundary, the normal, incident, reflected and refracted rays with angles. */
export function RefractionSide2D({
  params,
  label,
  labels,
}: {
  params: RefractionParams;
  label: string;
  labels: { tir: string; medium1: string; medium2: string };
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 360;
  const g = refractionGeometry(params);
  const { pair } = mediaOf(params);
  const dense = pair.from === 'air' ? pair.to : pair.from;
  const { X, Y } = svgFrame(W, H, { x0: -34, x1: 34, y0: -32, y1: 32 });
  const O = { x: 0, y: 0 };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x1: X(a.x),
    y1: Y(a.y),
    x2: X(b.x),
    y2: Y(b.y),
  });
  const up = g.side > 0;
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <rect
          x={X(-34)}
          y={Y(0)}
          width={X(34) - X(-34)}
          height={Y(-32) - Y(0)}
          className={dense === 'water' ? 'fill-info/15' : 'fill-surface-muted'}
        />
        <line
          {...line({ x: -34, y: 0 }, { x: 34, y: 0 })}
          className="stroke-text"
          strokeWidth={2}
        />
        <line
          {...line({ x: 0, y: -30 }, { x: 0, y: 30 })}
          className="stroke-text-muted"
          strokeDasharray="5 4"
        />
        <line
          {...line(g.source, O)}
          className="stroke-danger"
          strokeWidth={2.5}
          data-ray="incident"
        />
        <line
          {...line(O, g.reflected)}
          className="stroke-danger"
          strokeWidth={g.refracted ? 1.2 : 2.5}
          strokeOpacity={g.refracted ? 0.5 : 1}
          data-ray="reflected"
        />
        {g.refracted ? (
          <line
            {...line(O, g.refracted)}
            className="stroke-danger"
            strokeWidth={2.5}
            data-ray="refracted"
          />
        ) : null}
        <text
          x={X(g.source.x * 0.35) - 4}
          y={Y(g.source.y * 0.55)}
          className="fill-danger text-sm font-semibold"
        >
          α
        </text>
        {g.refracted ? (
          <text
            x={X(g.refracted.x * 0.35) + 2}
            y={Y(g.refracted.y * 0.55)}
            className="fill-danger text-sm font-semibold"
          >
            γ
          </text>
        ) : (
          <text
            x={X(4)}
            y={Y(up ? 14 : -14)}
            className="fill-text text-sm font-semibold"
            data-testid="tir-label"
          >
            {labels.tir}
          </text>
        )}
        <text x={X(-32)} y={Y(up ? 26 : -26)} className="fill-text-muted text-xs">
          {labels.medium1}
        </text>
        <text x={X(20)} y={Y(up ? -26 : 26)} className="fill-text-muted text-xs">
          {labels.medium2}
        </text>
      </svg>
    </div>
  );
}
