import type { LabModel } from './lab-model.ts';

export type PendulumParams = { l: number; theta0: number; m: number; g: number };
export type PendulumResults = {
  /** Small-angle formula T₀ = 2π√(l/g). */
  T0: number;
  /** Exact period for the given amplitude (complete elliptic integral). */
  T: number;
  /** Relative difference (T − T₀)/T₀ in percent. */
  deviation: number;
  /** Total mechanical energy (zero at the lowest point). */
  E: number;
  /** Highest speed (at the lowest point). */
  vMax: number;
  /** Frequency 1/T. */
  nu: number;
};

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Arithmetic–geometric mean (converges in a few steps). */
function agm(a: number, b: number): number {
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15 * a; i++)
    [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

/** Exact period of a mathematical pendulum: T = 2π√(l/g) / AGM(1, cos(θ₀/2)). */
export function exactPeriod(p: Pick<PendulumParams, 'l' | 'g' | 'theta0'>): number {
  return (2 * Math.PI * Math.sqrt(p.l / p.g)) / agm(1, Math.cos(rad(p.theta0) / 2));
}

/** Mathematical pendulum without friction, released from rest at angle θ₀. */
export const pendulum: LabModel<PendulumParams, PendulumResults> = {
  code: 'math-pendulum',
  params: {
    l: { min: 0.1, max: 3, step: 0.05, default: 1, unit: 'm', symbol: 'l' },
    theta0: { min: 1, max: 80, step: 1, default: 10, unit: 'deg', symbol: 'θ₀' },
    m: { min: 0.1, max: 2, step: 0.1, default: 0.5, unit: 'kg', symbol: 'm' },
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
    T0: { unit: 's', symbol: 'T₀', digits: 3 },
    T: { unit: 's', symbol: 'T', digits: 3 },
    deviation: { unit: '1', symbol: 'ΔT/T₀, %', digits: 2 },
    E: { unit: 'J', symbol: 'E', digits: 3 },
    vMax: { unit: 'm/s', symbol: 'vₘₐₓ', digits: 2 },
    nu: { unit: 'Hz', symbol: 'ν', digits: 3 },
  },
  compute: (p) => {
    const T0 = 2 * Math.PI * Math.sqrt(p.l / p.g);
    const T = exactPeriod(p);
    const h = p.l * (1 - Math.cos(rad(p.theta0)));
    return {
      T0,
      T,
      deviation: ((T - T0) / T0) * 100,
      E: p.m * p.g * h,
      vMax: Math.sqrt(2 * p.g * h),
      nu: 1 / T,
    };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.weightlessString',
    'labs.assumptions.noFriction',
    'labs.assumptions.releasedAtRest',
  ],
};

export interface PendulumState {
  t: number;
  theta: number;
  omega: number;
}

/**
 * Motion θ(t) of the nonlinear pendulum θ'' = −(g/l)·sin θ, integrated with RK4 on a fixed step
 * (deterministic, independent of the frame rate). Returns samples every `dt` seconds.
 */
export function simulatePendulum(
  p: PendulumParams,
  duration: number,
  dt = 1 / 240,
): PendulumState[] {
  const w2 = p.g / p.l;
  const f = (th: number) => -w2 * Math.sin(th);
  let th = rad(p.theta0);
  let om = 0;
  const n = Math.ceil(duration / dt);
  const out: PendulumState[] = [{ t: 0, theta: th, omega: om }];
  for (let i = 1; i <= n; i++) {
    const k1t = om;
    const k1o = f(th);
    const k2t = om + (dt / 2) * k1o;
    const k2o = f(th + (dt / 2) * k1t);
    const k3t = om + (dt / 2) * k2o;
    const k3o = f(th + (dt / 2) * k2t);
    const k4t = om + dt * k3o;
    const k4o = f(th + dt * k3t);
    th += (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    om += (dt / 6) * (k1o + 2 * k2o + 2 * k3o + k4o);
    out.push({ t: i * dt, theta: th, omega: om });
  }
  return out;
}

/** State at time τ from a precomputed simulation (linear interpolation between samples). */
export function pendulumAt(samples: PendulumState[], tau: number): PendulumState {
  if (tau <= 0) return samples[0]!;
  const dt = samples[1]!.t;
  const i = Math.min(Math.floor(tau / dt), samples.length - 2);
  const a = samples[i]!;
  const b = samples[i + 1]!;
  const k = Math.min(1, (tau - a.t) / dt);
  return {
    t: tau,
    theta: a.theta + (b.theta - a.theta) * k,
    omega: a.omega + (b.omega - a.omega) * k,
  };
}

/** Kinetic and potential energy at a state (zero potential at the lowest point). */
export function pendulumEnergy(p: PendulumParams, s: PendulumState) {
  const v = p.l * s.omega;
  const Ek = (p.m * v * v) / 2;
  const Ep = p.m * p.g * p.l * (1 - Math.cos(s.theta));
  return { v, Ek, Ep, E: Ek + Ep };
}
