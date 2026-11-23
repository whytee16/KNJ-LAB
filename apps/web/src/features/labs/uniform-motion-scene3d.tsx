'use client';

import { ticks } from '@knj/ui/game';
import { Arrow3D, GameScene3D, Label3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from './lab-frame-3d';

type V3 = [number, number, number];
const ROAD = 16; // scene units for the whole scale of the road
const START = -ROAD / 2;

function Car({ x, low }: { x: number; low: boolean }) {
  const tk = useTokens();
  const seg = low ? 10 : 20;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.42, 0]} castShadow={!low}>
        <boxGeometry args={[1.3, 0.4, 0.75]} />
        <meshStandardMaterial color={tk.accent} />
      </mesh>
      <mesh position={[-0.1, 0.78, 0]} castShadow={!low}>
        <boxGeometry args={[0.7, 0.32, 0.65]} />
        <meshStandardMaterial color={tk.accent} />
      </mesh>
      <mesh position={[0.26, 0.78, 0]}>
        <boxGeometry args={[0.02, 0.24, 0.55]} />
        <meshStandardMaterial color={tk.info} />
      </mesh>
      {[-0.42, 0.42].flatMap((dx) =>
        [-0.38, 0.38].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.2, dz]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, seg]} />
            <meshStandardMaterial color={tk.text} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Tree({ position, low }: { position: V3; low: boolean }) {
  const tk = useTokens();
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 1, low ? 6 : 10]} />
        <meshStandardMaterial color={tk.muted} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow={!low}>
        <coneGeometry args={[0.55, 1.4, low ? 6 : 12]} />
        <meshStandardMaterial color={tk.success} />
      </mesh>
    </group>
  );
}

/** Road with the distance scale, the car, the start and end flags and the velocity arrow. */
function Road({
  x0,
  x,
  xEnd,
  scaleMax,
  v,
  format,
  unit,
  low,
}: {
  x0: number;
  x: number;
  xEnd: number;
  scaleMax: number;
  v: number;
  format: (n: number) => string;
  unit: string;
  low: boolean;
}) {
  const tk = useTokens();
  const marks = ticks(scaleMax, 6);
  const top = marks[marks.length - 1] || 1;
  const at = (m: number) => START + (m / top) * ROAD;
  const flag = (m: number, text: string, color: string) => (
    <group>
      <mesh position={[at(m), 0.9, -0.75]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
        <meshStandardMaterial color={tk.text} />
      </mesh>
      <mesh position={[at(m) + 0.22, 1.6, -0.75]}>
        <boxGeometry args={[0.44, 0.28, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Label3D position={[at(m), 2.1, -0.75]} text={text} className="font-semibold" />
    </group>
  );
  return (
    <>
      <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} receiveShadow={!low}>
        <planeGeometry args={[ROAD + 3, 2]} />
        <meshStandardMaterial color={tk.muted} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[START - 1 + i * 1.2 + 0.3, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.6, 0.07]} />
          <meshBasicMaterial color={tk.bg} />
        </mesh>
      ))}
      {/* Travelled part of the road. */}
      <mesh position={[(at(x0) + at(x)) / 2, 0.025, 0.75]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[Math.max(at(x) - at(x0), 0.001), 0.16]} />
        <meshBasicMaterial color={tk.accent} />
      </mesh>
      {marks.map((m) => (
        <group key={m}>
          <mesh position={[at(m), 0.25, 1.15]}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
            <meshStandardMaterial color={tk.text} />
          </mesh>
          <Label3D position={[at(m), 0.75, 1.15]} text={format(m)} />
        </group>
      ))}
      <Label3D position={[START + ROAD + 1, 0.75, 1.15]} text={`x, ${unit}`} />
      {flag(x0, 'x₀', tk.info)}
      {flag(xEnd, 'x', tk.success)}
      {[-7, -3.5, 1, 5.5].map((tx, i) => (
        <Tree key={tx} position={[tx, 0, i % 2 ? -3 : -3.6]} low={low} />
      ))}
      <Car x={at(x)} low={low} />
      {v > 0 ? (
        <>
          <Arrow3D
            from={[at(x), 1.35, 0]}
            to={[at(x) + 0.6 + Math.min(v, 30) * 0.08, 1.35, 0]}
            color={tk.success}
            radius={0.05}
          />
          <Label3D
            position={[at(x) + 0.9 + Math.min(v, 30) * 0.08, 1.55, 0]}
            text="v"
            className="font-semibold text-success"
          />
        </>
      ) : null}
    </>
  );
}

export default function UniformMotionScene3D({
  label,
  resetLabel,
  ...p
}: Scene3DHandlers & {
  x0: number;
  x: number;
  xEnd: number;
  scaleMax: number;
  v: number;
  format: (n: number) => string;
  unit: string;
  label: string;
  resetLabel: string;
}) {
  return (
    <GameScene3D
      quality={p.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[-2, 5, 11]}
      target={[0, 0.5, 0]}
      fitWidth={ROAD + 2}
      onFps={p.onFps}
      onContextLost={p.onContextLost}
    >
      <Road
        x0={p.x0}
        x={p.x}
        xEnd={p.xEnd}
        scaleMax={p.scaleMax}
        v={p.v}
        format={p.format}
        unit={p.unit}
        low={p.quality === 'low'}
      />
    </GameScene3D>
  );
}
