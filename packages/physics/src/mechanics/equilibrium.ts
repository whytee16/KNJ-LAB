import { cosD, sinD, type ForceVec } from './types.ts';

export interface EquilibriumSpec {
  /** Weight hanging from the knot. */
  m: number;
  g: number;
  /** Angles of the left and right ropes above the horizontal, degrees (0 < α < 90). */
  alpha1: number;
  alpha2: number;
  /** Horizontal force on the knot (wind), to the right is positive. */
  F?: number;
  /** Breaking strength of each rope, N (optional). */
  Tmax?: number;
}

export interface EquilibriumResult {
  W: number;
  T1: number;
  T2: number;
  /** A rope would have to push (negative tension): the knot cannot be held this way. */
  slack: boolean;
  /** A rope tension exceeds its strength. */
  breaks: boolean;
  forces: ForceVec[];
}

/**
 * A knot held by two ropes (left and right) carrying a weight, with an optional horizontal force.
 * Equilibrium: ΣFx = 0, ΣFy = 0 — solved exactly (Lami's theorem without the side force).
 */
export function solveEquilibrium(s: EquilibriumSpec): EquilibriumResult {
  const W = s.m * s.g;
  const F = s.F ?? 0;
  const det = sinD(s.alpha1 + s.alpha2);
  const T1 = (W * cosD(s.alpha2) + F * sinD(s.alpha2)) / det;
  const T2 = (W * cosD(s.alpha1) - F * sinD(s.alpha1)) / det;
  const forces: ForceVec[] = [
    { body: 'knot', kind: 'gravity', x: 0, y: -W },
    { body: 'knot', kind: 'tension', index: 1, x: -T1 * cosD(s.alpha1), y: T1 * sinD(s.alpha1) },
    { body: 'knot', kind: 'tension', index: 2, x: T2 * cosD(s.alpha2), y: T2 * sinD(s.alpha2) },
  ];
  if (F) forces.push({ body: 'knot', kind: 'applied', x: F, y: 0 });
  return {
    W,
    T1,
    T2,
    slack: T1 < -1e-9 || T2 < -1e-9,
    breaks: s.Tmax !== undefined && Math.max(T1, T2) > s.Tmax,
    forces,
  };
}
