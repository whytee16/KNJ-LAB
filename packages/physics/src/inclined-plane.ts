import type { LabModel } from './lab-model.ts';

export type InclinedPlaneParams = { angle: number; m: number; mu: number; L: number; g: number };
export type InclinedPlaneResults = {
  /** Gravity mg, its components along and across the slope, normal force, friction. */
  Fg: number;
  Fpar: number;
  N: number;
  Ffr: number;
  /** Acceleration down the slope (0 when the block stays at rest). */
  a: number;
  /** 1 — slides, 0 — stays at rest. */
  moves: number;
  /** Time to slide the whole length and the speed at the bottom (0 at rest). */
  t: number;
  v: number;
  /** Critical angle above which the block starts sliding: tg α* = μ. */
  critical: number;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const sin = (deg: number) => (deg === 0 ? 0 : deg === 90 ? 1 : Math.sin(rad(deg)));
const cos = (deg: number) => (deg === 90 ? 0 : deg === 0 ? 1 : Math.cos(rad(deg)));

/** Acceleration down the slope for a given angle (0 when friction holds the block). */
export function slopeAcceleration(p: Pick<InclinedPlaneParams, 'angle' | 'mu' | 'g'>): number {
  const drive = sin(p.angle) - p.mu * cos(p.angle);
  // Equality (tg α = μ) counts as rest: static friction holds the block.
  return drive > 1e-12 ? p.g * drive : 0;
}

/**
 * Block released from rest on an inclined plane with friction (one coefficient for static and
 * sliding friction). Forces, acceleration, time and speed at the bottom.
 */
export const inclinedPlane: LabModel<InclinedPlaneParams, InclinedPlaneResults> = {
  code: 'inclined-plane',
  params: {
    angle: { min: 0, max: 60, step: 1, default: 30, unit: 'deg', symbol: 'α' },
    m: { min: 0.1, max: 10, step: 0.1, default: 2, unit: 'kg', symbol: 'm' },
    mu: { min: 0, max: 1, step: 0.05, default: 0.2, unit: '1', symbol: 'μ' },
    L: { min: 1, max: 10, step: 0.5, default: 4, unit: 'm', symbol: 'L' },
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
    Fg: { unit: 'N', symbol: 'mg', digits: 2 },
    Fpar: { unit: 'N', symbol: 'mg sin α', digits: 2 },
    N: { unit: 'N', symbol: 'N', digits: 2 },
    Ffr: { unit: 'N', symbol: 'Fтр', digits: 2 },
    a: { unit: 'm/s2', symbol: 'a', digits: 2 },
    moves: { unit: '1', symbol: '', digits: 0 },
    t: { unit: 's', symbol: 't', digits: 2 },
    v: { unit: 'm/s', symbol: 'v', digits: 2 },
    critical: { unit: 'deg', symbol: 'α*', digits: 1 },
  },
  compute: (p) => {
    const Fg = p.m * p.g;
    const Fpar = Fg * sin(p.angle);
    const N = Fg * cos(p.angle);
    const a = slopeAcceleration(p);
    const moves = a > 0 ? 1 : 0;
    // At rest static friction balances the pull along the slope; when sliding it is μN.
    const Ffr = moves ? p.mu * N : Fpar;
    const t = moves ? Math.sqrt((2 * p.L) / a) : 0;
    return {
      Fg,
      Fpar,
      N,
      Ffr,
      a,
      moves,
      t,
      v: a * t,
      critical: (Math.atan(p.mu) * 180) / Math.PI,
    };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.oneMu',
    'labs.assumptions.noAir',
    'labs.assumptions.startsAtRest',
  ],
};

/** Distance travelled down the slope at model time τ (stops at the bottom). */
export function slideAt(p: InclinedPlaneParams, tau: number): { s: number; v: number } {
  const a = slopeAcceleration(p);
  if (a === 0) return { s: 0, v: 0 };
  const T = Math.sqrt((2 * p.L) / a);
  const t = Math.min(Math.max(tau, 0), T);
  return { s: (a * t * t) / 2, v: a * t };
}

/** Acceleration as a function of the angle (0…max) for the current μ and g — shows α*. */
export function accelerationByAngle(
  p: InclinedPlaneParams,
  points = 61,
): { x: number; y: number }[] {
  const max = inclinedPlane.params.angle.max;
  return Array.from({ length: points }, (_, i) => {
    const angle = (max * i) / (points - 1);
    return { x: angle, y: slopeAcceleration({ ...p, angle }) };
  });
}
