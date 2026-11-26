'use client';

import { reflectionGeometry, type ReflectionParams } from '@knj/physics';
import { GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from '../lab-frame-3d';
import { Beam3D, Candle, Desk, DESK, type V3 } from './three';

const K = 0.15; // scene units per centimetre
const BEAM = 0.45; // height of the beam above the desk
/** The bench is seen from above: (x, y) of the drawing lie on the desk. */
const at = (p: { x: number; y: number }, h = BEAM): V3 => [p.x * K, h, -p.y * K];

function Bench({ params, labels }: { params: ReflectionParams; labels: { image: string } }) {
  const tk = useTokens();
  const g = reflectionGeometry(params);
  const phi = (params.phi * Math.PI) / 180;
  const out = { x: g.O.x + g.reflected.x, y: g.O.y + g.reflected.y };
  // The pointer looks from the laser towards the mirror (scene z is minus drawing y).
  const laserYaw = Math.atan2(-g.laser.y, -g.laser.x);
  return (
    <>
      <Desk width={15} depth={11} z={-0.5} />
      {/* Protractor on the desk in front of the mirror. */}
      <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.6, 2.75, 64, 1, Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color={tk.muted} side={2} />
      </mesh>
      {/* The mirror: a thin plate standing on the desk, turned by φ. */}
      <group position={[0, 0.9, 0]} rotation-y={phi}>
        <mesh>
          <boxGeometry args={[0.08, 1.8, 6.2]} />
          {/* Silvered glass: light, slightly blue, shiny. */}
          <meshStandardMaterial
            color={tk.bg}
            emissive={tk.info}
            emissiveIntensity={0.08}
            metalness={0.35}
            roughness={0.08}
          />
        </mesh>
        <mesh position={[0.06, 0, 0]}>
          <boxGeometry args={[0.05, 1.9, 6.3]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
      </group>
      <Polyline3D
        points={[at(g.O), at({ x: g.n.x * 22, y: g.n.y * 22 })]}
        color={tk.muted}
        dashed
      />
      {/* Laser pointer on a stand, aimed at the mirror. */}
      <group position={at(g.laser)} rotation-y={laserYaw}>
        <mesh>
          <boxGeometry args={[1.1, 0.25, 0.25]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
        <mesh position={[0, -BEAM / 2, 0]}>
          <boxGeometry args={[0.15, BEAM, 0.15]} />
          <meshStandardMaterial color={tk.muted} />
        </mesh>
      </group>
      <Beam3D from={at(g.laser)} to={at(g.O)} color={tk.danger} />
      <Beam3D from={at(g.O)} to={at(out)} color={tk.danger} />
      <Label3D position={at(g.laser, BEAM + 0.5)} text="α" className="font-semibold text-danger" />
      <Label3D position={at(out, BEAM + 0.4)} text="β" className="font-semibold text-danger" />
      {/* Candle in front of the mirror and its image behind it. */}
      <Candle base={at(g.candle, 0)} height={1.4} />
      <Candle base={at(g.image, 0)} height={1.4} ghost />
      <Label3D position={at(g.image, 2)} text={labels.image} />
      {g.candleRays.map((r, i) => (
        <group key={i}>
          <Polyline3D points={[at(g.candle, 1.3), at(r.hit, 1.3)]} color={tk.accent} />
          <Polyline3D points={[at(r.hit, 1.3), at(r.end, 1.3)]} color={tk.accent} />
          <Polyline3D points={[at(r.hit, 1.3), at(g.image, 1.3)]} color={tk.accent} dashed />
        </group>
      ))}
    </>
  );
}

export default function ReflectionScene3D({
  params,
  labels,
  label,
  resetLabel,
  ...h
}: Scene3DHandlers & {
  params: ReflectionParams;
  labels: { image: string };
  label: string;
  resetLabel: string;
}) {
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[-3, 9, 9]}
      target={[-0.5, 0, -0.5]}
      fitWidth={14}
      room={{ width: 24, depth: 18, height: 9, center: [0, -3], floorY: -DESK, board: true }}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Bench params={params} labels={labels} />
    </GameScene3D>
  );
}
