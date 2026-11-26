import { z } from 'zod';
import { evalNumber } from './expr.ts';
import { substitute, type EngineLocale } from './format.ts';

/**
 * Figures of tasks (ADR-0012): a declarative description in the template spec. Numbers are
 * mathjs expressions over the task params, labels are texts with {{param}} placeholders. The
 * server resolves them for the drawn params and lays the figure out into plain primitives; the
 * browser only draws them. A figure shows what the statement gives, never the answer.
 */
const num = z.union([z.number(), z.string().min(1).max(200)]);
const label = z.string().max(40);
const labels = <K extends string>(keys: readonly K[]) =>
  z
    .object(
      Object.fromEntries(keys.map((k) => [k, label.optional()])) as Record<
        K,
        z.ZodOptional<typeof label>
      >,
    )
    .default({} as never);

export const figureSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('right_triangle'),
    /** Legs: a = BC (vertical), b = AC (horizontal); the right angle is at C. */
    a: num,
    b: num,
    labels: labels(['a', 'b', 'c', 'angleA', 'angleB'] as const),
    vertices: z.tuple([label, label, label]).optional(),
  }),
  z.object({
    kind: z.literal('triangle'),
    /** Sides a = BC, b = AC, c = AB. */
    a: num,
    b: num,
    c: num,
    labels: labels(['a', 'b', 'c', 'A', 'B', 'C'] as const),
    vertices: z.tuple([label, label, label]).optional(),
  }),
  z.object({
    kind: z.literal('circle'),
    r: num,
    /** Central angle of a chord at the bottom of the circle, degrees. */
    chord: num.optional(),
    central: z.boolean().default(false),
    inscribed: z.boolean().default(false),
    tangent: z.boolean().default(false),
    labels: labels(['r', 'chord', 'central', 'inscribed', 'tangent'] as const),
  }),
  z.object({
    kind: z.literal('quad'),
    shape: z.enum(['parallelogram', 'rectangle', 'rhombus', 'square', 'trapezoid']),
    /** Bottom base (all), side (parallelogram), top base and height (trapezoid). */
    a: num,
    b: num.optional(),
    angle: num.optional(),
    top: num.optional(),
    h: num.optional(),
    /** Trapezoid: how far the top base starts from the left end of the bottom one. */
    shift: num.optional(),
    height: z.boolean().default(false),
    diagonals: z.boolean().default(false),
    labels: labels(['a', 'b', 'top', 'h', 'angle', 'd'] as const),
    vertices: z.tuple([label, label, label, label]).optional(),
  }),
  z.object({
    kind: z.literal('plot'),
    x: z.tuple([num, num]),
    y: z.tuple([num, num]).optional(),
    functions: z
      .array(z.object({ expr: z.string().min(1).max(200), label: label.optional() }))
      .max(3)
      .default([]),
    lines: z
      .array(
        z.object({
          points: z
            .array(z.tuple([num, num]))
            .min(2)
            .max(12),
          label: label.optional(),
        }),
      )
      .max(3)
      .default([]),
    points: z
      .array(z.object({ x: num, y: num, label: label.optional() }))
      .max(6)
      .default([]),
    axes: labels(['x', 'y'] as const),
  }),
  z.object({
    kind: z.literal('forces'),
    body: z.enum(['box', 'ball']).default('box'),
    surface: z.enum(['none', 'floor', 'incline']).default('none'),
    incline: num.optional(),
    forces: z
      .array(z.object({ angle: num, size: num, label: label.optional() }))
      .min(1)
      .max(6),
  }),
  z.object({
    kind: z.literal('lever'),
    left: num,
    right: num,
    labels: labels(['left', 'right', 'f1', 'f2'] as const),
  }),
  z.object({
    kind: z.literal('vessel'),
    h: num,
    /** A body in the liquid: its size and the depth of its top, in the same units as h. */
    body: z.object({ size: num, depth: num }).optional(),
    labels: labels(['h', 'liquid', 'body'] as const),
  }),
  z.object({
    kind: z.literal('circuit'),
    mode: z.enum(['series', 'parallel']),
    resistors: z.array(label).min(1).max(3),
    source: label.optional(),
    ammeter: z.boolean().default(false),
    voltmeter: z.enum(['none', 'total', 'first']).default('none'),
  }),
]);
export type FigureSpec = z.infer<typeof figureSchema>;

