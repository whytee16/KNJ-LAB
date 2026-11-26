import type { LabModel } from '../lab-model.ts';

export type ThinLensParams = { kind: number; F: number; d: number; h: number; s: number };
export type ThinLensResults = {
  /** Image distance (cm): > 0 real, behind the lens; < 0 virtual, on the side of the object. */
  f: number;
  /** Image height (cm): < 0 inverted. */
  H: number;
  /** Magnification Γ = |f|/d. */
  G: number;
  /** Optical power D = ±1/F (dioptres, F in metres). */
  D: number;
  real: number;
  /** 1 — the object is in the focal plane: the rays leave parallel, no image. */
  none: number;
  /** Blur spot on the screen (cm) for a real image; 0 — sharp. */
  blur: number;
};

export const CONVERGING = 0;
export const DIVERGING = 1;
/** Lens radius (cm) for the blur spot on the screen. */
const APERTURE = 2.5;

/** Thin lens formula 1/F = 1/d + 1/f (F < 0 for a diverging lens). */
export function lensImage(p: Pick<ThinLensParams, 'kind' | 'F' | 'd' | 'h'>) {
  const F = p.kind === DIVERGING ? -p.F : p.F;
  if (Math.abs(p.d - F) < 1e-9) return { f: 0, H: 0, none: true };
  const f = (p.d * F) / (p.d - F);
  return { f, H: (-p.h * f) / p.d, none: false };
}

/**
 * Thin lens on an optical bench: converging or diverging, object (a candle) at d, a screen at s.
 * The image is built by the formula; the views draw the three characteristic rays.
 */
export const thinLens: LabModel<ThinLensParams, ThinLensResults> = {
  code: 'thin-lens',
  params: {
    kind: {
      min: 0,
      max: 1,
      step: 1,
      default: CONVERGING,
      unit: '1',
      symbol: '',
      choices: [
        { value: CONVERGING, key: 'converging' },
        { value: DIVERGING, key: 'diverging' },
      ],
    },
    F: { min: 5, max: 30, step: 1, default: 10, unit: 'cm', symbol: 'F' },
    d: { min: 2, max: 60, step: 0.5, default: 25, unit: 'cm', symbol: 'd' },
    h: { min: 1, max: 5, step: 0.5, default: 3, unit: 'cm', symbol: 'h' },
    s: { min: 5, max: 100, step: 0.5, default: 20, unit: 'cm', symbol: 's' },
  },
  results: {
    f: { unit: 'cm', symbol: 'f', digits: 1 },
    H: { unit: 'cm', symbol: 'H', digits: 1 },
    G: { unit: '1', symbol: 'Γ', digits: 2 },
    D: { unit: 'dpt', symbol: 'D', digits: 1 },
    real: { unit: '1', symbol: '', digits: 0 },
    none: { unit: '1', symbol: '', digits: 0 },
    blur: { unit: 'cm', symbol: '', digits: 1 },
  },
  compute: (p) => {
    const img = lensImage(p);
    const D = (p.kind === DIVERGING ? -100 : 100) / p.F;
    if (img.none) return { f: 0, H: 0, G: 0, D, real: 0, none: 1, blur: 0 };
    const real = img.f > 0 ? 1 : 0;
    return {
      f: img.f,
      H: img.H,
      G: Math.abs(img.f) / p.d,
      D,
      real,
      none: 0,
      blur: real ? (2 * APERTURE * Math.abs(p.s - img.f)) / img.f : 0,
    };
  },
  assumptions: ['labs.assumptions.lightRays', 'labs.assumptions.thinLens'],
};

export type RaySegment = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  virtual: boolean;
};

/**
 * The three characteristic rays from the top of the object (−d, h), lens at x = 0, axis y = 0:
 * parallel to the axis, through the centre, through the front focus. Segments after the lens run
 * to x = xEnd; virtual extensions (dashed) go back to the virtual image.
 */
export function lensRays(p: ThinLensParams, xEnd: number): RaySegment[] {
  const F = p.kind === DIVERGING ? -p.F : p.F;
  const B = { x: -p.d, y: p.h };
  const img = lensImage(p);
  const segs: RaySegment[] = [];
  const after = (at: { x: number; y: number }, slope: number) => {
    segs.push({ from: at, to: { x: xEnd, y: at.y + slope * xEnd }, virtual: false });
    if (!img.none && img.f < 0) segs.push({ from: at, to: { x: img.f, y: img.H }, virtual: true });
  };
  // 1. Parallel to the axis → through the back focus (or as if from the front focus).
  const A1 = { x: 0, y: p.h };
  segs.push({ from: B, to: A1, virtual: false });
  after(A1, -p.h / F);
  // 2. Through the optical centre — straight on.
  const k2 = -p.h / p.d;
  segs.push({ from: B, to: { x: 0, y: 0 }, virtual: false });
  after({ x: 0, y: 0 }, k2);
  // 3. Towards the front focus (or the back focus for a diverging lens) → parallel to the axis.
  if (Math.abs(p.d - F) > 1e-9) {
    const y3 = (p.h * F) / (F - p.d);
    if (Math.abs(y3) < 4 * Math.max(p.h, 1) + 10) {
      const A3 = { x: 0, y: y3 };
      segs.push({ from: B, to: A3, virtual: false });
      after(A3, 0);
    }
  }
  return segs;
}

/** Image distance f(d) for the chart, split at the focus (d = F) so the asymptote stays open. */
export function imageSeries(p: ThinLensParams, dMax = 60, points = 240, limit = 100) {
  const near: { x: number; y: number }[] = [];
  const far: { x: number; y: number }[] = [];
  for (let i = 1; i <= points; i++) {
    const d = (dMax * i) / points;
    const img = lensImage({ ...p, d });
    if (img.none || Math.abs(img.f) > limit) continue;
    (p.kind === CONVERGING && d < p.F ? near : far).push({ x: d, y: img.f });
  }
  return { near, far };
}
