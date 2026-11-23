import { solveChain, type ChainSpec } from '../mechanics/index.ts';
import type { Scenario } from './types.ts';
import { range, trackMotion } from './motion.ts';

const G = 9.8;
const TRACK = 1; // m of travel shown in the animation

type TableP = { m1: number; m2: number; mu: number };
type ChainR = { a: number; T: number; Ffr: number; N: number; t: number; v: number };

const tableSpec = ({ m1, m2, mu }: TableP): ChainSpec => ({
  g: G,
  bodies: [
    { id: 'hang', m: m2, place: { kind: 'hanging', forward: 'down' } },
    {
      id: 'block',
      m: m1,
      place: { kind: 'surface', angle: 0, mu, descends: 'right', forward: 'down' },
    },
  ],
});

function chainResults(spec: ChainSpec, surfaceIndex: number | null): ChainR {
  const r = solveChain(spec);
  const m = trackMotion(r.a, TRACK, Infinity);
  const pb = surfaceIndex === null ? null : r.perBody[surfaceIndex]!;
  return {
    a: r.a,
    T: r.tensions[0] ?? 0,
    Ffr: pb?.friction ?? 0,
    N: pb?.N ?? 0,
    t: m.T,
    v: Math.abs(m.v),
  };
}

const chainLive = {
  t: { unit: 's', symbol: 't', digits: 2 },
  s: { unit: 'm', symbol: 's', digits: 2 },
  v: { unit: 'm/s', symbol: 'v', digits: 2 },
} as const;

/** «Брусок на столе и груз через блок»: связанные тела, трение покоя и скольжения. */
export const blockPulley: Scenario<TableP, ChainR> = {
  code: 'block-pulley',
  layout: 'table-pulley',
  params: {
    m1: { min: 0.1, max: 10, step: 0.1, default: 2, unit: 'kg', symbol: 'm₁' },
    m2: { min: 0.1, max: 5, step: 0.1, default: 1, unit: 'kg', symbol: 'm₂' },
    mu: { min: 0, max: 1, step: 0.05, default: 0.2, unit: '1', symbol: 'μ' },
  },
  results: {
    a: { unit: 'm/s2', symbol: 'a', digits: 2 },
    T: { unit: 'N', symbol: 'T', digits: 2 },
    Ffr: { unit: 'N', symbol: 'Fтр', digits: 2 },
    N: { unit: 'N', symbol: 'N', digits: 2 },
    t: { unit: 's', symbol: 't', digits: 2 },
    v: { unit: 'm/s', symbol: 'v', digits: 2 },
  },
  liveSpecs: chainLive,
  compute: (p) => chainResults(tableSpec(p), 1),
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.idealPulley',
    'labs.assumptions.oneMu',
  ],
  duration: (p) => trackMotion(solveChain(tableSpec(p)).a, TRACK, Infinity).T,
  state: (p, tau) => {
    const m = trackMotion(solveChain(tableSpec(p)).a, TRACK, tau);
    return { s: m.s, live: { t: Math.min(tau, m.T), s: Math.abs(m.s), v: Math.abs(m.v) } };
  },
  forces: (p) => solveChain(tableSpec(p)).forces,
  status: (p) => {
    const r = solveChain(tableSpec(p));
    return r.moves
      ? { key: 'moves', values: { a: r.a } }
      : { key: 'rests', values: { m2g: p.m2 * G, fmax: p.mu * p.m1 * G } };
  },
  charts: (p) => [
    {
      id: 'aByM2',
      x: { symbol: 'm₂', unit: 'kg' },
      y: { symbol: 'a', unit: 'm/s2' },
      series: range(51, 5, (m2) => solveChain(tableSpec({ ...p, m2: Math.max(m2, 1e-6) })).a),
      xMax: 5,
      yMax: Math.max(solveChain(tableSpec({ ...p, m2: 5 })).a, 0.5),
      marker: { x: p.m2, y: solveChain(tableSpec(p)).a },
    },
  ],
};

type AtwoodP = { m1: number; m2: number };
const atwoodSpec = ({ m1, m2 }: AtwoodP): ChainSpec => ({
  g: G,
  bodies: [
    { id: 'left', m: m1, place: { kind: 'hanging', forward: 'down' } },
    { id: 'right', m: m2, place: { kind: 'hanging', forward: 'up' } },
  ],
});

/** «Машина Атвуда»: два груза на нити через блок. */
export const atwood: Scenario<AtwoodP, Omit<ChainR, 'Ffr' | 'N'>> = {
  code: 'atwood',
  layout: 'atwood',
  params: {
    m1: { min: 0.1, max: 10, step: 0.1, default: 3, unit: 'kg', symbol: 'm₁' },
    m2: { min: 0.1, max: 10, step: 0.1, default: 1, unit: 'kg', symbol: 'm₂' },
  },
  results: {
    a: { unit: 'm/s2', symbol: 'a', digits: 2 },
    T: { unit: 'N', symbol: 'T', digits: 2 },
    t: { unit: 's', symbol: 't', digits: 2 },
    v: { unit: 'm/s', symbol: 'v', digits: 2 },
  },
  liveSpecs: chainLive,
  compute: (p) => {
    const { a, T, t, v } = chainResults(atwoodSpec(p), null);
    return { a, T, t, v };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.idealPulley',
    'labs.assumptions.noAir',
  ],
  duration: (p) => trackMotion(solveChain(atwoodSpec(p)).a, TRACK, Infinity).T,
  state: (p, tau) => {
    const m = trackMotion(solveChain(atwoodSpec(p)).a, TRACK, tau);
    return { s: m.s, live: { t: Math.min(tau, m.T), s: Math.abs(m.s), v: Math.abs(m.v) } };
  },
  forces: (p) => solveChain(atwoodSpec(p)).forces,
  status: (p) => {
    const r = solveChain(atwoodSpec(p));
    if (!r.moves) return { key: 'balanced', values: {} };
    return { key: r.a > 0 ? 'leftDown' : 'rightDown', values: { a: Math.abs(r.a) } };
  },
  charts: (p) => [
    {
      id: 'aByRatio',
      x: { symbol: 'm₁', unit: 'kg' },
      y: { symbol: 'a', unit: 'm/s2' },
      series: range(51, 10, (m1) =>
        Math.abs(solveChain(atwoodSpec({ ...p, m1: Math.max(m1, 1e-6) })).a),
      ),
      xMax: 10,
      yMax: G,
      marker: { x: p.m1, y: Math.abs(solveChain(atwoodSpec(p)).a) },
    },
  ],
};