export type Pt = [number, number];
export type Tone = 'ink' | 'muted' | 'accent' | 'info' | 'success' | 'liquid';
/** Drawing primitives in figure units, y up. */
export type Prim =
  | { t: 'line'; a: Pt; b: Pt; dash?: boolean; tone?: Tone; width?: number }
  | { t: 'poly'; pts: Pt[]; closed?: boolean; fill?: Tone; tone?: Tone; dash?: boolean }
  | { t: 'circle'; c: Pt; r: number; fill?: Tone; tone?: Tone }
  | { t: 'arc'; c: Pt; r: number; a0: number; a1: number; tone?: Tone }
  | { t: 'mark'; at: Pt; u: Pt; v: Pt; size: number }
  | { t: 'arrow'; a: Pt; b: Pt; tone?: Tone }
  | { t: 'text'; at: Pt; s: string; anchor?: 'start' | 'middle' | 'end'; tone?: Tone }
  | { t: 'dot'; at: Pt; tone?: Tone };
export interface FigureScene {
  kind: FigureSpec['kind'];
  prims: Prim[];
}

export class FigureError extends Error {}

const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
const sub = (p: Pt, q: Pt): Pt => [p[0] - q[0], p[1] - q[1]];
const mul = (p: Pt, k: number): Pt => [p[0] * k, p[1] * k];
const len = (p: Pt) => Math.hypot(p[0], p[1]);
const unit = (p: Pt): Pt => mul(p, 1 / (len(p) || 1));
const mid = (p: Pt, q: Pt): Pt => mul(add(p, q), 0.5);
const rad = (d: number) => (d * Math.PI) / 180;
const polar = (r: number, deg: number): Pt => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
const centroid = (pts: Pt[]) => mul(pts.reduce(add, [0, 0]), 1 / pts.length);

/** Label beside the segment pq, on the side away from `inside`. */
function sideLabel(p: Pt, q: Pt, inside: Pt, s: string | undefined, gap: number): Prim[] {
  if (!s) return [];
  const m = mid(p, q);
  let n = unit([-(q[1] - p[1]), q[0] - p[0]]);
  if ((m[0] - inside[0]) * n[0] + (m[1] - inside[1]) * n[1] < 0) n = mul(n, -1);
  return [{ t: 'text', at: add(m, mul(n, gap)), s }];
}

/** Angle arc at vertex v between the rays to p and q with a label inside it. */
function angleArc(v: Pt, p: Pt, q: Pt, r: number, s?: string): Prim[] {
  let a0 = Math.atan2(p[1] - v[1], p[0] - v[0]);
  let a1 = Math.atan2(q[1] - v[1], q[0] - v[0]);
  let d = a1 - a0;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  if (d < 0) [a0, a1] = [a1, a0];
  const span = Math.abs(d);
  const out: Prim[] = [{ t: 'arc', c: v, r, a0, a1: a0 + span, tone: 'accent' }];
  if (s)
    out.push({
      t: 'text',
      at: add(v, polar(r * 1.9, ((a0 + span / 2) * 180) / Math.PI)),
      s,
      tone: 'accent',
    });
  return out;
}

function vertexNames(pts: Pt[], names: readonly string[] | undefined, gap: number): Prim[] {
  if (!names) return [];
  const c = centroid(pts);
  return pts.map((p, i) => ({
    t: 'text' as const,
    at: add(p, mul(unit(sub(p, c)), gap)),
    s: names[i] ?? '',
  }));
}

