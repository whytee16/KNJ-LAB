import type { FigureScene, Prim, Pt, Tone } from '@knj/task-engine';

const STROKE: Record<Tone, string> = {
  ink: 'stroke-text',
  muted: 'stroke-text-muted',
  accent: 'stroke-accent',
  info: 'stroke-info',
  success: 'stroke-success',
  liquid: 'stroke-info',
};
const FILL: Record<Tone, string> = {
  ink: 'fill-text',
  muted: 'fill-text-muted',
  accent: 'fill-accent',
  info: 'fill-info',
  success: 'fill-success',
  liquid: 'fill-info/20',
};

function bounds(prims: Prim[]) {
  const pts: Pt[] = [];
  for (const p of prims) {
    if (p.t === 'line' || p.t === 'arrow') pts.push(p.a, p.b);
    else if (p.t === 'poly') pts.push(...p.pts);
    else if (p.t === 'circle' || p.t === 'arc') {
      pts.push([p.c[0] - p.r, p.c[1] - p.r], [p.c[0] + p.r, p.c[1] + p.r]);
    } else pts.push('at' in p ? p.at : [0, 0]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/**
 * Task figure: draws the primitives laid out by the task engine (ADR-0012) into an SVG with one
 * scale on both axes. Labels keep a fixed font size whatever the figure's units.
 */
export function TaskFigure({ figure, label }: { figure: FigureScene; label: string }) {
  const W = 420;
  const H = 300;
  const pad = 30;
  const b = bounds(figure.prims);
  const fit = () =>
    Math.min((W - 2 * pad) / (b.x1 - b.x0 || 1), (H - 2 * pad) / (b.y1 - b.y0 || 1));
  let k = fit();
  // Labels have a fixed size in pixels: widen the bounds by their estimated width and refit.
  for (let pass = 0; pass < 2; pass++) {
    for (const p of figure.prims) {
      if (p.t !== 'text') continue;
      const w = (p.s.length * 7.2) / k;
      const left = p.anchor === 'start' ? 0 : p.anchor === 'end' ? w : w / 2;
      b.x0 = Math.min(b.x0, p.at[0] - left);
      b.x1 = Math.max(b.x1, p.at[0] - left + w);
    }
    k = fit();
  }
  const w = (b.x1 - b.x0) * k + 2 * pad;
  const h = (b.y1 - b.y0) * k + 2 * pad;
  const X = (x: number) => pad + (x - b.x0) * k;
  const Y = (y: number) => h - pad - (y - b.y0) * k;
  const P = (p: Pt) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`;
  return (
    <figure className="my-2" data-testid="task-figure" data-kind={figure.kind}>
      <svg
        viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
        role="img"
        aria-label={label}
        className="h-auto max-h-[320px] w-full max-w-[420px]"
      >
        {figure.prims.map((p, i) => {
          const tone = ('tone' in p && p.tone) || 'ink';
          switch (p.t) {
            case 'line':
              return (
                <line
                  key={i}
                  x1={X(p.a[0])}
                  y1={Y(p.a[1])}
                  x2={X(p.b[0])}
                  y2={Y(p.b[1])}
                  className={STROKE[tone]}
                  strokeWidth={p.width ?? 1.8}
                  strokeDasharray={p.dash ? '5 4' : undefined}
                  strokeLinecap="round"
                />
              );
            case 'poly':
              return (
                <polyline
                  key={i}
                  points={(p.closed ? [...p.pts, p.pts[0]!] : p.pts).map(P).join(' ')}
                  className={`${p.fill ? FILL[p.fill] : 'fill-none'} ${p.tone || !p.fill ? STROKE[tone] : ''}`}
                  strokeWidth={2}
                  strokeDasharray={p.dash ? '5 4' : undefined}
                  strokeLinejoin="round"
                />
              );
            case 'circle':
              return (
                <circle
                  key={i}
                  cx={X(p.c[0])}
                  cy={Y(p.c[1])}
                  r={p.r * k}
                  className={`${p.fill ? FILL[p.fill] : 'fill-none'} ${STROKE[tone]}`}
                  strokeWidth={2}
                />
              );
            case 'arc': {
              const r = p.r * k;
              const s: Pt = [p.c[0] + p.r * Math.cos(p.a0), p.c[1] + p.r * Math.sin(p.a0)];
              const e: Pt = [p.c[0] + p.r * Math.cos(p.a1), p.c[1] + p.r * Math.sin(p.a1)];
              const large = p.a1 - p.a0 > Math.PI ? 1 : 0;
              return (
                <path
                  key={i}
                  d={`M${P(s)} A${r},${r} 0 ${large} 0 ${P(e)}`}
                  className={`fill-none ${STROKE[tone]}`}
                  strokeWidth={1.5}
                />
              );
            }
            case 'mark': {
              const s = p.size;
              const a: Pt = [p.at[0] + p.u[0] * s, p.at[1] + p.u[1] * s];
              const c: Pt = [p.at[0] + p.v[0] * s, p.at[1] + p.v[1] * s];
              const m: Pt = [a[0] + p.v[0] * s, a[1] + p.v[1] * s];
              return (
                <polyline
                  key={i}
                  points={[a, m, c].map(P).join(' ')}
                  className="fill-none stroke-text"
                  strokeWidth={1.3}
                />
              );
            }
            case 'arrow': {
              const x1 = X(p.a[0]);
              const y1 = Y(p.a[1]);
              const x2 = X(p.b[0]);
              const y2 = Y(p.b[1]);
              const l = Math.hypot(x2 - x1, y2 - y1) || 1;
              const ux = (x2 - x1) / l;
              const uy = (y2 - y1) / l;
              return (
                <g key={i} className={STROKE[tone]}>
                  <line x1={x1} y1={y1} x2={x2 - ux * 6} y2={y2 - uy * 6} strokeWidth={2.2} />
                  <polygon
                    points={`${x2},${y2} ${x2 - 10 * ux - 5 * uy},${y2 - 10 * uy + 5 * ux} ${x2 - 10 * ux + 5 * uy},${y2 - 10 * uy - 5 * ux}`}
                    className={FILL[tone]}
                    strokeWidth={0}
                  />
                </g>
              );
            }
            case 'dot':
              return (
                <circle key={i} cx={X(p.at[0])} cy={Y(p.at[1])} r={3.2} className={FILL[tone]} />
              );
            case 'text':
              return (
                <text
                  key={i}
                  x={X(p.at[0])}
                  y={Y(p.at[1]) + 4.5}
                  textAnchor={p.anchor ?? 'middle'}
                  className={`${FILL[tone === 'liquid' ? 'ink' : tone]} text-[13px] font-medium`}
                  style={{ paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}
                >
                  {p.s}
                </text>
              );
          }
        })}
      </svg>
    </figure>
  );
}
