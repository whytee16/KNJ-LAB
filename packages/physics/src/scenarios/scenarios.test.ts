import { describe, expect, it } from 'vitest';
import { defaultParams, labModel, type ParamSpec } from '../index.ts';
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
    expect(elevatorScales.compute({ m: 60, a: 2 }).P).toBeCloseTo(60 * 11.8, 9);
    expect(elevatorScales.compute({ m: 60, a: -9.8 }).P).toBe(0);
    expect(elevatorScales.status({ m: 60, a: -9.8 }).key).toBe('weightless');
    expect(elevatorScales.state({ m: 60, a: 2 }, 1).live.v).toBeCloseTo(2, 12);
  });

  it('lamp: flatter ropes pull harder; strength is checked', () => {
    const steep = lampTwoRopes.compute({ m: 2, alpha1: 60, alpha2: 60, F: 0, Tmax: 150 });
    const flat = lampTwoRopes.compute({ m: 2, alpha1: 10, alpha2: 10, F: 0, Tmax: 150 });
    expect(flat.T1).toBeGreaterThan(steep.T1);
    expect(lampTwoRopes.status({ m: 10, alpha1: 5, alpha2: 5, F: 0, Tmax: 150 }).key).toBe(
      'breaks',
    );
  });

  it('block and pulley / Atwood match the textbook formulas', () => {
    expect(blockPulley.compute({ m1: 2, m2: 1, mu: 0.2 }).a).toBeCloseTo(((1 - 0.4) * 9.8) / 3, 12);
    expect(blockPulley.status({ m1: 4, m2: 1, mu: 0.5 }).key).toBe('rests');
    expect(atwood.compute({ m1: 3, m2: 1 }).a).toBeCloseTo(4.9, 12);
    expect(atwood.compute({ m1: 3, m2: 1 }).T).toBeCloseTo(14.7, 12);
    // Travels the 1 m track in t = √(2/a).
    expect(atwood.compute({ m1: 3, m2: 1 }).t).toBeCloseTo(Math.sqrt(2 / 4.9), 12);
  });
});