const positive = (v: number, what: string) => {
  if (!(v > 0) || !Number.isFinite(v)) throw new FigureError(`${what} must be positive`);
  return v;
};

/** Resolves a figure for the drawn params and lays it out. Throws FigureError if impossible. */
export function buildFigure(
  spec: FigureSpec,
  params: Record<string, number>,
  locale: EngineLocale,
): FigureScene {
  const n = (v: string | number) => (typeof v === 'number' ? v : evalNumber(v, params));
  const L = (s: string | undefined) => (s ? substitute(s, params, locale) : undefined);
  const prims: Prim[] = [];

  switch (spec.kind) {
    case 'right_triangle': {
      const a = positive(n(spec.a), 'a');
      const b = positive(n(spec.b), 'b');
      const g = Math.max(a, b) * 0.09;
      const C: Pt = [0, 0];
      const A: Pt = [b, 0];
      const B: Pt = [0, a];
      const inside = centroid([A, B, C]);
      prims.push({ t: 'poly', pts: [A, B, C], closed: true, tone: 'ink' });
      prims.push({ t: 'mark', at: C, u: [1, 0], v: [0, 1], size: g * 0.9 });
      prims.push(...sideLabel(B, C, inside, L(spec.labels.a), g));
      prims.push(...sideLabel(A, C, inside, L(spec.labels.b), g));
      prims.push(...sideLabel(A, B, inside, L(spec.labels.c), g));
      if (spec.labels.angleA) prims.push(...angleArc(A, C, B, g * 1.3, L(spec.labels.angleA)));
      if (spec.labels.angleB) prims.push(...angleArc(B, C, A, g * 1.3, L(spec.labels.angleB)));
      prims.push(...vertexNames([A, B, C], spec.vertices, g * 0.9));
      break;
    }
    case 'triangle': {
      const a = positive(n(spec.a), 'a');
      const b = positive(n(spec.b), 'b');
      const c = positive(n(spec.c), 'c');
      if (a + b <= c || a + c <= b || b + c <= a) throw new FigureError('no such triangle');
      const A: Pt = [0, 0];
      const B: Pt = [c, 0];
      const cx = (b * b + c * c - a * a) / (2 * c);
      const C: Pt = [cx, Math.sqrt(Math.max(b * b - cx * cx, 0))];
      const g = Math.max(a, b, c) * 0.08;
      const inside = centroid([A, B, C]);
      prims.push({ t: 'poly', pts: [A, B, C], closed: true, tone: 'ink' });
      prims.push(...sideLabel(B, C, inside, L(spec.labels.a), g));
      prims.push(...sideLabel(A, C, inside, L(spec.labels.b), g));
      prims.push(...sideLabel(A, B, inside, L(spec.labels.c), g));
      if (spec.labels.A) prims.push(...angleArc(A, B, C, g * 1.3, L(spec.labels.A)));
      if (spec.labels.B) prims.push(...angleArc(B, C, A, g * 1.3, L(spec.labels.B)));
      if (spec.labels.C) prims.push(...angleArc(C, A, B, g * 1.3, L(spec.labels.C)));
      prims.push(...vertexNames([A, B, C], spec.vertices, g * 0.9));
      break;
    }
    case 'circle': {
      const r = positive(n(spec.r), 'r');
      const O: Pt = [0, 0];
      const g = r * 0.12;
      prims.push({ t: 'circle', c: O, r, tone: 'ink' }, { t: 'dot', at: O });
      prims.push({ t: 'text', at: [g * 0.6, g * 0.9], s: 'O' });
      if (spec.labels.r && !spec.tangent) {
        const R = polar(r, 150);
        prims.push({ t: 'line', a: O, b: R, tone: 'ink' });
        prims.push(...sideLabel(O, R, [0, -r], L(spec.labels.r), g * 0.7));
      }
      if (spec.chord !== undefined) {
        const phi = n(spec.chord);
        if (!(phi > 0 && phi < 360)) throw new FigureError('chord angle out of range');
        const P1 = polar(r, -90 - phi / 2);
        const P2 = polar(r, -90 + phi / 2);
        prims.push({ t: 'line', a: P1, b: P2, tone: 'ink' });
        prims.push(...sideLabel(P1, P2, O, L(spec.labels.chord), g * 0.8));
        if (spec.central) {
          prims.push(
            { t: 'line', a: O, b: P1, tone: 'muted' },
            { t: 'line', a: O, b: P2, tone: 'muted' },
          );
          prims.push(...angleArc(O, P1, P2, g * 1.6, L(spec.labels.central)));
        }
        if (spec.inscribed) {
          const Q = polar(r, 90);
          prims.push(
            { t: 'line', a: Q, b: P1, tone: 'info' },
            { t: 'line', a: Q, b: P2, tone: 'info' },
          );
          prims.push(...angleArc(Q, P1, P2, g * 1.8, L(spec.labels.inscribed)));
          prims.push({ t: 'dot', at: Q });
        }
        prims.push({ t: 'dot', at: P1 }, { t: 'dot', at: P2 });
      }
      if (spec.tangent) {
        const T: Pt = [r, 0];
        prims.push({ t: 'line', a: O, b: T, tone: 'ink' });
        prims.push(...sideLabel(O, T, [0, r], L(spec.labels.r), g * 0.7));
        prims.push({ t: 'line', a: [r, -r * 1.1], b: [r, r * 1.1], tone: 'info' });
        prims.push({ t: 'mark', at: T, u: [-1, 0], v: [0, 1], size: g * 0.7 });
        if (spec.labels.tangent)
          prims.push({
            t: 'text',
            at: [r + g, r * 0.9],
            s: L(spec.labels.tangent)!,
            anchor: 'start',
          });
      }
      break;
    }
    case 'quad': {
      const a = positive(n(spec.a), 'a');
      let pts: Pt[];
      if (spec.shape === 'trapezoid') {
        const top = positive(n(spec.top ?? 0), 'top');
        const h = positive(n(spec.h ?? 0), 'h');
        const shift = spec.shift !== undefined ? n(spec.shift) : (a - top) / 2;
        pts = [
          [0, 0],
          [a, 0],
          [shift + top, h],
          [shift, h],
        ];
      } else {
        const b =
          spec.shape === 'rhombus' || spec.shape === 'square' ? a : positive(n(spec.b ?? 0), 'b');
        const angle =
          spec.shape === 'rectangle' || spec.shape === 'square' ? 90 : n(spec.angle ?? 60);
        if (!(angle > 0 && angle < 180)) throw new FigureError('angle out of range');
        const D = polar(b, angle);
        pts = [[0, 0], [a, 0], add([a, 0], D), D];
      }
      const [A, B, C, D] = pts as [Pt, Pt, Pt, Pt];
      const size = Math.max(...pts.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
      const g = size * 0.08;
      const inside = centroid(pts);
      prims.push({ t: 'poly', pts, closed: true, tone: 'ink' });
      if (spec.diagonals) {
        prims.push(
          { t: 'line', a: A, b: C, dash: true, tone: 'muted' },
          { t: 'line', a: B, b: D, dash: true, tone: 'muted' },
        );
        if (spec.labels.d)
          prims.push({ t: 'text', at: add(mid(A, C), [0, g * 0.8]), s: L(spec.labels.d)! });
      }
      if (spec.height) {
        const foot: Pt = [D[0], 0];
        prims.push({ t: 'line', a: D, b: foot, dash: true, tone: 'info' });
        prims.push({ t: 'mark', at: foot, u: [1, 0], v: [0, 1], size: g * 0.7 });
        if (spec.labels.h)
          prims.push({
            t: 'text',
            at: [D[0] + g * 0.7, D[1] / 2],
            s: L(spec.labels.h)!,
            anchor: 'start',
            tone: 'info',
          });
      }
      prims.push(...sideLabel(A, B, inside, L(spec.labels.a), g));
      prims.push(...sideLabel(A, D, inside, L(spec.labels.b), g));
      prims.push(...sideLabel(D, C, inside, L(spec.labels.top), g));
      if (spec.labels.angle) prims.push(...angleArc(A, B, D, g * 1.2, L(spec.labels.angle)));
      prims.push(...vertexNames(pts, spec.vertices, g * 0.9));
      break;
    }
    case 'plot':
      prims.push(...plotPrims(spec, n, L, params));
      break;
    case 'forces': {
      const tilt = spec.surface === 'incline' ? n(spec.incline ?? 30) : 0;
      if (!(tilt >= 0 && tilt < 80)) throw new FigureError('incline out of range');
      const sizes = spec.forces.map((f) => Math.abs(n(f.size)));
      const max = Math.max(...sizes, 1e-9);
      const rot = (p: Pt): Pt => {
        const c = Math.cos(rad(tilt));
        const s = Math.sin(rad(tilt));
        return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
      };
      if (spec.surface !== 'none')
        prims.push({
          t: 'line',
          a: rot([-2.6, -0.5]),
          b: rot([2.6, -0.5]),
          tone: 'muted',
          width: 2,
        });
      if (spec.surface === 'incline')
        prims.push({
          t: 'line',
          a: rot([-2.6, -0.5]),
          b: [rot([2.6, -0.5])[0], rot([-2.6, -0.5])[1]],
          tone: 'muted',
        });
      if (spec.body === 'ball')
        prims.push({ t: 'circle', c: [0, 0], r: 0.5, fill: 'accent', tone: 'ink' });
      else
        prims.push({
          t: 'poly',
          pts: [rot([-0.5, -0.5]), rot([0.5, -0.5]), rot([0.5, 0.5]), rot([-0.5, 0.5])],
          closed: true,
          fill: 'accent',
          tone: 'ink',
        });
      spec.forces.forEach((f, i) => {
        if (sizes[i]! < max * 1e-3) return;
        const tip = polar(0.7 + 1.8 * (sizes[i]! / max), n(f.angle));
        prims.push({ t: 'arrow', a: [0, 0], b: tip, tone: 'info' });
        if (f.label)
          prims.push({
            t: 'text',
            at: add(tip, mul(unit(tip), 0.35)),
            s: L(f.label)!,
            tone: 'info',
          });
      });
      break;
    }
    case 'lever': {
      const l = positive(n(spec.left), 'left');
      const r = positive(n(spec.right), 'right');
      const k = 4 / Math.max(l, r);
      const Lx = -l * k;
      const Rx = r * k;
      prims.push({ t: 'line', a: [Lx, 0], b: [Rx, 0], tone: 'ink', width: 4 });
      prims.push({
        t: 'poly',
        pts: [
          [0, 0],
          [-0.4, -0.7],
          [0.4, -0.7],
        ],
        closed: true,
        fill: 'muted',
        tone: 'ink',
      });
      prims.push(
        { t: 'arrow', a: [Lx, 0], b: [Lx, -1.4], tone: 'info' },
        { t: 'arrow', a: [Rx, 0], b: [Rx, -1.4], tone: 'info' },
      );
      if (spec.labels.f1)
        prims.push({ t: 'text', at: [Lx, -1.8], s: L(spec.labels.f1)!, tone: 'info' });
      if (spec.labels.f2)
        prims.push({ t: 'text', at: [Rx, -1.8], s: L(spec.labels.f2)!, tone: 'info' });
      prims.push(
        { t: 'line', a: [Lx, 0.45], b: [0, 0.45], tone: 'muted' },
        { t: 'line', a: [0, 0.45], b: [Rx, 0.45], tone: 'muted' },
      );
      for (const x of [Lx, 0, Rx])
        prims.push({ t: 'line', a: [x, 0.3], b: [x, 0.6], tone: 'muted' });
      if (spec.labels.left) prims.push({ t: 'text', at: [Lx / 2, 0.85], s: L(spec.labels.left)! });
      if (spec.labels.right)
        prims.push({ t: 'text', at: [Rx / 2, 0.85], s: L(spec.labels.right)! });
      break;
    }
    case 'vessel': {
      const h = positive(n(spec.h), 'h');
      const k = 3 / h;
      const W = 3;
      const top = 3.8;
      prims.push({
        t: 'poly',
        pts: [
          [0, 0],
          [W, 0],
          [W, 3],
          [0, 3],
        ],
        closed: true,
        fill: 'liquid',
      });
      prims.push({
        t: 'poly',
        pts: [
          [0, top],
          [0, 0],
          [W, 0],
          [W, top],
        ],
        tone: 'ink',
        closed: false,
      });
      prims.push({ t: 'line', a: [W + 0.35, 0], b: [W + 0.35, 3], tone: 'muted' });
      prims.push(
        { t: 'line', a: [W + 0.2, 0], b: [W + 0.5, 0], tone: 'muted' },
        { t: 'line', a: [W + 0.2, 3], b: [W + 0.5, 3], tone: 'muted' },
      );
      if (spec.labels.h)
        prims.push({ t: 'text', at: [W + 0.6, 1.5], s: L(spec.labels.h)!, anchor: 'start' });
      if (spec.labels.liquid)
        prims.push({ t: 'text', at: [W / 2, 0.4], s: L(spec.labels.liquid)! });
      if (spec.body) {
        const s = positive(n(spec.body.size), 'body size') * k;
        const d = n(spec.body.depth) * k;
        if (s > 2.6 || d < 0 || d + s > 3) throw new FigureError('body does not fit the vessel');
        const y = 3 - d;
        prims.push({
          t: 'poly',
          pts: [
            [W / 2 - s / 2, y - s],
            [W / 2 + s / 2, y - s],
            [W / 2 + s / 2, y],
            [W / 2 - s / 2, y],
          ],
          closed: true,
          fill: 'accent',
          tone: 'ink',
        });
        if (spec.labels.body)
          prims.push({
            t: 'text',
            at: [W / 2 + s / 2 + 0.15, y - s / 2],
            s: L(spec.labels.body)!,
            anchor: 'start',
          });
      }
      break;
    }
    case 'circuit':
      prims.push(...circuitPrims(spec, L));
      break;
  }
  return { kind: spec.kind, prims };
}

function niceStep(span: number) {
  const raw = span / 6;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
}

function plotPrims(
  spec: Extract<FigureSpec, { kind: 'plot' }>,
  n: (v: string | number) => number,
  L: (s: string | undefined) => string | undefined,
  params: Record<string, number>,
): Prim[] {
  const [x0, x1] = [n(spec.x[0]), n(spec.x[1])];
  if (!(x1 > x0)) throw new FigureError('empty x range');
  const curves: Pt[][] = [];
  for (const f of spec.functions) {
    let cur: Pt[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = x0 + ((x1 - x0) * i) / 240;
      let y: number;
      try {
        y = evalNumber(f.expr, { ...params, x });
      } catch {
        y = NaN;
      }
      if (Number.isFinite(y)) cur.push([x, y]);
      else if (cur.length) {
        curves.push(cur);
        cur = [];
      }
    }
    if (cur.length) curves.push(cur);
  }
  const lines = spec.lines.map((l) => l.points.map(([a, b]) => [n(a), n(b)] as Pt));
  const points = spec.points.map((p) => [n(p.x), n(p.y)] as Pt);
  let y0: number;
  let y1: number;
  if (spec.y) [y0, y1] = [n(spec.y[0]), n(spec.y[1])];
  else {
    const ys = [...curves.flat(), ...lines.flat(), ...points].map((p) => p[1]);
    y0 = Math.min(0, ...ys);
    y1 = Math.max(0, ...ys);
    const pad = (y1 - y0 || 1) * 0.1;
    y0 -= pad;
    y1 += pad;
  }
  if (!(y1 > y0)) throw new FigureError('empty y range');
  // Map into a 10 × 7 box so the renderer can keep one scale.
  const W = 10;
  const H = 7;
  const X = (x: number) => ((x - x0) / (x1 - x0)) * W;
  const Y = (y: number) =>
    ((Math.min(Math.max(y, y0 - (y1 - y0)), y1 + (y1 - y0)) - y0) / (y1 - y0)) * H;
  const P = (p: Pt): Pt => [X(p[0]), Y(p[1])];
  const out: Prim[] = [];
  const sx = niceStep(x1 - x0);
  const sy = niceStep(y1 - y0);
  for (let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx) {
    out.push({ t: 'line', a: [X(v), 0], b: [X(v), H], tone: 'muted', width: 0.5 });
    if (Math.abs(v) > 1e-9) out.push({ t: 'text', at: [X(v), Y(0) - 0.35], s: fmt(v) });
  }
  for (let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy) {
    out.push({ t: 'line', a: [0, Y(v)], b: [W, Y(v)], tone: 'muted', width: 0.5 });
    if (Math.abs(v) > 1e-9)
      out.push({ t: 'text', at: [X(0) - 0.2, Y(v)], s: fmt(v), anchor: 'end' });
  }
  if (x0 <= 0 && x1 >= 0) out.push({ t: 'arrow', a: [X(0), 0], b: [X(0), H + 0.3], tone: 'ink' });
  if (y0 <= 0 && y1 >= 0) out.push({ t: 'arrow', a: [0, Y(0)], b: [W + 0.3, Y(0)], tone: 'ink' });
  if (spec.axes.x)
    out.push({
      t: 'text',
      at: [W + 0.4, Y(Math.max(y0, Math.min(0, y1))) + 0.35],
      s: L(spec.axes.x)!,
      anchor: 'end',
    });
  if (spec.axes.y)
    out.push({
      t: 'text',
      at: [X(Math.max(x0, Math.min(0, x1))) + 0.25, H + 0.45],
      s: L(spec.axes.y)!,
      anchor: 'start',
    });
  const tones: Tone[] = ['accent', 'info', 'success'];
  // Curves are cut at the edges of the y range: a branch that leaves it starts a new piece.
  curves.forEach((c) => {
    let piece: Pt[] = [];
    const flush = () => {
      if (piece.length > 1) out.push({ t: 'poly', pts: piece.map(P), tone: tones[0] });
      piece = [];
    };
    for (const p of c) {
      if (p[1] >= y0 && p[1] <= y1) piece.push(p);
      else flush();
    }
    flush();
  });
  spec.functions.forEach((f, i) => {
    if (!f.label) return;
    out.push({
      t: 'text',
      at: [W - 0.2, H - 0.4 - i * 0.6],
      s: L(f.label)!,
      anchor: 'end',
      tone: tones[i % 3],
    });
  });
  lines.forEach((l, i) => {
    out.push({ t: 'poly', pts: l.map(P), tone: tones[(i + spec.functions.length) % 3] });
    const lab = spec.lines[i]!.label;
    if (lab)
      out.push({
        t: 'text',
        at: add(P(l[l.length - 1]!), [0, 0.4]),
        s: L(lab)!,
        anchor: 'end',
        tone: tones[(i + spec.functions.length) % 3],
      });
  });
  points.forEach((p, i) => {
    out.push({ t: 'dot', at: P(p), tone: 'ink' });
    const lab = spec.points[i]!.label;
    if (lab) out.push({ t: 'text', at: add(P(p), [0.3, 0.35]), s: L(lab)!, anchor: 'start' });
  });
  return out;
}

const fmt = (v: number) =>
  String(Math.round(v * 1000) / 1000)
    .replace('.', ',')
    .replace('-', '−');

function circuitPrims(
  spec: Extract<FigureSpec, { kind: 'circuit' }>,
  L: (s: string | undefined) => string | undefined,
): Prim[] {
  const out: Prim[] = [];
  const R = (c: Pt, s: string): Prim[] => [
    {
      t: 'poly',
      pts: [
        [c[0] - 0.6, c[1] - 0.22],
        [c[0] + 0.6, c[1] - 0.22],
        [c[0] + 0.6, c[1] + 0.22],
        [c[0] - 0.6, c[1] + 0.22],
      ],
      closed: true,
      fill: 'ink',
      tone: 'ink',
    },
    { t: 'text', at: [c[0], c[1] + 0.55], s },
  ];
  const meter = (c: Pt, s: string): Prim[] => [
    { t: 'circle', c, r: 0.32, tone: 'ink', fill: 'liquid' },
    { t: 'text', at: [c[0], c[1] - 0.12], s },
  ];
  const W = 8;
  const H = 4;
  // Frame: source on the left side, the load on the top side.
  out.push({ t: 'line', a: [0, 0], b: [W, 0] }, { t: 'line', a: [W, 0], b: [W, H] });
  out.push({ t: 'line', a: [0, 0], b: [0, 1.7] }, { t: 'line', a: [0, 2.3], b: [0, H] });
  out.push(
    { t: 'line', a: [-0.45, 1.7], b: [0.45, 1.7], width: 3 },
    { t: 'line', a: [-0.25, 2.3], b: [0.25, 2.3], width: 3 },
  );
  const src = L(spec.source);
  if (src) out.push({ t: 'text', at: [-0.7, 2], s: src, anchor: 'end' });
  if (spec.ammeter) out.push(...meter([W / 2, 0], 'A'));
  const names = spec.resistors.map((s) => L(s) ?? '');
  if (spec.mode === 'series') {
    out.push({ t: 'line', a: [0, H], b: [W, H] });
    const xs = names.map((_, i) => ((i + 1) * W) / (names.length + 1));
    names.forEach((s, i) => out.push(...R([xs[i]!, H], s)));
    if (spec.voltmeter !== 'none') {
      const a = spec.voltmeter === 'first' ? xs[0]! - 1 : 0.6;
      const b = spec.voltmeter === 'first' ? xs[0]! + 1 : W - 0.6;
      out.push(
        { t: 'line', a: [a, H], b: [a, H + 1.2] },
        { t: 'line', a: [b, H], b: [b, H + 1.2] },
      );
      out.push(
        { t: 'line', a: [a, H + 1.2], b: [(a + b) / 2 - 0.32, H + 1.2] },
        { t: 'line', a: [(a + b) / 2 + 0.32, H + 1.2], b: [b, H + 1.2] },
      );
      out.push(...meter([(a + b) / 2, H + 1.2], 'V'));
    }
  } else {
    const x0 = 2;
    const x1 = W - 2;
    out.push({ t: 'line', a: [0, H], b: [x0, H] }, { t: 'line', a: [x1, H], b: [W, H] });
    names.forEach((s, i) => {
      const y = H + i * 1.3;
      out.push({ t: 'line', a: [x0, y], b: [x1, y] });
      out.push(...R([(x0 + x1) / 2, y], s));
    });
    out.push(
      { t: 'line', a: [x0, H], b: [x0, H + (names.length - 1) * 1.3] },
      { t: 'line', a: [x1, H], b: [x1, H + (names.length - 1) * 1.3] },
    );
    if (spec.voltmeter !== 'none') {
      const y = H + names.length * 1.3;
      out.push(
        { t: 'line', a: [x0, H + (names.length - 1) * 1.3], b: [x0, y] },
        { t: 'line', a: [x1, H + (names.length - 1) * 1.3], b: [x1, y] },
      );
      out.push(
        { t: 'line', a: [x0, y], b: [W / 2 - 0.32, y] },
        { t: 'line', a: [W / 2 + 0.32, y], b: [x1, y] },
      );
      out.push(...meter([W / 2, y], 'V'));
    }
  }
  return out.map((p) => (p.t === 'line' && !p.tone ? { ...p, tone: 'ink' as const } : p));
}
