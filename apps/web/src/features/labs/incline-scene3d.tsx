'use client';

import type { InclinedPlaneParams } from '@knj/physics';
import { Arrow3D, GameScene3D, Label3D, Polyline3D, useTokens, Wedge3D } from '@knj/ui/game3d';
import { inclineFrame } from './incline-geometry';
import type { ForceLabels } from './incline-side2d';

type V3 = [number, number, number];

function Slope({
  params,
  tau,
  scale,
  low,
  angleLabel,
  forceLabels,
  decompose,
}: {
  params: InclinedPlaneParams;
  tau: number;
  scale: number;
  low: boolean;
  angleLabel: string;
  forceLabels: ForceLabels;
  decompose: boolean;
}) {
  const tk = useTokens();
  const f = inclineFrame(params, tau);
  const X0 = -(f.b * scale) / 2;
  const at = (x: number, y: number, z = 0): V3 => [X0 + x * scale, y * scale, z];
  const depth = 2;
  const size = 0.6;
  const c = f.at(f.s);
  const centre: V3 = [
    X0 + c.x * scale + (f.normal.x * size) / 2,
    c.y * scale + (f.normal.y * size) / 2,
    0,
  ];
  const k = 3 / Math.max(f.r.Fg, 1e-9); // scene units per newton
  const tip = (dx: number, dy: number): V3 => [centre[0] + dx * k, centre[1] + dy * k, 0];
  const mg = tip(0, -f.r.Fg);
  const N = tip(f.normal.x * f.r.N, f.normal.y * f.r.N);
  const Ffr = tip(f.up.x * f.r.Ffr, f.up.y * f.r.Ffr);
  const ma = tip(f.down.x * params.m * f.r.a, f.down.y * params.m * f.r.a);
  const label = (p: V3, dx: number, dy: number): V3 => [p[0] + dx, p[1] + dy, 0];
  const par = tip(f.down.x * f.r.Fpar, f.down.y * f.r.Fpar);
  const perp = tip(-f.normal.x * f.r.Fperp, -f.normal.y * f.r.Fperp);
  const axis = (d: { x: number; y: number }, a: number, b: number): V3[] => [
    [centre[0] + d.x * a, centre[1] + d.y * a, 0],
    [centre[0] + d.x * b, centre[1] + d.y * b, 0],
  ];
  return (
    <>
      <Wedge3D
        base={f.b * scale}
        height={f.h * scale}
        depth={depth}
        color={tk.surface}
        position={[X0, 0, 0]}
        shadows={!low}
      />
      <mesh position={centre} rotation={[0, 0, (-params.angle * Math.PI) / 180]} castShadow={!low}>
        <boxGeometry args={[size, size, size * 1.4]} />
        <meshStandardMaterial color={tk.accent} />
      </mesh>
      {decompose ? (
        <>
          <Polyline3D points={axis(f.down, -3.5, 3.5)} color={tk.border} dashed />
          <Polyline3D points={axis(f.normal, -3.2, 1.5)} color={tk.border} dashed />
          <Polyline3D points={[par, mg, perp]} color={tk.muted} dashed />
          <Arrow3D from={centre} to={par} color={tk.muted} radius={0.03} />
          <Arrow3D from={centre} to={perp} color={tk.muted} radius={0.03} />
          <Label3D position={label(par, -0.2, -0.35)} text={forceLabels.mgSin} />
          <Label3D position={label(perp, 0.5, -0.1)} text={forceLabels.mgCos} />
        </>
      ) : null}
      <Arrow3D from={centre} to={mg} color={tk.text} />
      <Arrow3D from={centre} to={N} color={tk.info} />
      <Arrow3D from={centre} to={Ffr} color={tk.danger} />
      {f.r.moves ? <Arrow3D from={centre} to={ma} color={tk.success} /> : null}
      <Label3D position={label(mg, 0.3, -0.2)} text={forceLabels.mg} className="font-semibold" />
      <Label3D
        position={label(N, 0.2, 0.25)}
        text={forceLabels.N}
        className="font-semibold text-info"
      />
      {f.r.Ffr > 1e-9 ? (
        <Label3D
          position={label(Ffr, -0.3, 0.2)}
          text={forceLabels.Ffr}
          className="font-semibold text-danger"
        />
      ) : null}
      {f.r.moves ? (
        <Label3D
          position={label(ma, 0.3, -0.25)}
          text={forceLabels.ma}
          className="font-semibold text-success"
        />
      ) : null}
      {params.angle > 0 ? (
        <Label3D
          position={
            at(f.b, 0, depth / 2 + 0.3).map((v, i) => (i === 0 ? v - 1 : i === 1 ? 0.35 : v)) as V3
          }
          text={angleLabel}
        />
      ) : null}
    </>
  );
}

/** 3D scene of the block on the inclined plane with force vectors. Drawing only. */
export default function InclineScene3D(props: {
  params: InclinedPlaneParams;
  tau: number;
  quality: 'high' | 'low';
  label: string;
  resetLabel: string;
  angleLabel: string;
  forceLabels: ForceLabels;
  decompose: boolean;
  onFps: (fps: number) => void;
  onContextLost: () => void;
}) {
  const f = inclineFrame(props.params, 0);
  const scale = 8 / Math.max(f.b, f.h, 1);
  const cy = (f.h * scale) / 2;
  return (
    <GameScene3D
      quality={props.quality}
      label={props.label}
      resetLabel={props.resetLabel}
      camera={[-2, cy + 3.5, 11]}
      target={[0, cy, 0]}
      fitWidth={f.b * scale + 4}
      room={{ width: 20, depth: 10, height: 9, center: [0, -2.5], board: true }}
      onFps={props.onFps}
      onContextLost={props.onContextLost}
    >
      <Slope
        params={props.params}
        tau={props.tau}
        scale={scale}
        low={props.quality === 'low'}
        angleLabel={props.angleLabel}
        forceLabels={props.forceLabels}
        decompose={props.decompose}
      />
    </GameScene3D>
  );
}
