import type { Layout, Values } from '@knj/physics';

export type XY = { x: number; y: number };
export interface Box extends XY {
  w: number;
  h: number;
}

/** Scene geometry of a scenario in scene units (x right, y up), shared by the 3D and 2D views. */
export type SceneLayout =
  | { kind: 'elevator'; cabin: Box; scale: Box; person: Box; railOffset: number }
  | { kind: 'lamp'; node: XY; left: XY; right: XY; lamp: XY; wind: number }
  | {
      kind: 'table-pulley';
      table: { x0: number; x1: number; y: number };
      pulley: XY & { r: number };
      block: Box;
      hang: Box;
    }
  | { kind: 'atwood'; ceiling: number; pulley: XY & { r: number }; left: Box; right: Box };

export interface Frame {
  layout: SceneLayout;
  /** Where the forces of each body are drawn from. */
  anchors: Record<string, XY>;
  /** Width and centre of the scene (camera fit). */
  width: number;
  center: XY;
}

const ROPE = 3; // drawn rope length for the lamp, scene units

/** Lays out the scene for the current parameters and displacement s (metres along the motion). */
export function frameFor(layout: Layout, p: Values, s: number): Frame {
  switch (layout) {
    case 'elevator': {
      const cabin = { x: 0, y: 1.5, w: 2.4, h: 3 };
      const scale = { x: 0, y: 0.12, w: 1, h: 0.16 };
      const person = { x: 0, y: 0.2 + 0.9, w: 0.5, h: 1.8 };
      // The cabin stays in view; the shaft marks move by the displacement (1 unit per metre).
      return {
        layout: { kind: 'elevator', cabin, scale, person, railOffset: s - Math.floor(s) },
        anchors: { person: { x: 0, y: person.y } },
        width: 6,
        center: { x: 0, y: 1.5 },
      };
    }
    case 'lamp': {
      const a1 = ((p.alpha1 ?? 30) * Math.PI) / 180;
      const a2 = ((p.alpha2 ?? 30) * Math.PI) / 180;
      const node = { x: 0, y: 0 };
      return {
        layout: {
          kind: 'lamp',
          node,
          left: { x: -ROPE * Math.cos(a1), y: ROPE * Math.sin(a1) },
          right: { x: ROPE * Math.cos(a2), y: ROPE * Math.sin(a2) },
          lamp: { x: 0, y: -0.7 },
          wind: p.F ?? 0,
        },
        anchors: { knot: node },
        width: 2 * ROPE + 3,
        center: { x: 0, y: 0.6 },
      };
    }
    case 'table-pulley': {
      const k = 2.5; // scene units per metre of travel
      const d = Math.abs(s) * k * Math.sign(s || 1);
      const block = { x: -2.5 + d, y: 0.3, w: 0.8, h: 0.6 };
      const hang = { x: 1.35, y: -1 - d, w: 0.5, h: 0.5 };
      return {
        layout: {
          kind: 'table-pulley',
          table: { x0: -4, x1: 1, y: 0 },
          pulley: { x: 1.1, y: 0.25, r: 0.25 },
          block,
          hang,
        },
        anchors: { block: { x: block.x, y: block.y }, hang: { x: hang.x, y: hang.y } },
        width: 8,
        center: { x: -1, y: -0.8 },
      };
    }
    case 'atwood': {
      const k = 1.5;
      const d = s * k;
      const r = 0.5;
      const m1 = p.m1 ?? 1;
      const m2 = p.m2 ?? 1;
      const size = (m: number) => 0.35 + 0.25 * Math.cbrt(m);
      const left = { x: -r, y: 1.6 - d, w: size(m1), h: size(m1) };
      const right = { x: r, y: 1.6 + d, w: size(m2), h: size(m2) };
      return {
        layout: { kind: 'atwood', ceiling: 4.6, pulley: { x: 0, y: 4, r }, left, right },
        anchors: { left: { x: left.x, y: left.y }, right: { x: right.x, y: right.y } },
        width: 6,
        center: { x: 0, y: 2.2 },
      };
    }
  }
}
