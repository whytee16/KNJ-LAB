import type { LabModel } from './lab-model.ts';

export type CircuitParams = { emf: number; r: number; R1: number; R2: number; mode: number };
export type CircuitResults = {
  /** External resistance and the whole circuit current I = ε/(R + r). */
  R: number;
  I: number;
  I1: number;
  I2: number;
  U1: number;
  U2: number;
  /** Voltage at the source terminals U = ε − Ir (what the voltmeter across the source shows). */
  U: number;
  P1: number;
  P2: number;
  P: number;
};

export const SERIES = 0;
export const PARALLEL = 1;

/**
 * DC circuit: a source (EMF ε, internal resistance r) and two resistors connected in series or in
 * parallel. Ideal wires and ammeter (no resistance), ideal voltmeter (no current).
 */
export const circuit: LabModel<CircuitParams, CircuitResults> = {
  code: 'circuit',
  params: {
    emf: { min: 1, max: 24, step: 0.5, default: 12, unit: 'V', symbol: 'ε' },
    r: { min: 0, max: 5, step: 0.1, default: 0, unit: 'Ohm', symbol: 'r' },
    R1: { min: 1, max: 100, step: 1, default: 10, unit: 'Ohm', symbol: 'R₁' },
    R2: { min: 1, max: 100, step: 1, default: 20, unit: 'Ohm', symbol: 'R₂' },
    mode: {
      min: 0,
      max: 1,
      step: 1,
      default: SERIES,
      unit: '1',
      symbol: '',
      choices: [
        { value: SERIES, key: 'series' },
        { value: PARALLEL, key: 'parallel' },
      ],
    },
  },
  results: {
    R: { unit: 'Ohm', symbol: 'R', digits: 2 },
    I: { unit: 'A', symbol: 'I', digits: 3 },
    I1: { unit: 'A', symbol: 'I₁', digits: 3 },
    I2: { unit: 'A', symbol: 'I₂', digits: 3 },
    U1: { unit: 'V', symbol: 'U₁', digits: 2 },
    U2: { unit: 'V', symbol: 'U₂', digits: 2 },
    U: { unit: 'V', symbol: 'U', digits: 2 },
    P1: { unit: 'W', symbol: 'P₁', digits: 2 },
    P2: { unit: 'W', symbol: 'P₂', digits: 2 },
    P: { unit: 'W', symbol: 'P', digits: 2 },
  },
  compute: ({ emf, r, R1, R2, mode }) => {
    const parallel = mode === PARALLEL;
    const R = parallel ? (R1 * R2) / (R1 + R2) : R1 + R2;
    const I = emf / (R + r);
    const U = emf - I * r;
    const [I1, I2] = parallel ? [U / R1, U / R2] : [I, I];
    const [U1, U2] = parallel ? [U, U] : [I * R1, I * R2];
    const P1 = U1 * I1;
    const P2 = U2 * I2;
    return { R, I, I1, I2, U1, U2, U, P1, P2, P: P1 + P2 };
  },
  assumptions: [
    'labs.assumptions.idealWires',
    'labs.assumptions.idealMeters',
    'labs.assumptions.constantR',
  ],
};

/**
 * Position of the moving charges along a wire, in units of the wire length (0…1, wraps).
 * Speed is proportional to the current: what the eye sees follows I, not the drawing.
 */
export function chargeOffset(current: number, tau: number, unitsPerAmpere = 0.25): number {
  const s = current * unitsPerAmpere * tau;
  return s - Math.floor(s);
}

/** Current–voltage characteristic I(U) = U/R on [0, Umax] for the chart. */
export function iv(R: number, Umax: number, points = 2): { x: number; y: number }[] {
  return Array.from({ length: points }, (_, i) => {
    const U = (Umax * i) / (points - 1);
    return { x: U, y: U / R };
  });
}
