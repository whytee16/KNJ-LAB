import type { LabModel } from './lab-model.ts';

export type ProjectileParams = {
  v0: number;
  angle: number;
  h0: number;
  g: number;
  /** Thrown object (THROWN_OBJECTS index): mass, cross-section and drag coefficient. */
  object: number;
  /** 1 — air resistance on (quadratic drag), 0 — the ideal school model. */
  drag: number;
};
/** Functions below also accept the ideal model without the object and drag fields. */
export type ProjectileInput = Omit<ProjectileParams, 'object' | 'drag'> &
  Partial<Pick<ProjectileParams, 'object' | 'drag'>>;
export type ProjectileResults = { T: number; L: number; H: number; vEnd: number; L0: number };

/** Air density near the ground, kg/m³. */
export const AIR_DENSITY = 1.2;

/**
 * Thrown objects: mass m (kg), cross-section S (m²) and drag coefficient Cd.
 * Typical reference values: sphere Cd ≈ 0.47, football ≈ 0.25 at kick speeds, cube ≈ 1.05,
 * flat plate tumbling ≈ 1 (textbook tables of drag coefficients, e.g. Hoerner, «Fluid-Dynamic Drag»).
 */
export const THROWN_OBJECTS = [
  { key: 'ball', m: 0.43, S: Math.PI * 0.11 * 0.11, Cd: 0.25 },
  { key: 'box', m: 1, S: 0.3 * 0.2, Cd: 1.05 },
  { key: 'phone', m: 0.2, S: 0.008, Cd: 1 },
  { key: 'shot', m: 7.26, S: Math.PI * 0.06 * 0.06, Cd: 0.47 },
] as const;

