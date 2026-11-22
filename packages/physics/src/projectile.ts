import type { LabModel } from './lab-model.ts';

export type ProjectileParams = { v0: number; angle: number; h0: number; g: number };
export type ProjectileResults = { T: number; L: number; H: number; vEnd: number };

const rad = (deg: number) => (deg * Math.PI) / 180;

function components(p: ProjectileParams) {
  // Exact zeros at 0° and 90° keep the readouts clean (cos 90° ≈ 6e-17 otherwise).
  const vx = p.angle === 90 ? 0 : p.v0 * Math.cos(rad(p.angle));
  const vy = p.angle === 0 ? 0 : p.v0 * Math.sin(rad(p.angle));
  return { vx, vy };
}

/** Time until the body reaches the ground (y = 0): h0 + vy·t − g·t²/2 = 0. */
export function flightTime(p: ProjectileParams): number {
  const { vy } = components(p);
  return (vy + Math.sqrt(vy * vy + 2 * p.g * p.h0)) / p.g;
}

/** Projectile motion without air resistance (x — along the ground, y — up). */
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
  },
  results: {
    T: { unit: 's', symbol: 'T', digits: 2 },
    L: { unit: 'm', symbol: 'L', digits: 1 },
    H: { unit: 'm', symbol: 'H', digits: 1 },
    vEnd: { unit: 'm/s', symbol: 'v', digits: 1 },
  },
  compute: (p) => {
    const { vx, vy } = components(p);
    const T = flightTime(p);
    return {
      T,
      L: vx * T,
      H: p.h0 + (vy * vy) / (2 * p.g),
      vEnd: Math.sqrt(p.v0 * p.v0 + 2 * p.g * p.h0),
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
export function projectileAt(p: ProjectileParams, tau: number): { x: number; y: number } {
  const t = Math.min(Math.max(tau, 0), flightTime(p));
  const { vx, vy } = components(p);
  return { x: vx * t, y: Math.max(0, p.h0 + vy * t - (p.g * t * t) / 2) };
}

/** Velocity components at model time τ (clamped to the flight). */
export function projectileVelocity(p: ProjectileParams, tau: number): { vx: number; vy: number } {
  const t = Math.min(Math.max(tau, 0), flightTime(p));
  const { vx, vy } = components(p);
  return { vx, vy: vy - p.g * t };
}

/** Trajectory y(x) sampled over the flight. */
export function trajectory(p: ProjectileParams, points = 41): { x: number; y: number }[] {
  const T = flightTime(p);
  const n = Math.max(2, points);
  return Array.from({ length: n }, (_, i) => projectileAt(p, (T * i) / (n - 1)));
}

/** Speed |v|(t) sampled over the flight. */
export function speedSeries(p: ProjectileParams, points = 41): { x: number; y: number }[] {
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
  const p = { v0: 40, angle: 45, h0: 50, g: 1.6 };
  const r = projectile.compute(p);
  return { L: r.L, H: projectile.compute({ ...p, angle: 90 }).H };
})();
