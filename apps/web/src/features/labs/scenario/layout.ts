import type { Layout, Values } from '@knj/physics';

export type XY = { x: number; y: number };
export interface Box extends XY {
  w: number;
  h: number;
}

/** Scene geometry of a scenario in scene units (x right, y up), shared by the 3D and 2D views. */
export type SceneLayout =
  | {
      kind: 'elevator';
      cabin: Box;
      scale: Box;
      person: Box;
      railOffset: number;
      /** Lift velocity and acceleration (m/s, m/s², up +) and displacement from the start (m). */
      v: number;
      a: number;
      h: number;
    }
  | { kind: 'lamp'; node: XY; left: XY; right: XY; lamp: XY; wind: number }
  | {
      kind: 'table-pulley';
      table: { x0: number; x1: number; y: number };
      pulley: XY & { r: number };
      block: Box;
      hang: Box;
      broken: boolean;
    }
  | {
      kind: 'atwood';
      ceiling: number;
      pulley: XY & { r: number };
      left: Box;
      right: Box;
      broken: boolean;
    };

export interface Frame {
  layout: SceneLayout;
  /** Where the forces of each body are drawn from. */
  anchors: Record<string, XY>;
  /** Width, height and centre of the scene (camera fit, 2D view box). */
  width: number;
  height: number;
  center: XY;
  /** Floor level (scene units) and the room around the scene; none for the lift shaft. */
  floor: number | null;
  room: { width: number; depth: number; height: number } | null;
}

/** Link between the bodies (parameter `link` of the chain scenarios). */
export const LINK = { rope: 0, chain: 1, spring: 2 } as const;

const ROPE = 3; // drawn rope length for the lamp, scene units
const FLOOR_M = 3; // metres between floors of the building (lift)

/** Floor of the building the lift is at, counting from the 5th floor at the start. */
export const liftFloor = (h: number) => 5 + Math.floor((h + FLOOR_M / 2) / FLOOR_M);

/** Motion state from the scenario: free fall after a broken link (m), lift velocity, broken link. */
export interface FrameMotion {
  fall?: number;
  v?: number;
  broken?: boolean;
}

/** Lays out the scene for the current parameters and displacement s (metres along the motion). */
export function frameFor(layout: Layout, p: Values, s: number, motion: FrameMotion = {}): Frame {
  const fall = motion.fall ?? 0;
  const v = motion.v ?? 0;
  const broken = motion.broken ?? false;
  switch (layout) {
    case 'elevator': {
      const cabin = { x: 0, y: 1.5, w: 2.4, h: 3 };
      const scale = { x: 0, y: 0.12, w: 1, h: 0.16 };
      const person = { x: 0, y: 0.2 + 0.9, w: 0.5, h: 1.8 };
      // The cabin stays in view; the shaft marks move by the displacement (1 unit per metre).
      return {
        layout: {
          kind: 'elevator',
          cabin,
          scale,
          person,
          railOffset: s - Math.floor(s),
          v,
          a: p.a ?? 0,
          h: s,
        },
        anchors: { person: { x: 0, y: person.y } },
        width: 7,
        height: 7.5,
        center: { x: 0.6, y: 1.5 },
        floor: null,
        room: null,
      };
    }
    case 'lamp': {
      const a1 = ((p.alpha1 ?? 30) * Math.PI) / 180;
      const a2 = ((p.alpha2 ?? 30) * Math.PI) / 180;
      const node = { x: 0, y: 0 };
      const left = { x: -ROPE * Math.cos(a1), y: ROPE * Math.sin(a1) };
      const right = { x: ROPE * Math.cos(a2), y: ROPE * Math.sin(a2) };
      // The lamp hangs well above the floor whatever the angles: the poles reach down to it.
      const floor = -3.4;
      return {
        layout: { kind: 'lamp', node, left, right, lamp: { x: 0, y: -0.7 }, wind: p.F ?? 0 },
        anchors: { knot: node },
        width: 2 * ROPE + 3,
        height: Math.max(left.y, right.y) - floor + 0.8,
        center: { x: 0, y: (Math.max(left.y, right.y) + floor) / 2 },
        floor,
        room: { width: 16, depth: 8, height: Math.max(left.y, right.y) - floor + 1.6 },
      };
    }
    case 'table-pulley': {
      const L = p.L ?? 1;
      const k = Math.min(2.5, 3.5 / L); // scene units per metre of travel
      const travel = L * k;
      const d = Math.abs(s) * k * Math.sign(s || 1);
      const x1 = 1;
      const x0 = x1 - travel - 2.2;
      const block = { x: x0 + 0.8 + d, y: 0.3, w: 0.8, h: 0.6 };
      const hang = { x: 1.35, y: -1 - d - fall * k, w: 0.5, h: 0.5 };
      const floor = -1 - travel - 0.8;
      return {
        layout: {
          kind: 'table-pulley',
          table: { x0, x1, y: 0 },
          pulley: { x: 1.1, y: 0.25, r: 0.25 },
          block,
          hang,
          broken,
        },
        anchors: { block: { x: block.x, y: block.y }, hang: { x: hang.x, y: hang.y } },
        width: x1 - x0 + 3,
        // Up to the normal-force arrow above the block (≈ 2.5 units).
        height: 3 - floor,
        center: { x: (x0 + x1) / 2 + 0.5, y: (3 + floor) / 2 },
        floor,
        room: { width: x1 - x0 + 12, depth: 8, height: 3 - floor },
      };
    }
    case 'atwood': {
      const L = p.L ?? 1;
      const k = 1.3 / L; // the faster side never reaches the pulley
      const d = s * k;
      const r = 0.5;
      const m1 = p.m1 ?? 1;
      const m2 = p.m2 ?? 1;
      const size = (m: number) => 0.35 + 0.25 * Math.cbrt(m);
      const left = { x: -r, y: 1.6 - d - fall * k, w: size(m1), h: size(m1) };
      const right = { x: r, y: 1.6 + d - fall * k, w: size(m2), h: size(m2) };
      return {
        layout: {
          kind: 'atwood',
          ceiling: 4.6,
          pulley: { x: 0, y: 4, r },
          left,
          right,
          broken,
        },
        anchors: { left: { x: left.x, y: left.y }, right: { x: right.x, y: right.y } },
        width: 6,
        height: 6.2,
        center: { x: 0, y: 2 },
        floor: -0.7,
        room: { width: 14, depth: 8, height: 5.5 },
      };
    }
  }
}
