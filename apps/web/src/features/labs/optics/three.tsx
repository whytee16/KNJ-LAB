'use client';

import { useTokens } from '@knj/ui/game3d';

export { Beam3D } from '@knj/ui/game3d';

export type V3 = [number, number, number];
/** Height of the lab desk; the optics benches stand on it. */
export const DESK = 3.2;

/** Laboratory desk (top at y = 0) with four legs down to the floor. */
export function Desk({ width, depth, z = 0 }: { width: number; depth: number; z?: number }) {
  const tk = useTokens();
  const legs: [number, number][] = [
    [-width / 2 + 0.3, z - depth / 2 + 0.3],
    [width / 2 - 0.3, z - depth / 2 + 0.3],
    [-width / 2 + 0.3, z + depth / 2 - 0.3],
    [width / 2 - 0.3, z + depth / 2 - 0.3],
  ];
  return (
    <group>
      <mesh position={[0, -0.08, z]} receiveShadow>
        <boxGeometry args={[width, 0.16, depth]} />
        <meshStandardMaterial color={tk.border} />
      </mesh>
      {legs.map(([x, lz]) => (
        <mesh key={`${x},${lz}`} position={[x, -DESK / 2 - 0.08, lz]}>
          <boxGeometry args={[0.2, DESK - 0.16, 0.2]} />
          <meshStandardMaterial color={tk.muted} />
        </mesh>
      ))}
    </group>
  );
}

/** A candle with a flame; `ghost` — its image (translucent). The flame tip is at `top`. */
export function Candle({
  base,
  height,
  ghost = false,
  inverted = false,
}: {
  base: V3;
  height: number;
  ghost?: boolean;
  inverted?: boolean;
}) {
  const tk = useTokens();
  const dir = inverted ? -1 : 1;
  const body = Math.max(height - 0.25, 0.05);
  const opacity = ghost ? 0.45 : 1;
  return (
    <group position={base}>
      <mesh position={[0, (dir * body) / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, body, 16]} />
        <meshStandardMaterial color={tk.surface} transparent={ghost} opacity={opacity} />
      </mesh>
      <mesh position={[0, dir * (body + 0.12), 0]} scale={[1, 1.6, 1]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color={tk.accent} transparent={ghost} opacity={opacity} />
      </mesh>
    </group>
  );
}
