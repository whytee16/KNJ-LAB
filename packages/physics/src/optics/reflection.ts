import type { LabModel } from '../lab-model.ts';
import { angleToNormal, deg, mirrorImage, rad, reflect, type Vec } from './rays.ts';

export type ReflectionParams = { alpha: number; phi: number; a: number };
export type ReflectionResults = {
  /** Angles of incidence and reflection on the (turned) mirror. */
  i: number;
  r: number;
  /** How far the reflected ray turned compared with the mirror at 0° (2φ). */
  turn: number;
  /** Distances from the candle and from its image to the mirror plane. */
  dObj: number;
  dImg: number;
};

const LASER = 30; // cm from the laser to the point of incidence
const CANDLE_Y = -12; // cm along the mirror below the point of incidence

/**
 * Plane mirror, seen from above. The mirror stands at the origin; at φ = 0 it lies along y and
 * faces −x. The laser is fixed: its beam meets the unturned mirror at the angle α.
 */
export function reflectionGeometry(p: ReflectionParams) {
  const O: Vec = { x: 0, y: 0 };
  const n: Vec = { x: -Math.cos(rad(p.phi)), y: -Math.sin(rad(p.phi)) };
  const along: Vec = { x: -Math.sin(rad(p.phi)), y: Math.cos(rad(p.phi)) };
  const S: Vec = { x: -LASER * Math.cos(rad(p.alpha)), y: LASER * Math.sin(rad(p.alpha)) };
  const d: Vec = { x: (O.x - S.x) / LASER, y: (O.y - S.y) / LASER };
  const out = reflect(d, n);
  const outAtZero = reflect(d, { x: -1, y: 0 });
  const candle: Vec = { x: -p.a, y: CANDLE_Y };
  const image = mirrorImage(candle, O, n);
  // Two rays from the candle to the mirror and on; their extensions meet in the image.
  const candleRays = [-4, -20].map((s) => {
    const M: Vec = { x: O.x + along.x * s, y: O.y + along.y * s };
    const dir = { x: M.x - image.x, y: M.y - image.y };
    const l = Math.hypot(dir.x, dir.y) || 1;
    return { hit: M, end: { x: M.x + (dir.x / l) * 25, y: M.y + (dir.y / l) * 25 } };
  });
  return {
    O,
    n,
    along,
    laser: S,
    reflected: { x: out.x * LASER, y: out.y * LASER },
    incidence: angleToNormal(d, n),
    turn: deg(Math.atan2(out.y, out.x) - Math.atan2(outAtZero.y, outAtZero.x)),
    candle,
    image,
    candleRays,
  };
}

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Law of reflection and the image in a plane mirror. */
export const reflection: LabModel<ReflectionParams, ReflectionResults> = {
  code: 'reflection',
  params: {
    alpha: { min: 0, max: 70, step: 1, default: 30, unit: 'deg', symbol: 'α' },
    phi: { min: -15, max: 15, step: 1, default: 0, unit: 'deg', symbol: 'φ' },
    a: { min: 5, max: 40, step: 1, default: 20, unit: 'cm', symbol: 'a' },
  },
  results: {
    i: { unit: 'deg', symbol: 'α', digits: 1 },
    r: { unit: 'deg', symbol: 'β', digits: 1 },
    turn: { unit: 'deg', symbol: 'Δ', digits: 1 },
    dObj: { unit: 'cm', symbol: 'a', digits: 1 },
    dImg: { unit: 'cm', symbol: 'b', digits: 1 },
  },
  compute: (p) => {
    const g = reflectionGeometry(p);
    const dist = (q: Vec) => Math.abs(q.x * g.n.x + q.y * g.n.y);
    const i = g.incidence;
    return { i, r: i, turn: wrap(g.turn), dObj: dist(g.candle), dImg: dist(g.image) };
  },
  assumptions: ['labs.assumptions.lightRays', 'labs.assumptions.flatMirror'],
};
