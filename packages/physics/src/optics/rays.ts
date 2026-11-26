/** Plane vectors for ray optics (x right, y up). */
export type Vec = { x: number; y: number };

export const rad = (deg: number) => (deg * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};

/** Mirror image of the direction `d` off a surface with unit normal `n`: r = d − 2(d·n)n. */
export function reflect(d: Vec, n: Vec): Vec {
  const k = 2 * dot(d, n);
  return norm({ x: d.x - k * n.x, y: d.y - k * n.y });
}

/** Angle between the ray and the normal (0…90°), whichever side the normal points to. */
export function angleToNormal(d: Vec, n: Vec): number {
  return deg(Math.acos(Math.min(1, Math.abs(dot(norm(d), norm(n))))));
}

/**
 * Snell's law n₁ sin α = n₂ sin γ for the direction `d` crossing a surface with unit normal `n`
 * (any side). Returns null for total internal reflection.
 */
export function refract(d: Vec, n: Vec, n1: number, n2: number): Vec | null {
  const u = norm(d);
  // Normal against the incoming ray.
  const m = dot(u, n) > 0 ? { x: -n.x, y: -n.y } : n;
  const cosI = -dot(u, m);
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return null;
  const c = eta * cosI - Math.sqrt(k);
  return norm({ x: eta * u.x + c * m.x, y: eta * u.y + c * m.y });
}

/** Critical angle for light going from n₁ into a less dense n₂ (n₁ > n₂); 90° otherwise. */
export function criticalAngle(n1: number, n2: number): number {
  return n1 > n2 ? deg(Math.asin(n2 / n1)) : 90;
}

/** Image of a point in a plane mirror through `o` with unit normal `n`. */
export function mirrorImage(p: Vec, o: Vec, n: Vec): Vec {
  const k = 2 * dot({ x: p.x - o.x, y: p.y - o.y }, n);
  return { x: p.x - k * n.x, y: p.y - k * n.y };
}
