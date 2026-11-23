import type { ForceVec } from './types.ts';

export interface SupportedBodySpec {
  m: number;
  g: number;
  /** Acceleration of the support (elevator floor) upwards, m/s². */
  a: number;
}

export interface SupportedBodyResult {
  /** Gravity mg (the same in any elevator). */
  Fg: number;
  /** Normal force from the scales = weight shown by the scales: P = m(g + a), never negative. */
  N: number;
  P: number;
  /** P / (mg): overload factor; 0 — weightlessness. */
  overload: number;
  /** The support falls faster than free fall: the body would leave the floor. */
  detached: boolean;
  forces: ForceVec[];
}

/**
 * A body standing on scales on the floor of an elevator that accelerates with a (up is positive).
 * Newton's second law: N − mg = ma ⇒ N = m(g + a); the scales show the weight P = N.
 */
export function solveSupportedBody(s: SupportedBodySpec): SupportedBodyResult {
  const Fg = s.m * s.g;
  const raw = s.m * (s.g + s.a);
  const N = Math.max(0, raw);
  return {
    Fg,
    N,
    P: N,
    overload: Fg ? N / Fg : 0,
    detached: raw < -1e-9,
    forces: [
      { body: 'person', kind: 'gravity', x: 0, y: -Fg },
      ...(N > 1e-12 ? [{ body: 'person', kind: 'normal' as const, x: 0, y: N }] : []),
    ],
  };
}

/** Motion of the elevator from rest with constant acceleration a: height and speed at time τ. */
export function elevatorAt(a: number, tau: number, duration: number) {
  const t = Math.min(Math.max(tau, 0), duration);
  return { y: (a * t * t) / 2, v: a * t };
}
