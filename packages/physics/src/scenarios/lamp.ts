import { solveEquilibrium } from '../mechanics/index.ts';
import type { Scenario } from './types.ts';
import { range } from './motion.ts';

type P = { m: number; alpha1: number; alpha2: number; F: number; Tmax: number };
type R = { W: number; T1: number; T2: number };
const G = 9.8;

/** «Лампа на двух тросах»: равновесие узла, натяжения, прочность троса, ветер. */
export const lampTwoRopes: Scenario<P, R> = {
  code: 'lamp-two-ropes',
  layout: 'lamp',
  params: {
    m: { min: 0.5, max: 20, step: 0.5, default: 2, unit: 'kg', symbol: 'm' },
    alpha1: { min: 5, max: 85, step: 1, default: 30, unit: 'deg', symbol: 'α₁' },
    alpha2: { min: 5, max: 85, step: 1, default: 30, unit: 'deg', symbol: 'α₂' },
    F: { min: -30, max: 30, step: 1, default: 0, unit: 'N', symbol: 'F' },
    Tmax: { min: 20, max: 500, step: 10, default: 150, unit: 'N', symbol: 'Tₘₐₓ' },
  },
  results: {
    W: { unit: 'N', symbol: 'mg', digits: 1 },
    T1: { unit: 'N', symbol: 'T₁', digits: 1 },
    T2: { unit: 'N', symbol: 'T₂', digits: 1 },
  },
  liveSpecs: {},
  compute: (p) => {
    const r = solveEquilibrium({ ...p, g: G });
    return { W: r.W, T1: r.T1, T2: r.T2 };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.weightlessRopes',
    'labs.assumptions.gEarth',
  ],
  duration: () => 0,
  state: () => ({ s: 0, live: {} }),
  forces: (p) => solveEquilibrium({ ...p, g: G }).forces,
  status: (p) => {
    const r = solveEquilibrium({ ...p, g: G });
    if (r.slack) return { key: 'slack', values: {} };
    if (r.breaks) return { key: 'breaks', values: { T: Math.max(r.T1, r.T2), Tmax: p.Tmax } };
    return { key: 'holds', values: { T: Math.max(r.T1, r.T2), Tmax: p.Tmax } };
  },
  charts: (p) => {
    const W = p.m * G;
    return [
      {
        id: 'symmetric',
        x: { symbol: 'α', unit: 'deg' },
        y: { symbol: 'T', unit: 'N' },
        // Symmetric hanging: T = mg / (2 sin α) — grows fast when the ropes become flat.
        series: range(81, 80, (x) => W / (2 * Math.sin(((x + 5) * Math.PI) / 180))).map((q) => ({
          x: q.x + 5,
          y: q.y,
        })),
        xMax: 85,
        yMax: Math.max(W / (2 * Math.sin((5 * Math.PI) / 180)), 1),
        marker:
          p.alpha1 === p.alpha2
            ? { x: p.alpha1, y: W / (2 * Math.sin((p.alpha1 * Math.PI) / 180)) }
            : undefined,
      },
    ];
  },
};
