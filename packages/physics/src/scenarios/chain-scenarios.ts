import { solveChain, type ChainSpec } from '../mechanics/index.ts';
import type { ParamSpec, ResultSpec } from '../lab-model.ts';
import type { Scenario } from './types.ts';
import { range, trackMotion } from './motion.ts';

const G = 9.8;

/** Link between the bodies: rope and chain are inextensible and massless; a spring stretches. */
export const ROPE = 0;
export const CHAIN = 1;
export const SPRING = 2;

const linkParams = {
  link: {
    min: 0,
    max: 2,
    step: 1,
    default: ROPE,
    unit: '1',
    symbol: '',
    choices: [
      { value: ROPE, key: 'rope' },
      { value: CHAIN, key: 'chain' },
      { value: SPRING, key: 'spring' },
    ],
  },
  k: {
    min: 20,
    max: 2000,
    step: 10,
    default: 200,
    unit: 'N/m',
    symbol: 'k',
    when: { param: 'link', value: SPRING },
  },
  Tmax: { min: 5, max: 300, step: 5, default: 100, unit: 'N', symbol: 'Tₘₐₓ' },
} satisfies Record<string, ParamSpec>;

const look = (keys: string[]): ParamSpec => ({
  min: 0,
  max: keys.length - 1,
  step: 1,
  default: 0,
  unit: '1',
  symbol: '',
  choices: keys.map((key, value) => ({ value, key })),
});

type LinkP = { link: number; k: number; Tmax: number; L: number };
type TableP = LinkP & { m1: number; m2: number; mu: number; look1: number; look2: number };
type ChainR = {
  a: number;
  T: number;
  Ffr: number;
  N: number;
  t: number;
  v: number;
  x: number;
};

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

/** Whether the link breaks at release: the needed tension is above its strength. */
const breaks = (T: number, p: LinkP) => T > p.Tmax + 1e-9;

/**
 * Spring link: extension x = T/k (shown in centimetres) once the bodies move together — steady
 * motion; the short oscillations of the spring at the start are not modelled (see assumptions).
 */
const extension = (T: number, p: LinkP) => (p.link === SPRING ? (100 * T) / p.k : 0);

function chainResults(spec: ChainSpec, surfaceIndex: number | null, p: LinkP): ChainR {
  const r = solveChain(spec);
  const T = r.tensions[0] ?? 0;
  const m = trackMotion(r.a, p.L, Infinity);
  const pb = surfaceIndex === null ? null : r.perBody[surfaceIndex]!;
  return {
    a: r.a,
    T,
    Ffr: pb?.friction ?? 0,
    N: pb?.N ?? 0,
    t: m.T,
    v: Math.abs(m.v),
    x: extension(T, p),
  };
}

const chainLive = {
  t: { unit: 's', symbol: 't', digits: 2 },
  s: { unit: 'm', symbol: 's', digits: 2 },
  v: { unit: 'm/s', symbol: 'v', digits: 2 },
} as const;

const xResult: ResultSpec = {
  unit: 'cm',
  symbol: 'x',
  digits: 1,
  when: { param: 'link', value: SPRING },
};

/**
 * Motion after "Run". Intact link: the bodies move together with acceleration a over the track.
 * Broken link: the hanging body falls freely (fall), the rest stays where friction or the
 * balance leaves it.
 */
function chainMotion(spec: ChainSpec, p: LinkP, tau: number) {
  const r = solveChain(spec);
  if (breaks(r.tensions[0] ?? 0, p)) {
    const f = trackMotion(G, p.L, tau);
    return { s: 0, fall: f.s, T: f.T, live: { t: Math.min(tau, f.T), s: f.s, v: Math.abs(f.v) } };
  }
  const m = trackMotion(r.a, p.L, tau);
  return {
    s: m.s,
    fall: 0,
    T: m.T,
    live: { t: Math.min(tau, m.T), s: Math.abs(m.s), v: Math.abs(m.v) },
  };
}

/** «Брусок на столе и груз через блок»: связанные тела, трение покоя и скольжения. */
export const blockPulley: Scenario<TableP, ChainR> = {
  code: 'block-pulley',
  layout: 'table-pulley',
  params: {
    m1: { min: 0.1, max: 10, step: 0.1, default: 2, unit: 'kg', symbol: 'm₁' },
    m2: { min: 0.1, max: 5, step: 0.1, default: 1, unit: 'kg', symbol: 'm₂' },
    mu: { min: 0, max: 1, step: 0.05, default: 0.2, unit: '1', symbol: 'μ' },
    L: { min: 0.5, max: 2, step: 0.1, default: 1, unit: 'm', symbol: 'L' },
    ...linkParams,
    look1: look(['block', 'car', 'phone']),
    look2: look(['weight', 'bucket', 'phone']),
  },
  results: {
    a: { unit: 'm/s2', symbol: 'a', digits: 2 },
    T: { unit: 'N', symbol: 'T', digits: 2 },
    Ffr: { unit: 'N', symbol: 'Fтр', digits: 2 },
    N: { unit: 'N', symbol: 'N', digits: 2 },
    t: { unit: 's', symbol: 't', digits: 2 },
    v: { unit: 'm/s', symbol: 'v', digits: 2 },
    x: xResult,
  },
  liveSpecs: chainLive,
  compute: (p) => chainResults(tableSpec(p), 1, p),
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.idealPulley',
    'labs.assumptions.oneMu',
    'labs.assumptions.steadySpring',
  ],
  duration: (p) => chainMotion(tableSpec(p), p, Infinity).T,
  state: (p, tau) => {
    const m = chainMotion(tableSpec(p), p, tau);
    return { s: m.s, fall: m.fall, live: m.live };
  },
  forces: (p) => solveChain(tableSpec(p)).forces,
  status: (p) => {
    const r = solveChain(tableSpec(p));
    const T = r.tensions[0] ?? 0;
    if (breaks(T, p)) return { key: 'breaks', values: { T, Tmax: p.Tmax } };
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

type AtwoodP = LinkP & { m1: number; m2: number; look1: number; look2: number };
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
    L: { min: 0.5, max: 2, step: 0.1, default: 1, unit: 'm', symbol: 'L' },
    ...linkParams,
    look1: look(['weight', 'box', 'bucket']),
    look2: look(['weight', 'box', 'bucket']),
  },
  results: {
    a: { unit: 'm/s2', symbol: 'a', digits: 2 },
    T: { unit: 'N', symbol: 'T', digits: 2 },
    t: { unit: 's', symbol: 't', digits: 2 },
    v: { unit: 'm/s', symbol: 'v', digits: 2 },
    x: xResult,
  },
  liveSpecs: chainLive,
  compute: (p) => {
    const { a, T, t, v, x } = chainResults(atwoodSpec(p), null, p);
    return { a, T, t, v, x };
  },
  assumptions: [
    'labs.assumptions.materialPoint',
    'labs.assumptions.idealPulley',
    'labs.assumptions.noAir',
    'labs.assumptions.steadySpring',
  ],
  duration: (p) => chainMotion(atwoodSpec(p), p, Infinity).T,
  state: (p, tau) => {
    const m = chainMotion(atwoodSpec(p), p, tau);
    return { s: m.s, fall: m.fall, live: m.live };
  },
  forces: (p) => solveChain(atwoodSpec(p)).forces,
  status: (p) => {
    const r = solveChain(atwoodSpec(p));
    const T = r.tensions[0] ?? 0;
    if (breaks(T, p)) return { key: 'breaks', values: { T, Tmax: p.Tmax } };
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
