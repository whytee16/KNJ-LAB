'use client';

import type { ProjectileParams } from '@knj/physics';
import { Arrow3D, GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import { useMemo } from 'react';
import { throwFrame, throwState, trajectory } from './projectile-geometry';

type V3 = [number, number, number];

function Throw({
  params,
  tau,
  scale,
  low,
  format,
  unit,
  vectorLabels,
}: {
  params: ProjectileParams;
  tau: number;
  scale: number;
  low: boolean;
  format: (n: number) => string;
  unit: string;
  vectorLabels: { v: string; vx: string; vy: string };
}) {
  const tk = useTokens();
  const { r } = throwFrame(params);
  const X0 = -5; // the throw starts left of the centre
  const at = (x: number, y: number): V3 => [X0 + x * scale, y * scale, 0];
  const points = useMemo(
    () => trajectory(params, low ? 31 : 81).map((q) => at(q.x, q.y)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, scale, low],
  );
  const { pos, vel } = throwState(params, tau);
  const body = at(pos.x, pos.y);
  const k = 3 / Math.max(params.v0, 1); // scene units per m/s for velocity arrows
  const rad = (params.angle * Math.PI) / 180;
  const seg = low ? 12 : 32;
  return (
    <>
      {params.h0 > 0 ? (
        <mesh
          position={[X0 - 0.4, (params.h0 * scale) / 2, 0]}
          castShadow={!low}
          receiveShadow={!low}
        >
          <boxGeometry args={[0.8, params.h0 * scale, 1.6]} />
          <meshStandardMaterial color={tk.surface} />
        </mesh>
      ) : null}
      {/* Launcher: a tube along the launch angle. */}
      <group position={at(0, params.h0)} rotation={[0, 0, rad - Math.PI / 2]}>
        <mesh position={[0, 0.5, 0]} castShadow={!low}>
          <cylinderGeometry args={[0.16, 0.2, 1, seg]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
      </group>
      <Polyline3D points={points} color={tk.accent} dashed />
      <mesh position={body} castShadow={!low}>
        <sphereGeometry args={[0.25, seg, seg]} />
        <meshStandardMaterial color={tk.accent} />
      </mesh>
      <Arrow3D from={body} to={[body[0] + vel.vx * k, body[1], 0]} color={tk.info} />
      <Arrow3D from={body} to={[body[0], body[1] + vel.vy * k, 0]} color={tk.success} />
      <Arrow3D from={body} to={[body[0] + vel.vx * k, body[1] + vel.vy * k, 0]} color={tk.accent} />
      <Label3D
        position={[body[0] + vel.vx * k + 0.3, body[1] + vel.vy * k + 0.3, 0]}
        className="font-semibold text-accent"
        text={vectorLabels.v}
      />
      <Label3D
        position={[body[0] + vel.vx * k + 0.3, body[1] - 0.25, 0]}
        className="text-info"
        text={vectorLabels.vx}
      />
      <Label3D
        position={[body[0] - 0.3, body[1] + vel.vy * k, 0]}
        className="text-success"
        text={vectorLabels.vy}
      />
      {/* Range and the highest point. */}
      <mesh position={at(r.L, 0)} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.25, 0.4, seg]} />
        <meshBasicMaterial color={tk.accent} />
      </mesh>
      <Label3D position={[at(r.L, 0)[0], -0.5, 0.6]} text={`L = ${format(r.L)} ${unit}`} />
      <Label3D
        position={[at(0, 0)[0] + (r.L * scale) / 2, r.H * scale + 0.6, 0]}
        text={`H = ${format(r.H)} ${unit}`}
      />
    </>
  );
}

/** 3D scene of the throw. Positions come from the model; this file only draws. */
export default function ProjectileScene3D(props: {
  params: ProjectileParams;
  tau: number;
  quality: 'high' | 'low';
  label: string;
  resetLabel: string;
  format: (n: number) => string;
  unit: string;
  vectorLabels: { v: string; vx: string; vy: string };
  onFps: (fps: number) => void;
  onContextLost: () => void;
}) {
  const { top, right } = throwFrame(props.params);
  // Fit the throw into ~11 scene units, whatever its size in metres.
  const scale = 11 / Math.max(right, top, 2);
  const cx = -5 + (right * scale) / 2;
  const cy = (top * scale) / 2;
  return (
    <GameScene3D
      quality={props.quality}
      label={props.label}
      resetLabel={props.resetLabel}
      camera={[cx - 2, cy + 2.5, 11.5]}
      target={[cx, cy, 0]}
      fitWidth={Math.max(right * scale, top * scale) + 2}
      onFps={props.onFps}
      onContextLost={props.onContextLost}
    >
      <Throw
        params={props.params}
        tau={props.tau}
        scale={scale}
        low={props.quality === 'low'}
        format={props.format}
        unit={props.unit}
        vectorLabels={props.vectorLabels}
      />
    </GameScene3D>
  );
}
