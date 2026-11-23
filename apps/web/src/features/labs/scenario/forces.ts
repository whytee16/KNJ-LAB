import type { ForceVec } from '@knj/physics';

/** Arrow vectors for the free-body diagram: the largest force is drawn `maxLength` long. */
export function forceArrows(
  forces: ForceVec[],
  anchors: Record<string, { x: number; y: number }>,
  maxLength: number,
) {
  const max = Math.max(...forces.map((f) => Math.hypot(f.x, f.y)), 1e-9);
  return forces
    .filter((f) => Math.hypot(f.x, f.y) > max * 1e-3 && anchors[f.body])
    .map((f, i) => {
      const a = anchors[f.body]!;
      const k = maxLength / max;
      return {
        key: `${f.body}-${f.kind}-${i}`,
        kind: f.kind,
        index: f.index,
        from: a,
        to: { x: a.x + f.x * k, y: a.y + f.y * k },
      };
    });
}

export const FORCE_TONE = {
  gravity: 'text',
  normal: 'info',
  tension: 'accent',
  friction: 'danger',
  applied: 'success',
} as const;
