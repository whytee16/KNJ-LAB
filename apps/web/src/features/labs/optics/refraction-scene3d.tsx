'use client';

import { mediaOf, refractionGeometry, type RefractionParams } from '@knj/physics';
import { GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from '../lab-frame-3d';
import { Beam3D, Desk, DESK, type V3 } from './three';

const K = 0.12; // scene units per centimetre
const Y0 = 3.8; // the boundary: the top of the water or the glass block

const at = (p: { x: number; y: number }): V3 => [p.x * K, Y0 + p.y * K, 0];

function Tank({
  params,
  labels,
}: {
  params: RefractionParams;
  labels: { tir: string; medium1: string; medium2: string };
}) {
  const tk = useTokens();
  const g = refractionGeometry(params);
  const { pair } = mediaOf(params);
  const dense = pair.from === 'air' ? pair.to : pair.from;
  const fill = dense === 'water' ? tk.info : dense === 'diamond' ? tk.bg : tk.surface;
  const opacity = dense === 'water' ? 0.28 : dense === 'diamond' ? 0.55 : 0.4;
  const O = { x: 0, y: 0 };
  return (
    <>
      <Desk width={14} depth={8} />
      {/* The denser medium fills the box below the boundary: a tank of water or a block. */}
      <mesh position={[0, Y0 / 2, 0]}>
        <boxGeometry args={[9, Y0, 3]} />
        <meshStandardMaterial color={fill} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {dense === 'water'
        ? [-4.5, 4.5].map((x) => (
            <mesh key={x} position={[x, Y0 / 2 + 0.2, 0]}>
              <boxGeometry args={[0.05, Y0 + 0.4, 3]} />
              <meshStandardMaterial color={tk.muted} transparent opacity={0.35} />
            </mesh>
          ))
        : null}
      {/* Protractor on the back wall of the tank. */}
      <mesh position={[0, Y0, -1.45]}>
        <ringGeometry args={[3.3, 3.42, 96]} />
        <meshBasicMaterial color={tk.muted} />
      </mesh>
      <Polyline3D
        points={[
          [0, Y0 - 3.8, 0],
          [0, Y0 + 3.8, 0],
        ]}
        color={tk.muted}
        dashed
      />
      <Beam3D from={at(g.source)} to={at(O)} color={tk.danger} />
      <Beam3D
        from={at(O)}
        to={at(g.reflected)}
        color={tk.danger}
        radius={g.refracted ? 0.02 : 0.035}
        opacity={g.refracted ? 0.45 : 1}
      />
      {g.refracted ? <Beam3D from={at(O)} to={at(g.refracted)} color={tk.danger} /> : null}
      <mesh position={at(g.source)}>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshStandardMaterial color={tk.text} />
      </mesh>
      <Label3D
        position={[at(g.source)[0] * 0.45 - 0.3, Y0 + (g.source.y > 0 ? 1.2 : -1.2), 0]}
        text="α"
        className="font-semibold text-danger"
      />
      {g.refracted ? (
        <Label3D
          position={[at(g.refracted)[0] * 0.45 + 0.3, Y0 + (g.refracted.y > 0 ? 1.2 : -1.2), 0]}
          text="γ"
          className="font-semibold text-danger"
        />
      ) : (
        <Label3D
          position={[2.2, Y0 + (g.source.y > 0 ? 1.6 : -1.6), 0.4]}
          text={labels.tir}
          className="font-semibold"
        />
      )}
      <Label3D position={[-4, Y0 + (g.side > 0 ? 3 : -3), 1.5]} text={labels.medium1} />
      <Label3D position={[3.6, Y0 + (g.side > 0 ? -3 : 3), 1.5]} text={labels.medium2} />
    </>
  );
}

export default function RefractionScene3D({
  params,
  labels,
  label,
  resetLabel,
  ...h
}: Scene3DHandlers & {
  params: RefractionParams;
  labels: { tir: string; medium1: string; medium2: string };
  label: string;
  resetLabel: string;
}) {
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[1.5, Y0 + 2.5, 11]}
      target={[0, Y0 - 0.3, 0]}
      fitWidth={11}
      fitHeight={9}
      room={{ width: 22, depth: 16, height: 10, center: [0, -3], floorY: -DESK, board: true }}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Tank params={params} labels={labels} />
    </GameScene3D>
  );
}
