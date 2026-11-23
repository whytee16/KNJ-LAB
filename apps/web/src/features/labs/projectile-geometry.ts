import {
  projectile,
  projectileAt,
  projectileVelocity,
  trajectory,
  type ProjectileParams,
} from '@knj/physics';

/** Shared bounds of a throw for both views (fixed while the body flies). */
export function throwFrame(p: ProjectileParams) {
  const r = projectile.compute(p);
  // With air resistance the ideal flight is drawn too, so the frame holds both.
  const ideal = p.drag ? projectile.compute({ ...p, drag: 0 }) : r;
  const top = Math.max(r.H, ideal.H, p.h0, 1);
  const right = Math.max(r.L, ideal.L, 1);
  return { r, ideal, top, right };
}

/** State of the body at model time τ (positions and velocity from the model only). */
export function throwState(p: ProjectileParams, tau: number) {
  const pos = projectileAt(p, tau);
  const vel = projectileVelocity(p, tau);
  return { pos, vel, speed: Math.hypot(vel.vx, vel.vy) };
}

export { trajectory };
