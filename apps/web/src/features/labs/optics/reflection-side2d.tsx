'use client';

import { reflectionGeometry, type ReflectionParams } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { svgFrame } from './common';

type P = { x: number; y: number };

/** Top view of the mirror: laser beam, normal, angles, the candle and its image. */
export function ReflectionSide2D({
  params,
  label,
  labels,
}: {
  params: ReflectionParams;
  label: string;
  labels: { image: string; candle: string; mirror: string };
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 380;
  const g = reflectionGeometry(params);
  const { X, Y } = svgFrame(W, H, { x0: -44, x1: 44, y0: -32, y1: 34 });
  const pt = (p: P) => `${X(p.x)},${Y(p.y)}`;
  const out = { x: g.reflected.x, y: g.reflected.y };
  const m1 = { x: g.along.x * 24, y: g.along.y * 24 };
  const m2 = { x: -g.along.x * 24, y: -g.along.y * 24 };
  const behind = { x: -g.n.x * 1.5, y: -g.n.y * 1.5 };
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {/* Mirror with hatching on its back. */}
        <line
          x1={X(m1.x)}
          y1={Y(m1.y)}
          x2={X(m2.x)}
          y2={Y(m2.y)}
          className="stroke-info"
          strokeWidth={4}
        />
        {Array.from({ length: 9 }, (_, i) => {
          const s = -20 + i * 5;
          const a = { x: g.along.x * s, y: g.along.y * s };
          return (
            <line
              key={s}
              x1={X(a.x)}
              y1={Y(a.y)}
              x2={X(a.x + behind.x + g.along.x * 1.5)}
              y2={Y(a.y + behind.y + g.along.y * 1.5)}
              className="stroke-text-muted"
            />
          );
        })}
        <text x={X(m1.x) + 8} y={Y(m1.y)} className="fill-text-muted text-xs">
          {labels.mirror}
        </text>
        <line
          x1={X(0)}
          y1={Y(0)}
          x2={X(g.n.x * 30)}
          y2={Y(g.n.y * 30)}
          className="stroke-text-muted"
          strokeDasharray="5 4"
        />
        {/* Laser beam. */}
        <polyline
          points={`${pt(g.laser)} ${pt(g.O)} ${pt(out)}`}
          fill="none"
          className="stroke-danger"
          strokeWidth={2.5}
          data-ray="laser"
        />
        <circle cx={X(g.laser.x)} cy={Y(g.laser.y)} r={5} className="fill-text" />
        <text
          x={X(g.laser.x * 0.45 + g.n.x * 2)}
          y={Y(g.laser.y * 0.45) - 6}
          className="fill-danger text-xs font-semibold"
        >
          α
        </text>
        <text
          x={X(out.x * 0.45 + g.n.x * 2)}
          y={Y(out.y * 0.45) + 14}
          className="fill-danger text-xs font-semibold"
        >
          β
        </text>
        {/* Candle, image and the rays that build the image. */}
        {g.candleRays.map((r, i) => (
          <g key={i}>
            <polyline
              points={`${pt(g.candle)} ${pt(r.hit)} ${pt(r.end)}`}
              fill="none"
              className="stroke-accent"
              strokeWidth={1.5}
            />
            <line
              x1={X(r.hit.x)}
              y1={Y(r.hit.y)}
              x2={X(g.image.x)}
              y2={Y(g.image.y)}
              className="stroke-accent"
              strokeDasharray="4 4"
            />
          </g>
        ))}
        <circle cx={X(g.candle.x)} cy={Y(g.candle.y)} r={6} className="fill-accent" />
        <text
          x={X(g.candle.x)}
          y={Y(g.candle.y) + 20}
          textAnchor="middle"
          className="fill-text text-xs"
        >
          {labels.candle}
        </text>
        <circle
          cx={X(g.image.x)}
          cy={Y(g.image.y)}
          r={6}
          className="fill-none stroke-accent"
          strokeDasharray="3 2"
          strokeWidth={2}
          data-testid="mirror-image"
        />
        <text
          x={X(g.image.x)}
          y={Y(g.image.y) + 20}
          textAnchor="middle"
          className="fill-text text-xs"
        >
          {labels.image}
        </text>
      </svg>
    </div>
  );
}
