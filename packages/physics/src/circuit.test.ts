import { describe, expect, it } from 'vitest';
import { chargeOffset, circuit, iv, labModel, PARALLEL, parseParams, SERIES } from './index.ts';

const base = { emf: 12, r: 0, R1: 10, R2: 20, mode: SERIES };

describe('circuit: series', () => {
  it('Ohm law and series rules: same current, voltages add up', () => {
    const c = circuit.compute(base);
    expect(c.R).toBe(30);
    expect(c.I).toBeCloseTo(0.4, 12);
    expect(c.I1).toBe(c.I);
    expect(c.I2).toBe(c.I);
    expect(c.U1).toBeCloseTo(4, 12);
    expect(c.U2).toBeCloseTo(8, 12);
    expect(c.U1 + c.U2).toBeCloseTo(c.U, 12);
    expect(c.U).toBe(12); // r = 0: terminal voltage equals the EMF
  });
});

describe('circuit: parallel', () => {
  it('same voltage on branches, currents add up, 1/R = 1/R1 + 1/R2', () => {
    const c = circuit.compute({ ...base, mode: PARALLEL });
    expect(c.R).toBeCloseTo(20 / 3, 12);
    expect(c.I).toBeCloseTo(1.8, 12);
    expect(c.U1).toBe(c.U2);
    expect(c.I1).toBeCloseTo(1.2, 12);
    expect(c.I2).toBeCloseTo(0.6, 12);
    expect(c.I1 + c.I2).toBeCloseTo(c.I, 12);
    expect(1 / c.R).toBeCloseTo(1 / 10 + 1 / 20, 12);
  });

  it('the parallel resistance is smaller than the smallest resistor', () => {
    expect(circuit.compute({ ...base, mode: PARALLEL }).R).toBeLessThan(10);
  });
});

describe('circuit: full-circuit Ohm law', () => {
  it('I = ε/(R + r), U = ε − Ir, power balance εI = P + I²r', () => {
    for (const mode of [SERIES, PARALLEL]) {
      const p = { ...base, r: 2, mode };
      const c = circuit.compute(p);
      expect(c.I).toBeCloseTo(12 / (c.R + 2), 12);
      expect(c.U).toBeCloseTo(12 - c.I * 2, 12);
      expect(c.U).toBeLessThan(12);
      expect(12 * c.I).toBeCloseTo(c.P + c.I * c.I * 2, 10);
    }
  });
});

describe('helpers', () => {
  it('charges move with the current and stop without it', () => {
    expect(chargeOffset(0, 10)).toBe(0);
    expect(chargeOffset(1, 2)).toBeCloseTo(0.5, 12);
    expect(chargeOffset(2, 1)).toBeCloseTo(chargeOffset(1, 2), 12);
    const x = chargeOffset(0.7, 123.4);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });

  it('I(U) is a straight line through the origin with slope 1/R', () => {
    expect(iv(10, 12)).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 1.2 },
    ]);
  });

  it('registry and parameter parsing (mode is one of the choices)', () => {
    expect(labModel('circuit')).toBe(circuit);
    expect(parseParams(circuit, { mode: 0.7, R1: 0, emf: 100 })).toEqual({
      emf: 24,
      r: 0,
      R1: 1,
      R2: 20,
      mode: PARALLEL,
    });
  });
});
