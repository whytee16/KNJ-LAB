/** Uniformly accelerated motion from rest over a track: stops when the track ends. */
export function trackMotion(a: number, length: number, tau: number) {
  const A = Math.abs(a);
  if (A < 1e-12) return { s: 0, v: 0, T: 0 };
  const T = Math.sqrt((2 * length) / A);
  const t = Math.min(Math.max(tau, 0), T);
  return { s: (Math.sign(a) * A * t * t) / 2, v: a * t, T };
}

export const range = (n: number, max: number, f: (x: number) => number) =>
  Array.from({ length: n }, (_, i) => {
    const x = (max * i) / (n - 1);
    return { x, y: f(x) };
  });
