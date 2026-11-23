/** A force acting on a body, as a vector in scene coordinates (x right, y up), in newtons. */
export type ForceKind = 'gravity' | 'normal' | 'tension' | 'friction' | 'applied';

export interface ForceVec {
  body: string;
  kind: ForceKind;
  x: number;
  y: number;
  /** Index for several forces of one kind on a body (T₁, T₂). */
  index?: number;
}

export const magnitude = (f: { x: number; y: number }) => Math.hypot(f.x, f.y);
const rad = (deg: number) => (deg * Math.PI) / 180;
/** sin/cos with exact values at 0° and 90° (clean readouts). */
export const sinD = (deg: number) => (deg === 0 ? 0 : deg === 90 ? 1 : Math.sin(rad(deg)));
export const cosD = (deg: number) => (deg === 90 ? 0 : deg === 0 ? 1 : Math.cos(rad(deg)));
