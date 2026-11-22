import { describe, expect, it } from 'vitest';
import {
  clampParam,
  createClock,
  flightTime,
  labModel,
  parseParams,
  projectile,
  projectileAt,
  projectileVelocity,
  speedSeries,
  trajectory,
} from './index.ts';

const g = 9.8;

describe('projectile motion', () => {
  it('matches the textbook formulas from the ground (h0 = 0)', () => {
    const v0 = 20;
    const a = (30 * Math.PI) / 180;
    const r = projectile.compute({ v0, angle: 30, h0: 0, g });
    expect(r.T).toBeCloseTo((2 * v0 * Math.sin(a)) / g, 10);
    expect(r.L).toBeCloseTo((v0 * v0 * Math.sin(2 * a)) / g, 10);
    expect(r.H).toBeCloseTo((v0 * v0 * Math.sin(a) ** 2) / (2 * g), 10);
    expect(r.vEnd).toBeCloseTo(v0, 10);
  });

  it('45° gives the longest range from the ground; complementary angles give equal ranges', () => {
    const L = (angle: number) => projectile.compute({ v0: 15, angle, h0: 0, g }).L;
    expect(L(45)).toBeGreaterThan(L(44));
    expect(L(45)).toBeGreaterThan(L(46));
    expect(L(30)).toBeCloseTo(L(60), 10);
  });

  it('handles a throw from a height (h0 > 0)', () => {
    const p = { v0: 10, angle: 0, h0: 20, g };
    const r = projectile.compute(p);
    expect(r.T).toBeCloseTo(Math.sqrt((2 * 20) / g), 10);
    expect(r.L).toBeCloseTo(10 * r.T, 10);
    expect(r.H).toBe(20);
    expect(r.vEnd).toBeCloseTo(Math.sqrt(100 + 2 * g * 20), 10);
    expect(projectileAt(p, r.T).y).toBeCloseTo(0, 9);
  });

  it('vertical throw goes straight up and lands at x = 0', () => {
    const p = { v0: 9.8, angle: 90, h0: 0, g };
    const r = projectile.compute(p);
    expect(r.L).toBe(0);
    expect(r.T).toBeCloseTo(2, 10);
    expect(r.H).toBeCloseTo(4.9, 10);
    expect(projectileVelocity(p, 1).vy).toBeCloseTo(0, 10);
  });

  it('horizontal throw from the ground lands at once', () => {
    expect(flightTime({ v0: 10, angle: 0, h0: 0, g })).toBe(0);
  });

  it('samples the trajectory and the speed over the flight', () => {
    const p = { v0: 15, angle: 45, h0: 0, g };
    const tr = trajectory(p, 21);
    expect(tr[0]).toEqual({ x: 0, y: 0 });
    expect(tr[20]!.x).toBeCloseTo(projectile.compute(p).L, 9);
    expect(Math.max(...tr.map((q) => q.y))).toBeCloseTo(projectile.compute(p).H, 9);
    const sp = speedSeries(p, 21);
    expect(sp[0]!.y).toBeCloseTo(15, 9);
    expect(Math.min(...sp.map((q) => q.y))).toBeCloseTo(15 * Math.cos(Math.PI / 4), 9);
  });

  it('g is one of the fixed choices', () => {
    expect(clampParam(projectile.params.g, 2)).toBe(1.6);
    expect(clampParam(projectile.params.g, 9)).toBe(9.8);
    expect(parseParams(projectile, { g: 3.6, angle: 95, v0: 0 })).toEqual({
      v0: 1,
      angle: 90,
      h0: 0,
      g: 3.7,
    });
    expect(labModel('projectile')).toBe(projectile);
  });

  it('model clock lands the body at the same time at any frame rate', () => {
    const p = { v0: 12, angle: 60, h0: 3, g };
    const T = flightTime(p);
    for (const fps of [30, 60, 144]) {
      const clock = createClock(1 / 120);
      while (clock.time < T) clock.advance(1 / fps);
      expect(projectileAt(p, clock.time).y).toBe(0);
      expect(projectileAt(p, clock.time).x).toBeCloseTo(projectile.compute(p).L, 9);
    }
  });
});
