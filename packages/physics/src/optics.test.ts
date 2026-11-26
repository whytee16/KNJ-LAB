import { describe, expect, it } from 'vitest';
import {
  criticalAngle,
  defaultParams,
  imageSeries,
  labModel,
  lensImage,
  lensRays,
  MEDIA_PAIRS,
  reflection,
  reflectionGeometry,
  refract,
  refraction,
  refractionGeometry,
  refractionSeries,
  thinLens,
  type LabModel,
  type ParamSpec,
} from './index.ts';

const corners = (model: LabModel) => {
  const keys = Object.keys(model.params);
  return Array.from({ length: 2 ** keys.length }, (_, mask) =>
    Object.fromEntries(
      keys.map((k, i) => {
        const s = model.params[k] as ParamSpec;
        return [k, mask & (1 << i) ? s.max : s.min];
      }),
    ),
  );
};

describe('reflection', () => {
  it('the angle of reflection equals the angle of incidence', () => {
    for (const alpha of [0, 15, 30, 60, 70]) {
      const r = reflection.compute({ alpha, phi: 0, a: 20 });
      expect(r.i).toBeCloseTo(alpha, 9);
      expect(r.r).toBe(r.i);
    }
  });

  it('turning the mirror by φ turns the reflected ray by 2φ', () => {
    for (const phi of [-15, -5, 7, 15]) {
      const r = reflection.compute({ alpha: 30, phi, a: 20 });
      expect(Math.abs(r.turn)).toBeCloseTo(2 * Math.abs(phi), 9);
      expect(r.i).toBeCloseTo(Math.abs(30 + phi), 9);
    }
  });

  it('the image is as far behind the mirror as the candle is in front of it', () => {
    for (const p of [
      { alpha: 30, phi: 0, a: 20 },
      { alpha: 10, phi: 12, a: 35 },
    ]) {
      const r = reflection.compute(p);
      expect(r.dImg).toBeCloseTo(r.dObj, 9);
      const g = reflectionGeometry(p);
      expect(g.image.x).toBeGreaterThan(0); // behind the mirror
    }
    expect(reflection.compute({ alpha: 30, phi: 0, a: 20 }).dObj).toBeCloseTo(20, 9);
  });
});

describe('refraction', () => {
  it('Snell: sin α / sin γ = n₂/n₁', () => {
    for (let pair = 0; pair < 3; pair++) {
      const r = refraction.compute({ pair, alpha: 40 });
      expect(Math.sin((40 * Math.PI) / 180) / Math.sin((r.gamma * Math.PI) / 180)).toBeCloseTo(
        r.n,
        9,
      );
      expect(r.gamma).toBeLessThan(40); // into a denser medium the ray bends to the normal
      expect(r.tir).toBe(0);
    }
    expect(refraction.compute({ pair: 0, alpha: 0 }).gamma).toBe(0);
  });

  it('total internal reflection from water beyond ≈ 48,8°', () => {
    const waterAir = MEDIA_PAIRS.findIndex((m) => m.key === 'waterAir');
    expect(criticalAngle(1.33, 1)).toBeCloseTo(48.75, 1);
    expect(refraction.compute({ pair: waterAir, alpha: 45 }).tir).toBe(0);
    expect(refraction.compute({ pair: waterAir, alpha: 60 }).tir).toBe(1);
    expect(refraction.compute({ pair: 0, alpha: 89 }).critical).toBe(90);
    expect(refract({ x: 1, y: -0.1 }, { x: 0, y: 1 }, 1.33, 1)).toBeNull();
    const g = refractionGeometry({ pair: waterAir, alpha: 30 });
    expect(g.source.y).toBeLessThan(0); // from the water below
    expect(g.refracted!.y).toBeGreaterThan(0); // into the air above
    expect(refractionGeometry({ pair: waterAir, alpha: 60 }).refracted).toBeNull();
    const series = refractionSeries({ pair: waterAir, alpha: 0 });
    expect(series.at(-1)!.x).toBeLessThan(48.76);
  });
});

describe('thin lens', () => {
  const lens = (p: Partial<Parameters<typeof thinLens.compute>[0]>) =>
    thinLens.compute({ ...defaultParams(thinLens), ...p });

  it('d = 2F gives f = 2F and Γ = 1, inverted and real', () => {
    const r = lens({ F: 10, d: 20, h: 3 });
    expect(r.f).toBeCloseTo(20, 9);
    expect(r.G).toBeCloseTo(1, 9);
    expect(r.H).toBeCloseTo(-3, 9);
    expect(r.real).toBe(1);
    expect(r.D).toBeCloseTo(10, 9);
  });

  it('a magnifier: d < F gives a virtual, upright, magnified image', () => {
    const r = lens({ F: 10, d: 5 });
    expect(r.f).toBeCloseTo(-10, 9);
    expect(r.real).toBe(0);
    expect(r.H).toBeGreaterThan(0);
    expect(r.G).toBeCloseTo(2, 9);
  });

  it('d = F: no image', () => {
    expect(lens({ F: 10, d: 10 })).toMatchObject({ none: 1, f: 0 });
  });

  it('a diverging lens always gives a virtual upright reduced image', () => {
    for (const d of [2, 10, 25, 60]) {
      const r = lens({ kind: 1, F: 10, d });
      expect(r.real).toBe(0);
      expect(r.H).toBeGreaterThan(0);
      expect(r.G).toBeLessThan(1);
      expect(r.D).toBeCloseTo(-10, 9);
    }
  });

  it('the screen is sharp only at the image', () => {
    expect(lens({ F: 10, d: 20, s: 20 }).blur).toBeCloseTo(0, 9);
    expect(lens({ F: 10, d: 20, s: 30 }).blur).toBeGreaterThan(1);
  });

  it('all characteristic rays meet at the image', () => {
    for (const p of [
      { kind: 0, F: 10, d: 25, h: 3, s: 20 },
      { kind: 0, F: 10, d: 5, h: 3, s: 20 },
      { kind: 1, F: 10, d: 25, h: 3, s: 20 },
    ]) {
      const img = lensImage(p);
      const segs = lensRays(p, 80);
      // Every ray after the lens (or its extension) passes the image point.
      for (const s of segs.filter((q) => q.from.x === 0)) {
        const k = (s.to.y - s.from.y) / (s.to.x - s.from.x);
        expect(s.from.y + k * (img.f - s.from.x)).toBeCloseTo(img.H, 6);
      }
    }
  });

  it('f(d) series is split at the focus', () => {
    const { near, far } = imageSeries({ kind: 0, F: 10, d: 25, h: 3, s: 20 });
    expect(near.every((q) => q.x < 10 && q.y < 0)).toBe(true);
    expect(far.every((q) => q.x > 10 && q.y > 0)).toBe(true);
  });
});

describe('optics models', () => {
  it('are registered and finite at the corners of their parameters', () => {
    for (const m of [reflection, refraction, thinLens] as unknown as LabModel[]) {
      expect(labModel(m.code)).toBe(m);
      for (const p of [defaultParams(m), ...corners(m)])
        for (const v of Object.values(m.compute(p)))
          expect(Number.isFinite(v), `${m.code} ${JSON.stringify(p)}`).toBe(true);
    }
  });
});
