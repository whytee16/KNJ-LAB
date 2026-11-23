import { elevatorAt, solveSupportedBody } from '../mechanics/index.ts';
import type { Scenario } from './types.ts';
import { range } from './motion.ts';

type P = { m: number; a: number };
type R = { Fg: number; P: number; overload: number };
const G = 9.8;
const DURATION = 3;

/** «Человек на весах в лифте»: вес P = m(g + a), перегрузка и невесомость. */
export const elevatorScales: Scenario<P, R> = {
  code: 'elevator-scales',
  layout: 'elevator',
  params: {
    m: { min: 20, max: 120, step: 1, default: 60, unit: 'kg', symbol: 'm' },
    a: { min: -9.8, max: 5, step: 0.1, default: 0, unit: 'm/s2', symbol: 'a' },
  },
  results: {
    Fg: { unit: 'N', symbol: 'mg', digits: 1 },
    P: { unit: 'N', symbol: 'P', digits: 1 },
    overload: { unit: '1', symbol: 'P/mg', digits: 2 },
  },
  liveSpecs: {
    t: { unit: 's', symbol: 't', digits: 2 },
    v: { unit: 'm/s', symbol: 'v', digits: 2 },
    h: { unit: 'm', symbol: 'h', digits: 2 },
  },
  compute: ({ m, a }) => {
    const r = solveSupportedBody({ m, g: G, a });
    return { Fg: r.Fg, P: r.P, overload: r.overload };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.constantAcceleration',
    'labs.assumptions.gEarth',
  ],
  duration: () => DURATION,
  state: ({ a }, tau) => {
    const e = elevatorAt(a, tau, DURATION);
    return { s: e.y, live: { t: Math.min(tau, DURATION), v: e.v, h: e.y } };
  },
  forces: ({ m, a }) => solveSupportedBody({ m, g: G, a }).forces,
  status: ({ m, a }) => {
    const r = solveSupportedBody({ m, g: G, a });
    if (r.P === 0) return { key: 'weightless', values: {} };
    if (a > 1e-9) return { key: 'overload', values: { k: r.overload } };
    if (a < -1e-9) return { key: 'lighter', values: { k: r.overload } };
    return { key: 'normal', values: {} };
  },
  charts: ({ m, a }) => [
    {
      id: 'weight',
      x: { symbol: 'a + g', unit: 'm/s2' },
      y: { symbol: 'P', unit: 'N' },
      // P against a, drawn over a + g ∈ [0, 14.8] so the axis starts at free fall.
      series: range(2, G + 5, (x) => m * x),
      xMax: G + 5,
      yMax: m * (G + 5),
      marker: { x: G + a, y: m * (G + a) },
    },
  ],
};
