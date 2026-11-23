'use client';

import type { ForceVec, Layout, Values } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { forceArrows, FORCE_TONE } from './forces';
import { frameFor, type Box } from './layout';

const TONE_CLASS = {
  text: 'text-text',
  info: 'text-info',
  accent: 'text-accent',
  danger: 'text-danger',
  success: 'text-success',
} as const;

/** 2D view of any scenario layout with the same geometry and force arrows as the 3D scene. */
export function ScenarioSide2D({
  layout,
  params,
  s,
  forces,
  showForces,
  forceLabel,
  reading,
  label,
}: {
  layout: Layout;
  params: Values;
  s: number;
  forces: ForceVec[];
  showForces: boolean;
  forceLabel: (f: { kind: ForceVec['kind']; index?: number }) => string;
  reading?: string;
  label: string;
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 360;
  const frame = frameFor(layout, params, s);
  const L = frame.layout;
  const span = frame.width + 1;
  const k = Math.min(W / span, H / 7.5);
  const X = (x: number) => W / 2 + (x - frame.center.x) * k;
  const Y = (y: number) => H / 2 - (y - frame.center.y) * k;
  const rect = (b: Box, cls: string, key?: string) => (
    <rect
      key={key}
      x={X(b.x - b.w / 2)}
      y={Y(b.y + b.h / 2)}
      width={b.w * k}
      height={b.h * k}
      rx={3}
      className={cls}
    />
  );
  const line = (pts: { x: number; y: number }[], cls = 'stroke-text', key?: string) => (
    <polyline
      key={key}
      points={pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}
      fill="none"
      className={cls}
      strokeWidth={2}
    />
  );
  const arrows = showForces ? forceArrows(forces, frame.anchors, 2.2) : [];
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {L.kind === 'elevator' ? (
          <g>
            {[-1.6, 1.6].map((x) =>
              line(
                [
                  { x, y: -2 },
                  { x, y: 5 },
                ],
                'stroke-text-muted',
                `r${x}`,
              ),
            )}
            {Array.from({ length: 8 }, (_, i) => -2 + i - L.railOffset).map((y) =>
              line(
                [
                  { x: 1.6, y },
                  { x: 1.85, y },
                ],
                'stroke-text',
                `m${y}`,
              ),
            )}
            {rect(L.cabin, 'fill-surface-muted stroke-border')}
            {line([
              { x: 0, y: L.cabin.y + L.cabin.h / 2 },
              { x: 0, y: 5 },
            ])}
            {rect({ ...L.scale, y: L.cabin.y - L.cabin.h / 2 + 0.13 }, 'fill-text')}
            {rect({ x: 0, y: L.cabin.y - L.cabin.h / 2 + 1.05, w: 0.45, h: 1.4 }, 'fill-info')}
            <circle
              cx={X(0)}
              cy={Y(L.cabin.y - L.cabin.h / 2 + 1.95)}
              r={0.2 * k}
              className="fill-accent"
            />
            {reading ? (
              <text
                x={X(0.75)}
                y={Y(L.cabin.y - L.cabin.h / 2 + 0.35)}
                className="fill-text text-xs font-semibold"
              >
                {reading}
              </text>
            ) : null}
          </g>
        ) : null}
        {L.kind === 'lamp' ? (
          <g>
            {[L.left, L.right].map((a, i) =>
              line([{ x: a.x, y: -2.2 }, a], 'stroke-text-muted', `p${i}`),
            )}
            {line([L.left, L.node, L.right])}
            {line([L.node, L.lamp])}
            <polygon
              points={`${X(L.lamp.x - 0.45)},${Y(L.lamp.y - 0.35)} ${X(L.lamp.x + 0.45)},${Y(L.lamp.y - 0.35)} ${X(L.lamp.x)},${Y(L.lamp.y)}`}
              className="fill-accent"
            />
            <circle cx={X(L.node.x)} cy={Y(L.node.y)} r={4} className="fill-text" />
          </g>
        ) : null}
        {L.kind === 'table-pulley' ? (
          <g>
            {line(
              [
                { x: L.table.x0, y: 0 },
                { x: L.table.x1, y: 0 },
              ],
              'stroke-text',
            )}
            {[L.table.x0 + 0.2, L.table.x1 - 0.2].map((x) =>
              line(
                [
                  { x, y: 0 },
                  { x, y: -2.5 },
                ],
                'stroke-text-muted',
                `l${x}`,
              ),
            )}
            <circle
              cx={X(L.pulley.x)}
              cy={Y(L.pulley.y)}
              r={L.pulley.r * k}
              className="fill-surface stroke-text"
              strokeWidth={2}
            />
            {line([
              { x: L.block.x + L.block.w / 2, y: L.block.y },
              { x: L.pulley.x, y: L.pulley.y + L.pulley.r },
            ])}
            {line([
              { x: L.pulley.x + L.pulley.r, y: L.pulley.y },
              { x: L.hang.x, y: L.hang.y + L.hang.h / 2 },
            ])}
            {rect(L.block, 'fill-accent')}
            {rect(L.hang, 'fill-info')}
          </g>
        ) : null}
        {L.kind === 'atwood' ? (
          <g>
            {line(
              [
                { x: -1.5, y: L.ceiling },
                { x: 1.5, y: L.ceiling },
              ],
              'stroke-text',
            )}
            {line([
              { x: 0, y: L.ceiling },
              { x: 0, y: L.pulley.y },
            ])}
            <circle
              cx={X(0)}
              cy={Y(L.pulley.y)}
              r={L.pulley.r * k}
              className="fill-surface stroke-text"
              strokeWidth={2}
            />
            {line([
              { x: -L.pulley.r, y: L.pulley.y },
              { x: L.left.x, y: L.left.y + L.left.h / 2 },
            ])}
            {line([
              { x: L.pulley.r, y: L.pulley.y },
              { x: L.right.x, y: L.right.y + L.right.h / 2 },
            ])}
            {rect(L.left, 'fill-accent')}
            {rect(L.right, 'fill-info')}
          </g>
        ) : null}
        {arrows.map((a) => {
          const x1 = X(a.from.x);
          const y1 = Y(a.from.y);
          const x2 = X(a.to.x);
          const y2 = Y(a.to.y);
          const len = Math.hypot(x2 - x1, y2 - y1) || 1;
          const ux = (x2 - x1) / len;
          const uy = (y2 - y1) / len;
          return (
            <g key={a.key} className={TONE_CLASS[FORCE_TONE[a.kind]]} data-force={a.kind}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={2.5} />
              <polygon
                points={`${x2},${y2} ${x2 - 9 * ux - 4.5 * uy},${y2 - 9 * uy + 4.5 * ux} ${x2 - 9 * ux + 4.5 * uy},${y2 - 9 * uy - 4.5 * ux}`}
                fill="currentColor"
              />
              <text
                x={x2 + 12 * ux}
                y={y2 + 12 * uy + 4}
                textAnchor="middle"
                fill="currentColor"
                className="text-xs font-semibold"
              >
                {forceLabel(a)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
