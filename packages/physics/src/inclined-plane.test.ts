import { describe, expect, it } from 'vitest';
import {
  accelerationByAngle,
  inclinedPlane,
  labModel,
  parseParams,
  slideAt,
  slopeAcceleration,
} from './index.ts';

const base = { angle: 30, m: 2, mu: 0.2, L: 4, g: 9.8 };

describe('inclined plane', () => {
  it('forces match mg, mg·sin α, mg·cos α', () => {
    const r = inclinedPlane.compute(base);
    expect(r.Fg).toBeCloseTo(19.6, 10);
    expect(r.Fpar).toBeCloseTo(9.8, 10);
    expect(r.N).toBeCloseTo(19.6 * Math.cos(Math.PI / 6), 10);
    expect(r.Ffr).toBeCloseTo(0.2 * r.N, 10);
  });

  it('acceleration a = g(sin α − μ cos α), time and speed from s = at²/2', () => {
    const r = inclinedPlane.compute(base);
    const a = 9.8 * (0.5 - 0.2 * Math.cos(Math.PI / 6));
    expect(r.a).toBeCloseTo(a, 10);
    expect(r.moves).toBe(1);
    expect(r.t).toBeCloseTo(Math.sqrt(8 / a), 10);
    expect(r.v).toBeCloseTo(Math.sqrt(2 * a * 4), 10);
  });

  it('acceleration does not depend on the mass', () => {
    expect(inclinedPlane.compute({ ...base, m: 0.5 }).a).toBeCloseTo(
      inclinedPlane.compute({ ...base, m: 9 }).a,
      12,
    );
  });

  it('without friction a = g sin α', () => {
    expect(slopeAcceleration({ angle: 30, mu: 0, g: 9.8 })).toBeCloseTo(4.9, 10);
  });

  it('below the critical angle the block stays at rest and friction balances the pull', () => {
    const p = { ...base, angle: 10, mu: 0.3 };
    const r = inclinedPlane.compute(p);
    expect(r.moves).toBe(0);
    expect(r.a).toBe(0);
    expect(r.t).toBe(0);
    expect(r.Ffr).toBeCloseTo(r.Fpar, 12);
    expect(r.Ffr).toBeLessThanOrEqual(0.3 * r.N);
    expect(r.critical).toBeCloseTo((Math.atan(0.3) * 180) / Math.PI, 10);
    expect(slideAt(p, 5)).toEqual({ s: 0, v: 0 });
  });

  it('at exactly tg α = μ the block stays (static friction holds)', () => {
    expect(slopeAcceleration({ angle: 45, mu: 1, g: 9.8 })).toBe(0);
  });

  it('flat surface: no pull, no motion', () => {
    const r = inclinedPlane.compute({ ...base, angle: 0 });
    expect(r.Fpar).toBe(0);
    expect(r.N).toBeCloseTo(19.6, 12);
    expect(r.moves).toBe(0);
  });

  it('slides the whole length and stops at the bottom', () => {
    const r = inclinedPlane.compute(base);
    expect(slideAt(base, r.t).s).toBeCloseTo(4, 10);
    expect(slideAt(base, r.t + 10).s).toBeCloseTo(4, 10);
    expect(slideAt(base, r.t / 2).s).toBeCloseTo(1, 10);
  });

  it('a(α) is zero up to α* and grows after it', () => {
    const series = accelerationByAngle({ ...base, mu: 0.5 });
    const crit = (Math.atan(0.5) * 180) / Math.PI;
    for (const q of series) {
      if (q.x <= crit) expect(q.y).toBe(0);
      else expect(q.y).toBeGreaterThan(0);
    }
  });

  it('registry and parameter parsing', () => {
    expect(labModel('inclined-plane')).toBe(inclinedPlane);
    expect(parseParams(inclinedPlane, { angle: 80, mu: 0.33, m: 0 })).toEqual({
      angle: 60,
      mu: 0.35,
      m: 0.1,
      L: 4,
      g: 9.8,
    });
  });
});
