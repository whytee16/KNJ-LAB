import { lensRays, thinLens, type ThinLensParams } from '@knj/physics';

/** Bench span in centimetres: from the farthest candle to the farthest screen or image. */
export function benchSpan(p: ThinLensParams) {
  const r = thinLens.compute(p);
  const right = Math.max(p.s, r.real ? r.f : 0, p.F * 2, 20) + 8;
  const left = -Math.max(p.d, p.F * 2, r.real ? 0 : -r.f, 10) - 8;
  return { left, right, r, rays: lensRays(p, right) };
}

/** The vertical scale of the drawings is 3 times the horizontal one (sizes are small). */
export const STRETCH_Y = 3;
