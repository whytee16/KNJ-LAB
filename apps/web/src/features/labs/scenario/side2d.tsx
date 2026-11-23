'use client';

import type { ForceVec, Layout, Values } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { forceArrows, FORCE_TONE } from './forces';
import { frameFor, LINK, type Box, type FrameMotion, type XY } from './layout';
import type { ScenarioSceneLabels } from './scene3d';

const TONE_CLASS = {
  text: 'text-text',
  info: 'text-info',
  accent: 'text-accent',
  danger: 'text-danger',
  success: 'text-success',
} as const;

const TABLE_LOOKS = ['block', 'car', 'phone'];
const HANG_LOOKS = ['weight', 'bucket', 'phone'];
const ATWOOD_LOOKS = ['weight', 'box', 'bucket'];

/** 2D view of any scenario layout with the same geometry and force arrows as the 3D scene. */
export function ScenarioSide2D({
  layout,
  params,
  s,
  motion,
  forces,
  showForces,
  forceLabel,
  reading,
  labels,
  label,
}: {
  layout: Layout;
  params: Values;
  s: number;
  motion: FrameMotion;
  forces: ForceVec[];
  showForces: boolean;
  forceLabel: (f: { kind: ForceVec['kind']; index?: number }) => string;
  reading?: string;
  labels: ScenarioSceneLabels;
  label: string;
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 380;
  const frame = frameFor(layout, params, s, motion);
  const L = frame.layout;
  const link = params.link ?? LINK.rope;
  const k = Math.min(W / (frame.width + 1), H / (frame.height + 0.5));
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
  const line = (pts: XY[], cls = 'stroke-text', key?: string) => (
    <polyline
      key={key}
      points={pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}
      fill="none"
      className={cls}
      strokeWidth={2}
    />
  );
  /** Rope, chain (thick dashes) or spring (zigzag) between two points. */
  const linkLine = (a: XY, b: XY, kind: number, key?: string) => {
    if (kind === LINK.chain)
      return (
        <line
          key={key}
          x1={X(a.x)}
          y1={Y(a.y)}
          x2={X(b.x)}
          y2={Y(b.y)}
          className="stroke-text"
          strokeWidth={4}
          strokeDasharray="5 2"
          data-link="chain"
        />
      );
    if (kind === LINK.spring) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const n = Math.max(6, Math.round((len * k) / 7));
      const pts = Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const off = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * (0.12 * 1);
        return { x: a.x + dx * t + (-dy / len) * off, y: a.y + dy * t + (dx / len) * off };
      });
      return (
        <polyline
          key={key}
          points={pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}
          fill="none"
          className="stroke-text"
          strokeWidth={1.8}
          data-link="spring"
        />
      );
    }
    return line([a, b], 'stroke-text', key);
  };
  /** A load drawn by its kind inside the box b. */
  const load = (b: Box, kind: string, fill: string, key?: string) => {
    if (kind === 'weight')
      return (
        <g key={key} data-load="weight">
          <polygon
            points={`${X(b.x - b.w * 0.35)},${Y(b.y + b.h * 0.3)} ${X(b.x + b.w * 0.35)},${Y(b.y + b.h * 0.3)} ${X(b.x + b.w / 2)},${Y(b.y - b.h / 2)} ${X(b.x - b.w / 2)},${Y(b.y - b.h / 2)}`}
            className="fill-text"
          />
          <circle
            cx={X(b.x)}
            cy={Y(b.y + b.h * 0.38)}
            r={b.w * 0.13 * k}
            className="fill-none stroke-text"
            strokeWidth={2}
          />
        </g>
      );
    if (kind === 'bucket')
      return (
        <g key={key} data-load="bucket">
          <polygon
            points={`${X(b.x - b.w / 2)},${Y(b.y + b.h / 2)} ${X(b.x + b.w / 2)},${Y(b.y + b.h / 2)} ${X(b.x + b.w * 0.38)},${Y(b.y - b.h / 2)} ${X(b.x - b.w * 0.38)},${Y(b.y - b.h / 2)}`}
            className={fill}
          />
        </g>
      );
    if (kind === 'phone')
      return (
        <rect
          key={key}
          x={X(b.x - b.w * 0.3)}
          y={Y(b.y - b.h / 2 + 0.12)}
          width={b.w * 0.6 * k}
          height={0.12 * k}
          rx={2}
          className="fill-text"
          data-load="phone"
        />
      );
    if (kind === 'car')
      return (
        <g key={key} data-load="car">
          {rect({ x: b.x, y: b.y - b.h * 0.15, w: b.w * 1.1, h: b.h * 0.4 }, fill)}
          {rect({ x: b.x - b.w * 0.1, y: b.y + b.h * 0.2, w: b.w * 0.55, h: b.h * 0.3 }, fill)}
          {[-1, 1].map((sx) => (
            <circle
              key={sx}
              cx={X(b.x + sx * b.w * 0.35)}
              cy={Y(b.y - b.h * 0.36)}
              r={b.h * 0.15 * k}
              className="fill-text"
            />
          ))}
        </g>
      );
    return rect(b, fill, key);
  };
  const vArrow = (x: number, y: number, dy: number, cls: string, text: string, key: string) => {
    const x1 = X(x);
    const y1 = Y(y);
    const y2 = Y(y + dy);
    const sgn = Math.sign(dy) || 1;
    return (
      <g key={key} className={cls} data-arrow={key}>
        <line x1={x1} y1={y1} x2={x1} y2={y2} stroke="currentColor" strokeWidth={3} />
        <polygon
          points={`${x1},${y2 - sgn * 0} ${x1 - 6},${y2 + sgn * 10} ${x1 + 6},${y2 + sgn * 10}`}
          fill="currentColor"
        />
        <text x={x1 + 10} y={(y1 + y2) / 2} fill="currentColor" className="text-xs font-semibold">
          {text}
        </text>
      </g>
    );
  };
  const arrows = showForces && !motion.broken ? forceArrows(forces, frame.anchors, 2.2) : [];
  const floor = frame.floor;
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {floor !== null ? (
          <line
            x1={0}
            x2={W}
            y1={Y(floor)}
            y2={Y(floor)}
            className="stroke-text-muted"
            strokeWidth={2}
          />
        ) : null}
        {L.kind === 'elevator' ? (
          <g>
            {[-1.6, 1.6].map((x) =>
              line(
                [
                  { x, y: -2.5 },
                  { x, y: 5.5 },
                ],
                'stroke-text-muted',
                `r${x}`,
              ),
            )}
            {Array.from({ length: 9 }, (_, i) => -2.5 + i - L.railOffset).map((y) =>
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
              { x: 0, y: 5.5 },
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
            {Math.abs(L.v) > 0.05
              ? vArrow(
                  2.4,
                  L.cabin.y,
                  Math.sign(L.v) * Math.min(2.2, 0.6 + Math.abs(L.v) * 0.4),
                  'text-success',
                  labels.v ?? 'v',
                  'v',
                )
              : null}
            {Math.abs(L.a) > 0.05
              ? vArrow(
                  3.4,
                  L.cabin.y,
                  Math.sign(L.a) * Math.min(2.2, 0.6 + Math.abs(L.a) * 0.15),
                  'text-accent',
                  labels.a ?? 'a',
                  'a',
                )
              : null}
            {labels.floor ? (
              <text
                x={X(0)}
                y={Y(L.cabin.y + L.cabin.h / 2 + 0.3)}
                textAnchor="middle"
                className="fill-text text-xs font-semibold"
              >
                {labels.floor}
              </text>
            ) : null}
            {labels.motion ? (
              <text
                x={X(0.6)}
                y={Y(L.cabin.y - L.cabin.h / 2 - 0.45)}
                textAnchor="middle"
                className="fill-text text-sm font-semibold"
                data-testid="lift-motion"
              >
                {labels.motion}
              </text>
            ) : null}
          </g>
        ) : null}
        {L.kind === 'lamp' ? (
          <g>
            {[L.left, L.right].map((a, i) =>
              line([{ x: a.x, y: floor ?? -2.2 }, a], 'stroke-text-muted', `p${i}`),
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
                  { x, y: floor ?? -2.5 },
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
            {linkLine(
              { x: L.block.x + L.block.w / 2, y: L.block.y },
              { x: L.pulley.x, y: L.pulley.y + L.pulley.r },
              link === LINK.spring ? LINK.rope : link,
            )}
            {L.broken
              ? line(
                  [
                    { x: L.pulley.x + L.pulley.r, y: L.pulley.y },
                    { x: L.pulley.x + L.pulley.r, y: L.pulley.y - 0.4 },
                  ],
                  'stroke-danger',
                )
              : linkLine(
                  { x: L.pulley.x + L.pulley.r, y: L.pulley.y },
                  { x: L.hang.x, y: L.hang.y + L.hang.h / 2 },
                  link,
                )}
            {labels.extension ? (
              <text
                x={X(L.hang.x + 0.4)}
                y={Y((L.pulley.y + L.hang.y) / 2)}
                className="fill-text text-xs font-semibold"
              >
                {labels.extension}
              </text>
            ) : null}
            {load(L.block, TABLE_LOOKS[params.look1 ?? 0] ?? 'block', 'fill-accent')}
            {load(L.hang, HANG_LOOKS[params.look2 ?? 0] ?? 'weight', 'fill-info')}
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
            {L.broken ? (
              <>
                {line(
                  [
                    { x: -L.pulley.r, y: L.pulley.y },
                    { x: -L.pulley.r, y: L.pulley.y - 0.4 },
                  ],
                  'stroke-danger',
                  'bl',
                )}
                {line(
                  [
                    { x: L.pulley.r, y: L.pulley.y },
                    { x: L.pulley.r, y: L.pulley.y - 0.4 },
                  ],
                  'stroke-danger',
                  'br',
                )}
              </>
            ) : (
              <>
                {linkLine(
                  { x: -L.pulley.r, y: L.pulley.y },
                  { x: L.left.x, y: L.left.y + L.left.h / 2 },
                  link === LINK.spring ? LINK.rope : link,
                  'll',
                )}
                {linkLine(
                  { x: L.pulley.r, y: L.pulley.y },
                  { x: L.right.x, y: L.right.y + L.right.h / 2 },
                  link,
                  'lr',
                )}
              </>
            )}
            {labels.extension ? (
              <text
                x={X(L.right.x + 0.5)}
                y={Y((L.pulley.y + L.right.y) / 2)}
                className="fill-text text-xs font-semibold"
              >
                {labels.extension}
              </text>
            ) : null}
            {load(L.left, ATWOOD_LOOKS[params.look1 ?? 0] ?? 'weight', 'fill-accent', 'left')}
            {load(L.right, ATWOOD_LOOKS[params.look2 ?? 0] ?? 'weight', 'fill-info', 'right')}
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
