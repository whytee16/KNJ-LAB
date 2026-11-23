'use client';

import type { SpringParams } from '@knj/physics';
import { Arrow3D, GameScene3D, Label3D, Polyline3D, Spring3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from './lab-frame-3d';

const WALL = -5;
const EQ = 0; // equilibrium of the block centre
const PER_M = 10; // scene units per metre of displacement
const BLOCK = 1.2;

function Oscillator({
  params,
  x,
  v,
  F,
  labels,
  low,
}: {
  params: SpringParams;
  x: number;
  v: number;
  F: number;
  labels: { v: string; F: string; eq: string };
  low: boolean;
}) {
  const tk = useTokens();
  const bx = EQ + x * PER_M;
  const y = BLOCK / 2;
  const vMax = Math.sqrt(params.k / params.m) * params.A || 1;
  const Fmax = params.k * params.A || 1;
  const vTip: [number, number, number] = [bx + 2 * (v / vMax), y + 0.9, 0];
  const fTip: [number, number, number] = [bx + 2 * (F / Fmax), y - 0.1, 0.8];
  return (
    <>
      <mesh position={[WALL - 0.2, 1.5, 0]}>
        <boxGeometry args={[0.4, 3, 2.4]} />
        <meshStandardMaterial color={tk.surface} />
      </mesh>
      <Spring3D
        from={[WALL, y, 0]}
        length={bx - BLOCK / 2 - WALL}
        coils={9}
        radius={0.3}
        wire={0.025}
        color={tk.muted}
        segments={low ? 120 : 260}
      />
      <mesh position={[bx, y, 0]} castShadow={!low}>
        <boxGeometry args={[BLOCK, BLOCK, BLOCK]} />
        <meshStandardMaterial color={tk.accent} />
      </mesh>
      <Polyline3D
        points={[
          [EQ, 0.01, -1.4],
          [EQ, 0.01, 1.4],
        ]}
        color={tk.muted}
        dashed
      />
      <Label3D position={[EQ, 0, 1.8]} text={labels.eq} />
      <Arrow3D from={[bx, y + 0.9, 0]} to={vTip} color={tk.success} />
      <Arrow3D from={[bx, y - 0.1, 0.8]} to={fTip} color={tk.info} />
      {Math.abs(v) > 1e-4 ? (
        <Label3D
          position={[vTip[0] + 0.3 * Math.sign(v), vTip[1] + 0.25, 0]}
          text={labels.v}
          className="font-semibold text-success"
        />
      ) : null}
      {Math.abs(F) > 1e-4 ? (
        <Label3D
          position={[fTip[0] + 0.3 * Math.sign(F), fTip[1], fTip[2]]}
          text={labels.F}
          className="font-semibold text-info"
        />
      ) : null}
    </>
  );
}

export default function SpringScene3D({
  params,
  x,
  v,
  F,
  label,
  resetLabel,
  labels,
  ...h
}: Scene3DHandlers & {
  params: SpringParams;
  x: number;
  v: number;
  F: number;
  label: string;
  resetLabel: string;
  labels: { v: string; F: string; eq: string };
}) {
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[-1, 4, 10]}
      target={[-1, 0.8, 0]}
      fitWidth={11}
      room={{ width: 18, depth: 9, height: 7, center: [0, -2], board: true }}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Oscillator params={params} x={x} v={v} F={F} labels={labels} low={h.quality === 'low'} />
    </GameScene3D>
  );
}
