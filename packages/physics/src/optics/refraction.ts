import type { LabModel } from '../lab-model.ts';
import { MEDIA, MEDIA_PAIRS } from './media.ts';
import { criticalAngle, deg, rad, reflect, refract, type Vec } from './rays.ts';

export type RefractionParams = { pair: number; alpha: number };
export type RefractionResults = {
  n1: number;
  n2: number;
  /** Relative refractive index n = n₂/n₁. */
  n: number;
  beta: number;
  /** Angle of refraction (0 when the light is totally reflected). */
  gamma: number;
  /** Critical angle (90° when the light goes into a denser medium). */
  critical: number;
  /** 1 — total internal reflection. */
  tir: number;
};

const LEN = 30;

export function mediaOf(p: Pick<RefractionParams, 'pair'>) {
  const pair = MEDIA_PAIRS[p.pair] ?? MEDIA_PAIRS[0]!;
  return { pair, n1: MEDIA[pair.from], n2: MEDIA[pair.to] };
}

/**
 * The boundary is y = 0 with the denser medium below it (water in a tank, a glass block), as on
 * the bench: light from air comes from above, light from water or glass comes from below.
 * Rays are segments of 30 units.
 */
export function refractionGeometry(p: RefractionParams) {
  const { n1, n2 } = mediaOf(p);
  const side = n1 <= n2 ? 1 : -1; // where the light comes from: above (+1) or below (−1)
  const normal: Vec = { x: 0, y: 1 };
  const S: Vec = { x: -LEN * Math.sin(rad(p.alpha)), y: side * LEN * Math.cos(rad(p.alpha)) };
  const d: Vec = { x: -S.x / LEN, y: -S.y / LEN };
  const r = reflect(d, normal);
  const t = refract(d, normal, n1, n2);
  return {
    side,
    source: S,
    reflected: { x: r.x * LEN, y: r.y * LEN },
    refracted: t ? { x: t.x * LEN, y: t.y * LEN } : null,
  };
}

/** Snell's law n₁ sin α = n₂ sin γ and total internal reflection. */
export const refraction: LabModel<RefractionParams, RefractionResults> = {
  code: 'refraction',
  params: {
    pair: {
      min: 0,
      max: MEDIA_PAIRS.length - 1,
      step: 1,
      default: 0,
      unit: '1',
      symbol: '',
      choices: MEDIA_PAIRS.map((m, value) => ({ value, key: m.key })),
    },
    alpha: { min: 0, max: 89, step: 1, default: 40, unit: 'deg', symbol: 'α' },
  },
  results: {
    n1: { unit: '1', symbol: 'n₁', digits: 2 },
    n2: { unit: '1', symbol: 'n₂', digits: 2 },
    n: { unit: '1', symbol: 'n', digits: 3 },
    beta: { unit: 'deg', symbol: 'β', digits: 1 },
    gamma: { unit: 'deg', symbol: 'γ', digits: 1 },
    critical: { unit: 'deg', symbol: 'α₀', digits: 1 },
    tir: { unit: '1', symbol: '', digits: 0 },
  },
  compute: (p) => {
    const { n1, n2 } = mediaOf(p);
    const s = (n1 / n2) * Math.sin(rad(p.alpha));
    const tir = s > 1 + 1e-12 ? 1 : 0;
    return {
      n1,
      n2,
      n: n2 / n1,
      beta: p.alpha,
      gamma: tir ? 0 : deg(Math.asin(Math.min(1, s))),
      critical: criticalAngle(n1, n2),
      tir,
    };
  },
  assumptions: ['labs.assumptions.lightRays', 'labs.assumptions.monochromatic'],
};

/** Angle of refraction γ(α) for the chart; points of total reflection are left out. */
export function refractionSeries(p: RefractionParams, points = 90) {
  const { n1, n2 } = mediaOf(p);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const a = (89 * i) / (points - 1);
    const s = (n1 / n2) * Math.sin(rad(a));
    if (s > 1) break;
    out.push({ x: a, y: deg(Math.asin(s)) });
  }
  return out;
}
