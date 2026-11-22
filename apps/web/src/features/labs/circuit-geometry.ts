import { PARALLEL, type CircuitParams } from '@knj/physics';

/** Board coordinates (x to the right, z towards the viewer), shared by the 3D and 2D views. */
export type P2 = [number, number];

export interface CircuitLayout {
  /** Conductors with the current each one carries (as a fraction key of the results). */
  wires: { points: P2[]; current: 'I' | 'I1' | 'I2' }[];
  battery: P2;
  switchAt: P2;
  ammeter: P2;
  R1: P2;
  R2: P2;
  voltmeter: P2;
  /** Ends of R1 where the voltmeter leads attach. */
  r1Ends: [P2, P2];
}

/**
 * Layout of the circuit. Conventional current leaves the "+" terminal (top of the battery),
 * goes clockwise: switch → ammeter → resistors → back to "−".
 */
export function circuitLayout(p: Pick<CircuitParams, 'mode'>): CircuitLayout {
  const common = { battery: [-4, 0] as P2, switchAt: [-2, 2] as P2, ammeter: [1.2, 2] as P2 };
  if (p.mode === PARALLEL)
    return {
      ...common,
      R1: [0, -2],
      R2: [0, -3.6],
      voltmeter: [0, -0.5],
      r1Ends: [
        [-0.9, -2],
        [0.9, -2],
      ],
      wires: [
        {
          points: [
            [-4, 0.6],
            [-4, 2],
            [4, 2],
            [4, -2],
            [3, -2],
          ],
          current: 'I',
        },
        {
          points: [
            [3, -2],
            [-3, -2],
          ],
          current: 'I1',
        },
        {
          points: [
            [3, -2],
            [3, -3.6],
            [-3, -3.6],
            [-3, -2],
          ],
          current: 'I2',
        },
        {
          points: [
            [-3, -2],
            [-4, -2],
            [-4, -0.6],
          ],
          current: 'I',
        },
      ],
    };
  return {
    ...common,
    R1: [1.5, -2],
    R2: [-1.5, -2],
    voltmeter: [1.5, -0.5],
    r1Ends: [
      [0.6, -2],
      [2.4, -2],
    ],
    wires: [
      {
        points: [
          [-4, 0.6],
          [-4, 2],
          [4, 2],
          [4, -2],
          [-4, -2],
          [-4, -0.6],
        ],
        current: 'I',
      },
    ],
  };
}

/** Point at fraction s (0…1) of a polyline's length. */
export function pointAlong(points: P2[], s: number): P2 {
  const seg = points.slice(1).map((q, i) => Math.hypot(q[0] - points[i]![0], q[1] - points[i]![1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = s * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]! || i === seg.length - 1) {
      const k = seg[i]! ? Math.min(d / seg[i]!, 1) : 0;
      const a = points[i]!;
      const b = points[i + 1]!;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= seg[i]!;
  }
  return points[points.length - 1]!;
}

export function wireLength(points: P2[]): number {
  return points
    .slice(1)
    .reduce((a, q, i) => a + Math.hypot(q[0] - points[i]![0], q[1] - points[i]![1]), 0);
}

/** Charges spread along a wire about every 0.6 units, shifted by the flow offset (0…1 of the gap). */
export function chargePositions(points: P2[], offset: number): P2[] {
  const len = wireLength(points);
  const n = Math.max(1, Math.round(len / 0.6));
  return Array.from({ length: n }, (_, i) => pointAlong(points, (i + offset) / n));
}
