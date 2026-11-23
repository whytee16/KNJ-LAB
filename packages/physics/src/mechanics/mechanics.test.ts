import { describe, expect, it } from 'vitest';
import { magnitude, solveChain, solveEquilibrium, solveSupportedBody } from './index.ts';

const g = 9.8;
const sum = (fs: { x: number; y: number }[]) =>
  fs.reduce((s, f) => ({ x: s.x + f.x, y: s.y + f.y }), { x: 0, y: 0 });

describe('chain: Atwood machine', () => {
  const atwood = (m1: number, m2: number) =>
    solveChain({
      g,
      bodies: [
        { id: 'a', m: m1, place: { kind: 'hanging', forward: 'down' } },
        { id: 'b', m: m2, place: { kind: 'hanging', forward: 'up' } },
      ],
    });
  it('a = (m1 − m2)g/(m1 + m2), T = 2·m1·m2·g/(m1 + m2)', () => {
    const r = atwood(3, 1);
    expect(r.a).toBeCloseTo((2 * g) / 4, 12);
    expect(r.tensions[0]).toBeCloseTo((2 * 3 * 1 * g) / 4, 12);
    expect(r.moves).toBe(true);
    expect(r.slack).toBe(false);
  });
  it('equal masses stay at rest with T = mg; reversed masses move backwards', () => {
    expect(atwood(2, 2).a).toBe(0);
    expect(atwood(2, 2).tensions[0]).toBeCloseTo(2 * g, 12);
    expect(atwood(1, 3).a).toBeCloseTo(-g / 2, 12);
  });
  it('Newton II holds for each body: Σ F = m·a·u', () => {
    const r = atwood(5, 2);
    for (const pb of r.perBody) {
      const f = sum(r.forces.filter((x) => x.body === pb.id));
      const m = pb.id === 'a' ? 5 : 2;
      expect(f.x).toBeCloseTo(m * r.a * pb.u.x, 9);
      expect(f.y).toBeCloseTo(m * r.a * pb.u.y, 9);
    }
  });
});

describe('chain: block on a table and a hanging weight', () => {
  const table = (m1: number, m2: number, mu: number) =>
    solveChain({
      g,
      bodies: [
        { id: 'hang', m: m2, place: { kind: 'hanging', forward: 'down' } },
        {
          id: 'block',
          m: m1,
          place: { kind: 'surface', angle: 0, mu, descends: 'right', forward: 'down' },
        },
      ],
    });
  it('a = (m2 − μ·m1)g/(m1 + m2), T = m2(g − a)', () => {
    const r = table(2, 1, 0.2);
    const a = ((1 - 0.2 * 2) * g) / 3;
    expect(r.a).toBeCloseTo(a, 12);
    expect(r.tensions[0]).toBeCloseTo(1 * (g - a), 12);
    expect(r.perBody[1]!.N).toBeCloseTo(2 * g, 12);
    expect(r.perBody[1]!.friction).toBeCloseTo(0.2 * 2 * g, 12);
  });
  it('without friction a = m2·g/(m1 + m2)', () => {
    expect(table(3, 1, 0).a).toBeCloseTo(g / 4, 12);
  });
  it('static friction holds: a = 0, T = m2·g, friction = m2·g < μ·m1·g', () => {
    const r = table(4, 1, 0.5);
    expect(r.moves).toBe(false);
    expect(r.a).toBe(0);
    expect(r.tensions[0]).toBeCloseTo(g, 12);
    expect(r.perBody[1]!.friction).toBeCloseTo(g, 12);
    for (const pb of r.perBody) {
      const f = sum(r.forces.filter((x) => x.body === pb.id));
      expect(magnitude(f)).toBeCloseTo(0, 9);
    }
  });
  it('effective gravity in an accelerating frame scales a and T', () => {
    const r = solveChain({
      g,
      aFrame: 2,
      bodies: [
        { id: 'a', m: 3, place: { kind: 'hanging', forward: 'down' } },
        { id: 'b', m: 1, place: { kind: 'hanging', forward: 'up' } },
      ],
    });
    expect(r.a).toBeCloseTo((2 * (g + 2)) / 4, 12);
  });
  it('block on a slope pulled up by a hanging weight (incline + pulley)', () => {
    const r = solveChain({
      g,
      bodies: [
        { id: 'hang', m: 2, place: { kind: 'hanging', forward: 'down' } },
        {
          id: 'block',
          m: 2,
          place: { kind: 'surface', angle: 30, mu: 0, descends: 'left', forward: 'up' },
        },
      ],
    });
    // 2g − 2g·sin30 = 4a ⇒ a = g/4
    expect(r.a).toBeCloseTo(g / 4, 12);
  });
});

describe('equilibrium: lamp on two ropes', () => {
  it('symmetric: T = mg/(2 sin α) (α above the horizontal)', () => {
    const r = solveEquilibrium({ m: 2, g, alpha1: 30, alpha2: 30 });
    expect(r.T1).toBeCloseTo((2 * g) / (2 * 0.5), 9);
    expect(r.T2).toBeCloseTo(r.T1, 12);
  });
  it('Lami theorem for unequal angles, and the forces balance', () => {
    const r = solveEquilibrium({ m: 3, g, alpha1: 30, alpha2: 60 });
    const W = 3 * g;
    // angles between forces: T1–T2: 90°, T2–W: 150°, W–T1: 120°
    expect(r.T1 / Math.sin((150 * Math.PI) / 180)).toBeCloseTo(W / Math.sin(Math.PI / 2), 9);
    expect(r.T2 / Math.sin((120 * Math.PI) / 180)).toBeCloseTo(W / Math.sin(Math.PI / 2), 9);
    expect(magnitude(sum(r.forces))).toBeCloseTo(0, 9);
  });
  it('the flatter the ropes, the larger the tension; strength and side force are checked', () => {
    expect(solveEquilibrium({ m: 1, g, alpha1: 10, alpha2: 10 }).T1).toBeGreaterThan(
      solveEquilibrium({ m: 1, g, alpha1: 45, alpha2: 45 }).T1,
    );
    expect(solveEquilibrium({ m: 1, g, alpha1: 5, alpha2: 5, Tmax: 50 }).breaks).toBe(true);
    const wind = solveEquilibrium({ m: 1, g, alpha1: 45, alpha2: 45, F: 5 });
    expect(wind.T1).toBeGreaterThan(wind.T2);
    expect(magnitude(sum(wind.forces))).toBeCloseTo(0, 9);
    expect(solveEquilibrium({ m: 1, g, alpha1: 45, alpha2: 45, F: 50 }).slack).toBe(true);
  });
});

describe('supported body: scales in an elevator', () => {
  it('P = m(g + a): overload up, less down, zero in free fall', () => {
    expect(solveSupportedBody({ m: 60, g, a: 0 }).P).toBeCloseTo(60 * g, 12);
    expect(solveSupportedBody({ m: 60, g, a: 2 }).P).toBeCloseTo(60 * (g + 2), 12);
    expect(solveSupportedBody({ m: 60, g, a: -2 }).P).toBeCloseTo(60 * (g - 2), 12);
    const free = solveSupportedBody({ m: 60, g, a: -g });
    expect(free.P).toBe(0);
    expect(free.overload).toBe(0);
    expect(free.forces).toHaveLength(1);
    expect(solveSupportedBody({ m: 60, g, a: -12 }).detached).toBe(true);
  });
});
