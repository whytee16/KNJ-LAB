'use client';

import { DIVERGING, type ThinLensParams } from '@knj/physics';
import { GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from '../lab-frame-3d';
import { benchSpan, STRETCH_Y } from './lens-geometry';
import { Beam3D, Candle, Desk, DESK, type V3 } from './three';

const KX = 0.12; // scene units per centimetre along the bench
const KY = KX * STRETCH_Y;
const AXIS = 2.2; // height of the optical axis above the desk

const at = (p: { x: number; y: number }, z = 0): V3 => [p.x * KX, AXIS + p.y * KY, z];

function Bench({ params, labels }: { params: ThinLensParams; labels: { F: string; F2: string } }) {
  const tk = useTokens();
  const { left, right, r, rays } = benchSpan(params);
  const diverging = params.kind === DIVERGING;
  const sx = params.s * KX;
  // Where the cone through the image meets the screen.
  const spotY = r.real ? (r.H * params.s) / r.f : 0;
  const spotR = Math.max(0.05, (r.blur / 2) * KY);
  return (
    <>
      <Desk width={Math.max(14, (right - left) * KX + 3)} depth={6} />
      {/* Optical bench: a rail with riders. */}
      <mesh position={[((left + right) / 2) * KX, 0.1, 0]}>
        <boxGeometry args={[(right - left) * KX + 0.6, 0.2, 0.5]} />
        <meshStandardMaterial color={tk.text} />
      </mesh>
      <Polyline3D
        points={[at({ x: left, y: 0 }), at({ x: right, y: 0 })]}
        color={tk.muted}
        dashed
      />
      {/* The lens on its holder. */}
      <mesh position={[0, AXIS / 2, 0]}>
        <boxGeometry args={[0.12, AXIS, 0.12]} />
        <meshStandardMaterial color={tk.muted} />
      </mesh>
      {diverging ? (
        <group position={[0, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[1.5, 1.5, 0.06, 48]} />
            <meshStandardMaterial color={tk.info} transparent opacity={0.45} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.5, 0.12, 12, 48]} />
            <meshStandardMaterial color={tk.info} transparent opacity={0.6} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, AXIS, 0]} scale={[0.14, 1.5, 1.5]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color={tk.info} transparent opacity={0.45} />
        </mesh>
      )}
      {/* Foci on both sides. */}
      {[-2, -1, 1, 2].map((k) => (
        <group key={k}>
          <mesh position={at({ x: k * params.F, y: 0 })}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshBasicMaterial color={tk.text} />
          </mesh>
          <Label3D
            position={at({ x: k * params.F, y: -1.2 })}
            text={Math.abs(k) === 1 ? labels.F : labels.F2}
          />
        </group>
      ))}
      {/* The candle: its flame tip is the object point (−d, h). */}
      <Candle base={[-params.d * KX, AXIS, 0]} height={params.h * KY} />
      {r.none ? null : (
        <Candle base={[r.f * KX, AXIS, 0]} height={Math.abs(r.H) * KY} inverted={r.H < 0} ghost />
      )}
      {rays.map((s, i) =>
        s.virtual ? (
          <Polyline3D key={i} points={[at(s.from), at(s.to)]} color={tk.accent} dashed />
        ) : (
          <Beam3D key={i} from={at(s.from)} to={at(s.to)} color={tk.accent} radius={0.018} />
        ),
      )}
      {/* The screen; a real image shows on it as a spot or a sharp picture. */}
      <mesh position={[sx, AXIS, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshStandardMaterial color={tk.bg} side={2} />
      </mesh>
      <mesh position={[sx, AXIS / 2 - 0.4, 0]}>
        <boxGeometry args={[0.1, AXIS - 0.8, 0.1]} />
        <meshStandardMaterial color={tk.muted} />
      </mesh>
      {r.real && Math.abs(spotY * KY) < 1.3 ? (
        <mesh position={[sx - 0.02, AXIS + spotY * KY, 0]} rotation-y={-Math.PI / 2}>
          <circleGeometry args={[Math.min(spotR, 1.2), 32]} />
          <meshBasicMaterial
            color={tk.accent}
            transparent
            opacity={Math.max(0.15, Math.min(1, 0.12 / spotR))}
          />
        </mesh>
      ) : null}
    </>
  );
}

export default function LensScene3D({
  params,
  labels,
  label,
  resetLabel,
  ...h
}: Scene3DHandlers & {
  params: ThinLensParams;
  labels: { F: string; F2: string };
  label: string;
  resetLabel: string;
}) {
  const { left, right } = benchSpan(params);
  const cx = ((left + right) / 2) * KX;
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[cx - 0.8, AXIS + 1.8, 7]}
      target={[cx, AXIS, 0]}
      fitWidth={(right - left) * KX + 1}
      room={{ width: 26, depth: 16, height: 9, center: [0, -3], floorY: -DESK, board: true }}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Bench params={params} labels={labels} />
    </GameScene3D>
  );
}
