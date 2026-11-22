import { describe, expect, it } from 'vitest';
import {
  exactPeriod,
  labModel,
  pendulum,
  pendulumAt,
  pendulumEnergy,
  simulatePendulum,
  springAt,
  springPendulum,
} from './index.ts';

const p = { l: 1, theta0: 10, m: 0.5, g: 9.8 };

describe('mathematical pendulum', () => {
  it('small-angle period T₀ = 2π√(l/g) does not depend on the mass', () => {
    const r = pendulum.compute(p);
    expect(r.T0).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 9.8), 12);
    expect(pendulum.compute({ ...p, m: 2 }).T).toBeCloseTo(r.T, 12);
  });

  it('exact period matches the known series and grows with the amplitude', () => {
    // T ≈ T₀(1 + θ₀²/16 + 11θ₀⁴/3072) for moderate angles.
    for (const deg of [5, 10, 20, 30]) {
      const th = (deg * Math.PI) / 180;
      const series = 1 + (th * th) / 16 + (11 * th ** 4) / 3072;
      const T0 = 2 * Math.PI * Math.sqrt(1 / 9.8);
      expect(exactPeriod({ l: 1, g: 9.8, theta0: deg }) / T0).toBeCloseTo(series, 4);
    }
    // Known value: at 90° the period is 1.18034 T₀.
    expect(
      exactPeriod({ l: 1, g: 9.8, theta0: 90 }) / (2 * Math.PI * Math.sqrt(1 / 9.8)),
    ).toBeCloseTo(1.18034, 5);
    expect(pendulum.compute({ ...p, theta0: 60 }).deviation).toBeGreaterThan(6);
    expect(pendulum.compute({ ...p, theta0: 5 }).deviation).toBeLessThan(0.1);
  });

  it('numerical motion returns to θ₀ after the exact period and conserves energy', () => {
    for (const theta0 of [10, 60]) {
      const q = { ...p, theta0 };
      const T = exactPeriod(q);
      const samples = simulatePendulum(q, 2 * T);
      const back = pendulumAt(samples, T);
      expect((back.theta * 180) / Math.PI).toBeCloseTo(theta0, 2);
      const E0 = pendulum.compute(q).E;
      for (const s of samples.filter((_, i) => i % 37 === 0))
        expect(pendulumEnergy(q, s).E).toBeCloseTo(E0, 6);
      // Lowest point: all energy is kinetic, speed is v_max.
      const bottom = pendulumAt(samples, T / 4);
      expect(Math.abs(bottom.theta)).toBeLessThan(1e-3);
      expect(Math.abs(pendulumEnergy(q, bottom).v)).toBeCloseTo(pendulum.compute(q).vMax, 3);
    }
  });

  it('is deterministic', () => {
    expect(simulatePendulum(p, 3)).toEqual(simulatePendulum(p, 3));
  });
});

describe('spring pendulum', () => {
  const s = { m: 1, k: 40, A: 0.1 };
  it('T = 2π√(m/k), E = kA²/2, v_max = ωA', () => {
    const r = springPendulum.compute(s);
    expect(r.T).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 40), 12);
    expect(r.E).toBeCloseTo(0.2, 12);
    expect(r.vMax).toBeCloseTo(Math.sqrt(40) * 0.1, 12);
    expect(springPendulum.compute({ ...s, A: 0.3 }).T).toBeCloseTo(r.T, 12); // isochronous
  });

  it('x(t) = A cos ωt; energy is conserved; F = −kx', () => {
    const T = springPendulum.compute(s).T;
    expect(springAt(s, 0).x).toBe(0.1);
    expect(springAt(s, T / 2).x).toBeCloseTo(-0.1, 12);
    expect(springAt(s, T / 4).x).toBeCloseTo(0, 12);
    for (const t of [0, 0.1, 0.37, T])
      expect(springAt(s, t).Ek + springAt(s, t).Ep).toBeCloseTo(0.2, 12);
    expect(springAt(s, 0.2).F).toBeCloseTo(-40 * springAt(s, 0.2).x, 12);
  });

  it('registry knows both labs', () => {
    expect(labModel('math-pendulum')).toBe(pendulum);
    expect(labModel('spring-pendulum')).toBe(springPendulum);
  });
});
