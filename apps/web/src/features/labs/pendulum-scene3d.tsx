'use client';

import type { PendulumParams, PendulumState } from '@knj/physics';
import { Arrow3D, GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import { useMemo } from 'react';
import type { Scene3DHandlers } from './lab-frame-3d';

type V3 = [number, number, number];
const L = 5; // scene units for the string (the numbers show the real length)
const TOP = 6.5;

function Pendulum({
  params,
  state,
  vLabel,
  low,
}: {
  params: PendulumParams;
  state: PendulumState;
  vLabel: string;
  low: boolean;
}) {
  const tk = useTokens();
  const th0 = (params.theta0 * Math.PI) / 180;
  const arc = useMemo(
    () =>
      Array.from({ length: 41 }, (_, i) => {
        const a = -th0 + (2 * th0 * i) / 40;
        return [L * Math.sin(a), TOP - L * Math.cos(a), 0] as V3;
      }),
    [th0],
  );
  const bob: V3 = [L * Math.sin(state.theta), TOP - L * Math.cos(state.theta), 0];
  // Velocity is tangent to the arc; length proportional to the speed (max ≈ 2 units).
  const vMax = Math.sqrt(2 * (1 - Math.cos(th0))) || 1;
  const k = (2 / vMax) * (state.omega / Math.sqrt(params.g / params.l));
  const vTip: V3 = [bob[0] + k * Math.cos(state.theta), bob[1] + k * Math.sin(state.theta), 0];
  const seg = low ? 12 : 32;
  return (
    <>
      <mesh position={[0, TOP + 0.15, 0]}>
        <boxGeometry args={[3, 0.3, 1]} />
        <meshStandardMaterial color={tk.text} />
      </mesh>
      <mesh position={[1.3, TOP / 2, 0]}>
        <boxGeometry args={[0.2, TOP, 0.2]} />
        <meshStandardMaterial color={tk.muted} />
      </mesh>
      <Polyline3D points={[[0, TOP, 0], bob]} color={tk.text} />
      <Polyline3D points={arc} color={tk.accent} dashed />
      <Polyline3D
        points={[
          [0, TOP, 0],
          [0, TOP - L - 0.4, 0],
        ]}
        color={tk.border}
        dashed
      />
      <mesh position={bob} castShadow={!low}>
        <sphereGeometry args={[0.25 + 0.2 * Math.cbrt(params.m), seg, seg]} />
        <meshStandardMaterial color={tk.accent} />
      </mesh>
      <Arrow3D from={bob} to={vTip} color={tk.success} />
      {Math.abs(state.omega) > 1e-3 ? (
        <Label3D
          position={[vTip[0] + 0.25, vTip[1] + 0.25, 0]}
          text={vLabel}
          className="font-semibold text-success"
        />
      ) : null}
    </>
  );
}

export default function PendulumScene3D({
  params,
  state,
  label,
  resetLabel,
  vLabel,
  ...h
}: Scene3DHandlers & {
  params: PendulumParams;
  state: PendulumState;
  label: string;
  resetLabel: string;
  vLabel: string;
}) {
  const span = 2 * L * Math.sin((Math.max(params.theta0, 20) * Math.PI) / 180) + 2;
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[1.5, 4.5, 11]}
      target={[0, 3.6, 0]}
      fitWidth={span}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Pendulum params={params} state={state} vLabel={vLabel} low={h.quality === 'low'} />
    </GameScene3D>
  );
}
