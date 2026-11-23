import { cosD, sinD, type ForceVec } from './types.ts';

/**
 * Where a body of the chain is: hanging on the rope, or lying on a surface (horizontal or a slope).
 * `forward` is the body's direction of motion when the system moves "positively".
 */
export type ChainPlace =
  | { kind: 'hanging'; forward: 'down' | 'up' }
  | {
      kind: 'surface';
      /** Slope angle (0 — horizontal table). */
      angle: number;
      mu: number;
      /** The slope goes down to the right or to the left (for a table: the side of the pulley). */
      descends: 'right' | 'left';
      forward: 'down' | 'up';
    };

export interface ChainBody {
  id: string;
  m: number;
  place: ChainPlace;
}

export interface ChainSpec {
  /** Bodies in rope order: the rope runs from bodies[0] to bodies[n − 1]. */
  bodies: ChainBody[];
  g: number;
  /** Acceleration of the frame (elevator) upwards; effective gravity g + aFrame. */
  aFrame?: number;
}

export interface ChainResult {
  /** Acceleration of the system along the rope (> 0 — in the "forward" directions). */
  a: number;
  moves: boolean;
  /** Tension of each rope segment between body i and i + 1. */
  tensions: number[];
  /** A segment with a negative tension would be slack: the model does not apply then. */
  slack: boolean;
  /** Per body: normal force and friction magnitude, unit direction of "forward" motion. */
  perBody: { id: string; N: number; friction: number; u: { x: number; y: number } }[];
  forces: ForceVec[];
}

/** Unit vector of the body's forward motion in scene coordinates. */
export function forwardVector(place: ChainPlace): { x: number; y: number } {
  if (place.kind === 'hanging') return { x: 0, y: place.forward === 'down' ? -1 : 1 };
  const side = place.descends === 'right' ? 1 : -1;
  const down = { x: side * cosD(place.angle), y: -sinD(place.angle) };
  return place.forward === 'down' ? down : { x: -down.x, y: -down.y };
}

function surfaceNormal(place: Extract<ChainPlace, { kind: 'surface' }>) {
  const side = place.descends === 'right' ? 1 : -1;
  return { x: side * sinD(place.angle), y: cosD(place.angle) };
}

/**
 * Bodies connected by one inextensible rope over ideal (massless, frictionless) pulleys.
 * Newton's second law along the rope for the whole system; then the tensions body by body.
 * If static friction can hold the system, it stays at rest (a = 0).
 */
export function solveChain(spec: ChainSpec): ChainResult {
  const g = spec.g + (spec.aFrame ?? 0);
  const M = spec.bodies.reduce((s, b) => s + b.m, 0);
  const drive = spec.bodies.map((b) => {
    // Gravity component along the body's forward direction.
    const u = forwardVector(b.place);
    return -b.m * g * u.y;
  });
  const fMax = spec.bodies.map((b) =>
    b.place.kind === 'surface' ? b.place.mu * b.m * g * cosD(b.place.angle) : 0,
  );
  const D = drive.reduce((s, x) => s + x, 0);
  const Fmax = fMax.reduce((s, x) => s + x, 0);

  const moves = Math.abs(D) > Fmax + 1e-12;
  const a = moves ? (D - Math.sign(D) * Fmax) / M : 0;
  // Friction along "forward" (signed): sliding — against the motion; at rest — balances the drive
  // (shared in proportion to the maximum each surface can give).
  const friction = fMax.map((f) => (moves ? -Math.sign(D) * f : Fmax > 0 ? (-D * f) / Fmax : 0));

  const tensions: number[] = [];
  let T = 0; // tension pulling the current body forward (from the previous segment)
  spec.bodies.forEach((b, i) => {
    if (i === spec.bodies.length - 1) return;
    // m a = drive + friction + T_prev − T_next
    T = T + drive[i]! + friction[i]! - b.m * a;
    tensions.push(T);
  });

  const forces: ForceVec[] = [];
  const perBody = spec.bodies.map((b, i) => {
    const u = forwardVector(b.place);
    forces.push({ body: b.id, kind: 'gravity', x: 0, y: -b.m * g });
    let N = 0;
    if (b.place.kind === 'surface') {
      N = b.m * g * cosD(b.place.angle);
      const n = surfaceNormal(b.place);
      forces.push({ body: b.id, kind: 'normal', x: n.x * N, y: n.y * N });
      if (Math.abs(friction[i]!) > 1e-12)
        forces.push({ body: b.id, kind: 'friction', x: u.x * friction[i]!, y: u.y * friction[i]! });
    }
    const pullForward = i > 0 ? tensions[i - 1]! : 0;
    const pullBack = i < tensions.length ? tensions[i]! : 0;
    if (pullForward)
      forces.push({ body: b.id, kind: 'tension', x: u.x * pullForward, y: u.y * pullForward });
    if (pullBack)
      forces.push({ body: b.id, kind: 'tension', x: -u.x * pullBack, y: -u.y * pullBack });
    return { id: b.id, N, friction: Math.abs(friction[i]!), u };
  });

  return { a, moves, tensions, slack: tensions.some((t) => t < -1e-9), perBody, forces };
}
