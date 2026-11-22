import { inclinedPlane, slideAt, type InclinedPlaneParams } from '@knj/physics';

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Geometry of the slope in metres: the top of the slope is at (0, h), the bottom at (b, 0).
 * Shared by the 3D and 2D views; positions and forces come from the model only.
 */
export function inclineFrame(p: InclinedPlaneParams, tau: number) {
  const r = inclinedPlane.compute(p);
  const a = rad(p.angle);
  const cos = p.angle === 90 ? 0 : Math.cos(a);
  const sin = p.angle === 0 ? 0 : Math.sin(a);
  const b = p.L * cos;
  const h = p.L * sin;
  const { s, v } = slideAt(p, tau);
  return {
    r,
    b,
    h,
    s,
    v,
    /** Point on the slope at distance s from the top. */
    at: (dist: number) => ({ x: dist * cos, y: h - dist * sin }),
    down: { x: cos, y: -sin },
    up: { x: -cos, y: sin },
    normal: { x: sin, y: cos },
  };
}
