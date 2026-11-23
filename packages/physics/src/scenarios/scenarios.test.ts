import { describe, expect, it } from 'vitest';
import { defaultParams, isShown, labModel, type ParamSpec } from '../index.ts';
import {
  atwood,
  blockPulley,
  elevatorScales,
  lampTwoRopes,
  scenarioFor,
  scenarioSchema,
  SCENARIOS,
} from './index.ts';

const corners = (params: Record<string, ParamSpec>) => {
  const keys = Object.keys(params);
  return Array.from({ length: 2 ** keys.length }, (_, mask) =>
    Object.fromEntries(keys.map((k, i) => [k, mask & (1 << i) ? params[k]!.max : params[k]!.min])),
  );
};

describe('scenarios', () => {
  it('every scenario matches the schema and is a registered lab model', () => {
    for (const s of SCENARIOS) {
      expect(scenarioSchema.safeParse(s).success, s.code).toBe(true);
      expect(labModel(s.code)).toBe(s);
      expect(scenarioFor(s.code)).toBe(s);
    }
  });

  it('every scenario gives finite numbers at all corners of its parameter box', () => {
    for (const s of SCENARIOS) {
      for (const p of [defaultParams(s), ...corners(s.params)]) {
        const values = [
          ...Object.values(s.compute(p)),
          ...Object.values(s.state(p, 0.5).live),
          s.duration(p),
          ...s.forces(p).flatMap((f) => [f.x, f.y]),
          ...s.charts(p, 0).flatMap((c) => c.series.flatMap((q) => [q.x, q.y])),
        ];
        for (const v of values)
          expect(Number.isFinite(v), `${s.code} ${JSON.stringify(p)}`).toBe(true);
      }
    }
  });

  it('elevator: heavier when accelerating up, weightless in free fall', () => {
    const lift = (a: number, v0 = 0) => ({ m: 60, a, v0 });
    expect(elevatorScales.compute(lift(2)).P).toBeCloseTo(60 * 11.8, 9);
    expect(elevatorScales.compute(lift(-9.8)).P).toBe(0);
    expect(elevatorScales.status(lift(-9.8)).key).toBe('weightless');
    expect(elevatorScales.state(lift(2), 1).live.v).toBeCloseTo(2, 12);
  });

  it('elevator: going up and braking — the weight depends on a, not on v', () => {
    const p = { m: 60, a: -2, v0: 3 };
    expect(elevatorScales.state(p, 1).live.v).toBeCloseTo(1, 12);
    expect(elevatorScales.state(p, 1).live.h).toBeCloseTo(2, 12);
    expect(elevatorScales.compute(p).P).toBeCloseTo(elevatorScales.compute({ ...p, v0: -3 }).P, 12);
  });

  it('lamp: flatter ropes pull harder; strength is checked', () => {
    const steep = lampTwoRopes.compute({ m: 2, alpha1: 60, alpha2: 60, F: 0, Tmax: 150 });
    const flat = lampTwoRopes.compute({ m: 2, alpha1: 10, alpha2: 10, F: 0, Tmax: 150 });
    expect(flat.T1).toBeGreaterThan(steep.T1);
    expect(lampTwoRopes.status({ m: 10, alpha1: 5, alpha2: 5, F: 0, Tmax: 150 }).key).toBe(
      'breaks',
    );
  });

  const table = (p: Partial<Parameters<typeof blockPulley.compute>[0]>) => ({
    ...defaultParams(blockPulley),
    ...p,
  });
  const machine = (p: Partial<Parameters<typeof atwood.compute>[0]>) => ({
    ...defaultParams(atwood),
    ...p,
  });

  it('block and pulley / Atwood match the textbook formulas', () => {
    expect(blockPulley.compute(table({ m1: 2, m2: 1, mu: 0.2 })).a).toBeCloseTo(
      ((1 - 0.4) * 9.8) / 3,
      12,
    );
    expect(blockPulley.status(table({ m1: 4, m2: 1, mu: 0.5 })).key).toBe('rests');
    expect(atwood.compute(machine({ m1: 3, m2: 1 })).a).toBeCloseTo(4.9, 12);
    expect(atwood.compute(machine({ m1: 3, m2: 1 })).T).toBeCloseTo(14.7, 12);
    // Travels the track L in t = √(2L/a).
    expect(atwood.compute(machine({ m1: 3, m2: 1 })).t).toBeCloseTo(Math.sqrt(2 / 4.9), 12);
    expect(atwood.compute(machine({ m1: 3, m2: 1, L: 2 })).t).toBeCloseTo(Math.sqrt(4 / 4.9), 12);
  });

  it('rope, chain and spring give the same motion; the spring stretches by T/k', () => {
    const rope = blockPulley.compute(table({ link: 0 }));
    const chain = blockPulley.compute(table({ link: 1 }));
    const spring = blockPulley.compute(table({ link: 2, k: 200 }));
    expect(chain).toEqual(rope);
    expect(spring.a).toBe(rope.a);
    expect(rope.x).toBe(0);
    // Stiffness and extension are shown only for the spring.
    expect(isShown(blockPulley.params.k, table({ link: 0 }))).toBe(false);
    expect(isShown(blockPulley.params.k, table({ link: 2 }))).toBe(true);
    expect(isShown(blockPulley.results.x, table({ link: 2 }))).toBe(true);
    expect(spring.x).toBeCloseTo((100 * rope.T) / 200, 12); // centimetres
  });

  it('a weak link breaks: the hanging body falls freely', () => {
    const p = machine({ m1: 3, m2: 1, Tmax: 10 }); // needs T = 14.7 N
    expect(atwood.status(p).key).toBe('breaks');
    expect(atwood.state(p, 0.2)).toMatchObject({ s: 0 });
    expect(atwood.state(p, 0.2).fall).toBeCloseTo((9.8 * 0.04) / 2, 12);
    expect(atwood.duration(p)).toBeCloseTo(Math.sqrt(2 / 9.8), 12);
    const q = table({ m1: 4, m2: 1, mu: 0.5, Tmax: 5 }); // at rest, holds m₂g = 9.8 N
    expect(blockPulley.status(q).key).toBe('breaks');
  });
});