/** Drag factor k in a = −k·|v|·v (1/m); 0 for the ideal model. */
export function dragFactor(p: ProjectileInput): number {
  if (!p.drag) return 0;
  const o = THROWN_OBJECTS[p.object ?? 0] ?? THROWN_OBJECTS[0];
  return (AIR_DENSITY * o.Cd * o.S) / (2 * o.m);
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function components(p: ProjectileInput) {
  // Exact zeros at 0° and 90° keep the readouts clean (cos 90° ≈ 6e-17 otherwise).
  const vx = p.angle === 90 ? 0 : p.v0 * Math.cos(rad(p.angle));
  const vy = p.angle === 0 ? 0 : p.v0 * Math.sin(rad(p.angle));
  return { vx, vy };
}

/** Ideal flight time until the ground (y = 0): h0 + vy·t − g·t²/2 = 0. */
function idealFlightTime(p: ProjectileInput): number {
  const { vy } = components(p);
  return (vy + Math.sqrt(vy * vy + 2 * p.g * p.h0)) / p.g;
}

type Sample = { t: number; x: number; y: number; vx: number; vy: number };
const DT = 0.002;
const cache = new Map<string, Sample[]>();

/**
 * Flight with quadratic air drag, integrated by RK4 with a fixed step until the ground;
 * the last sample is interpolated onto y = 0. Cached: views ask for it every frame.
 */
function dragFlight(p: ProjectileInput): Sample[] {
  const key = [p.v0, p.angle, p.h0, p.g, p.object ?? 0].join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const k = dragFactor(p);
  const { vx, vy } = components(p);
  const f = (s: number[]) => {
    const v = Math.hypot(s[2]!, s[3]!);
    return [s[2]!, s[3]!, -k * v * s[2]!, -p.g - k * v * s[3]!];
  };
  let s = [0, p.h0, vx, vy];
  let t = 0;
  const out: Sample[] = [{ t, x: 0, y: p.h0, vx, vy }];
  const add = (a: number[], b: number[], h: number) => a.map((x, i) => x + b[i]! * h);
  for (let i = 0; i < 200_000; i++) {
    const k1 = f(s);
    const k2 = f(add(s, k1, DT / 2));
    const k3 = f(add(s, k2, DT / 2));
    const k4 = f(add(s, k3, DT));
    const next = s.map((x, j) => x + (DT / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!));
    const nt = t + DT;
    if (next[1]! <= 0 && (t > 0 || vy <= 0)) {
      const w = s[1]! / (s[1]! - next[1]!);
      const lerp = (j: number) => s[j]! + (next[j]! - s[j]!) * w;
      out.push({ t: t + DT * w, x: lerp(0), y: 0, vx: lerp(2), vy: lerp(3) });
      break;
    }
    s = next;
    t = nt;
    out.push({ t, x: s[0]!, y: s[1]!, vx: s[2]!, vy: s[3]! });
  }
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

function sampleAt(path: Sample[], tau: number): Sample {
  const last = path[path.length - 1]!;
  if (tau >= last.t) return last;
  if (tau <= 0) return path[0]!;
  const i = Math.min(Math.floor(tau / DT), path.length - 2);
  const a = path[i]!;
  const b = path[i + 1]!;
  const w = (tau - a.t) / (b.t - a.t || 1);
  return {
    t: tau,
    x: a.x + (b.x - a.x) * w,
    y: a.y + (b.y - a.y) * w,
    vx: a.vx + (b.vx - a.vx) * w,
    vy: a.vy + (b.vy - a.vy) * w,
  };
}

/** Time until the body reaches the ground (with drag when it is on). */
export function flightTime(p: ProjectileInput): number {
  if (!dragFactor(p)) return idealFlightTime(p);
  if (components(p).vy <= 0 && p.h0 === 0) return 0;
  return dragFlight(p).at(-1)!.t;
}

/**
 * Projectile motion (x — along the ground, y — up). Without air resistance — the school formulas;
 * with it — a numerical flight of the chosen object (a = −g·ŷ − k|v|v).
 */
export const projectile: LabModel<ProjectileParams, ProjectileResults> = {
  code: 'projectile',
  params: {
    v0: { min: 1, max: 40, step: 0.5, default: 15, unit: 'm/s', symbol: 'v₀' },
    angle: { min: 0, max: 90, step: 1, default: 45, unit: 'deg', symbol: 'α' },
    h0: { min: 0, max: 50, step: 0.5, default: 0, unit: 'm', symbol: 'h₀' },
    g: {
      min: 1.6,
      max: 9.8,
      step: 0.1,
      default: 9.8,
      unit: 'm/s2',
      symbol: 'g',
      choices: [
        { value: 9.8, key: 'earth' },
        { value: 3.7, key: 'mars' },
        { value: 1.6, key: 'moon' },
      ],
    },
    object: {
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      unit: '1',
      symbol: '',
      choices: THROWN_OBJECTS.map((o, value) => ({ value, key: o.key })),
    },
    drag: {
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      unit: '1',
      symbol: '',
      choices: [
        { value: 0, key: 'off' },
        { value: 1, key: 'on' },
      ],
    },
  },
  results: {
    T: { unit: 's', symbol: 'T', digits: 2 },
    L: { unit: 'm', symbol: 'L', digits: 1 },
    H: { unit: 'm', symbol: 'H', digits: 1 },
    vEnd: { unit: 'm/s', symbol: 'v', digits: 1 },
    L0: { unit: 'm', symbol: 'L₀', digits: 1, when: { param: 'drag', value: 1 } },
  },
  compute: (p) => {
    const { vx, vy } = components(p);
    const T0 = idealFlightTime(p);
    const L0 = vx * T0;
    if (!dragFactor(p)) {
      return {
        T: T0,
        L: L0,
        H: p.h0 + (vy * vy) / (2 * p.g),
        vEnd: Math.sqrt(p.v0 * p.v0 + 2 * p.g * p.h0),
        L0,
      };
    }
    const path = dragFlight(p);
    const end = path.at(-1)!;
    return {
      T: end.t,
      L: end.x,
      H: Math.max(...path.map((q) => q.y)),
      vEnd: Math.hypot(end.vx, end.vy),
      L0,
    };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.noAir',
    'labs.assumptions.constantG',
    'labs.assumptions.flatGround',
  ],
};

/** Position at model time τ, clamped to the flight. */
export function projectileAt(p: ProjectileInput, tau: number): { x: number; y: number } {
  if (dragFactor(p)) {
    const q = sampleAt(dragFlight(p), tau);
    return { x: q.x, y: Math.max(0, q.y) };
  }
  const t = Math.min(Math.max(tau, 0), flightTime(p));
  const { vx, vy } = components(p);
  return { x: vx * t, y: Math.max(0, p.h0 + vy * t - (p.g * t * t) / 2) };
}

/** Velocity components at model time τ (clamped to the flight). */
export function projectileVelocity(p: ProjectileInput, tau: number): { vx: number; vy: number } {
  if (dragFactor(p)) {
    const q = sampleAt(dragFlight(p), tau);
    return { vx: q.vx, vy: q.vy };
  }
  const t = Math.min(Math.max(tau, 0), flightTime(p));
  const { vx, vy } = components(p);
  return { vx, vy: vy - p.g * t };
}

/** Trajectory y(x) sampled over the flight. */
export function trajectory(p: ProjectileInput, points = 41): { x: number; y: number }[] {
  const T = flightTime(p);
  const n = Math.max(2, points);
  return Array.from({ length: n }, (_, i) => projectileAt(p, (T * i) / (n - 1)));
}

/** Speed |v|(t) sampled over the flight. */
export function speedSeries(p: ProjectileInput, points = 41): { x: number; y: number }[] {
  const T = flightTime(p);
  const n = Math.max(2, points);
  return Array.from({ length: n }, (_, i) => {
    const t = (T * i) / (n - 1);
    const v = projectileVelocity(p, t);
    return { x: t, y: Math.hypot(v.vx, v.vy) };
  });
}

/** Largest range/height any allowed parameters give (for fixed scene bounds). */
export const PROJECTILE_MAX = (() => {
  const p = { v0: 40, angle: 45, h0: 50, g: 1.6, object: 0, drag: 0 };
  const r = projectile.compute(p);
  return { L: r.L, H: projectile.compute({ ...p, angle: 90 }).H };
})();
