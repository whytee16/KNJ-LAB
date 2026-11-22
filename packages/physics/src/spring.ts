import type { LabModel } from './lab-model.ts';

export type SpringParams = { m: number; k: number; A: number };
export type SpringResults = {
  T: number;
  omega: number;
  nu: number;
  E: number;
  vMax: number;
  aMax: number;
};

/** Horizontal spring pendulum without friction, released from rest at x = A. */
export const springPendulum: LabModel<SpringParams, SpringResults> = {
  code: 'spring-pendulum',
  params: {
    m: { min: 0.1, max: 5, step: 0.1, default: 1, unit: 'kg', symbol: 'm' },
    k: { min: 5, max: 200, step: 1, default: 40, unit: 'N/m', symbol: 'k' },
    A: { min: 0.01, max: 0.3, step: 0.01, default: 0.1, unit: 'm', symbol: 'A' },
  },
  results: {
    T: { unit: 's', symbol: 'T', digits: 3 },
    omega: { unit: '1', symbol: 'ω, рад/с', digits: 2 },
    nu: { unit: 'Hz', symbol: 'ν', digits: 3 },
    E: { unit: 'J', symbol: 'E', digits: 3 },
    vMax: { unit: 'm/s', symbol: 'vₘₐₓ', digits: 3 },
    aMax: { unit: 'm/s2', symbol: 'aₘₐₓ', digits: 2 },
  },
  compute: ({ m, k, A }) => {
    const omega = Math.sqrt(k / m);
    return {
      T: (2 * Math.PI) / omega,
      omega,
      nu: omega / (2 * Math.PI),
      E: (k * A * A) / 2,
      vMax: omega * A,
      aMax: omega * omega * A,
    };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.weightlessSpring',
    'labs.assumptions.hooke',
    'labs.assumptions.noFriction',
  ],
};

/** x(t) = A·cos ωt and its derivatives; energies kx²/2 and mv²/2. */
export function springAt(p: SpringParams, tau: number) {
  const w = Math.sqrt(p.k / p.m);
  const t = Math.max(tau, 0);
  const x = p.A * Math.cos(w * t);
  const v = -p.A * w * Math.sin(w * t);
  const a = -w * w * x;
  return { x, v, a, F: -p.k * x, Ek: (p.m * v * v) / 2, Ep: (p.k * x * x) / 2 };
}
