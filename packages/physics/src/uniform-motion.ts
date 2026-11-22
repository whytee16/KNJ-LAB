import type { LabModel } from './lab-model.ts';

export type UniformMotionParams = { v: number; t: number; x0: number };
export type UniformMotionResults = { S: number; x: number };

/** Uniform straight-line motion: S = v·t, x = x₀ + S. Reference lab of the template. */
export const uniformMotion: LabModel<UniformMotionParams, UniformMotionResults> = {
  code: 'uniform-motion',
  params: {
    v: { min: 0, max: 30, step: 0.5, default: 5, unit: 'm/s', symbol: 'v' },
    t: { min: 0, max: 20, step: 0.5, default: 10, unit: 's', symbol: 't' },
    x0: { min: 0, max: 100, step: 1, default: 0, unit: 'm', symbol: 'x₀' },
  },
  results: {
    S: { unit: 'm', symbol: 'S', digits: 1 },
    x: { unit: 'm', symbol: 'x', digits: 1 },
  },
  compute: ({ v, t, x0 }) => {
    const S = v * t;
    return { S, x: x0 + S };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.constantSpeed',
    'labs.assumptions.straightLine',
  ],
};

/** Position at model time τ (the body stops when τ reaches t). */
export function positionAt(p: UniformMotionParams, tau: number): number {
  const time = Math.min(Math.max(tau, 0), p.t);
  return p.x0 + p.v * time;
}

/** Path travelled S(τ) sampled on [0, t] for the chart. */
export function pathSeries(p: UniformMotionParams, points = 21): { x: number; y: number }[] {
  const n = Math.max(2, points);
  return Array.from({ length: n }, (_, i) => {
    const tau = (p.t * i) / (n - 1);
    return { x: tau, y: p.v * tau };
  });
}

/** Largest coordinate the track must show for any allowed parameters. */
export const UNIFORM_MOTION_TRACK_MAX =
  uniformMotion.params.x0.max + uniformMotion.params.v.max * uniformMotion.params.t.max;
