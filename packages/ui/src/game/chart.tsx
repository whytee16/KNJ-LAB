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
  for (let v = 0; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

const W = 320;
const H = 200;
const M = { l: 44, r: 12, t: 12, b: 36 };
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
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  series: { x: number; y: number }[];
  xMax: number;
  yMax: number;
  marker?: { x: number; y: number };
  description: string;
}) {
  const xs = ticks(xMax);
  const ys = ticks(yMax);
  const xTop = xs[xs.length - 1]! || 1;
  const yTop = ys[ys.length - 1]! || 1;
  const px = (x: number) => M.l + (x / xTop) * (W - M.l - M.r);
  const py = (y: number) => H - M.b - (y / yTop) * (H - M.t - M.b);
  const d = series
    .map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`)
    .join('');

  return (
    <figure className="flex flex-col gap-1">
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
        <g className="fill-text-muted text-[10px]">
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
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">
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
    </figure>
  );
}
