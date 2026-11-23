'use client';

import type { ForceVec, Layout, Values } from '@knj/physics';
import { Arrow3D, GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from '../lab-frame-3d';
import { forceArrows, FORCE_TONE } from './forces';
import { frameFor, type Box } from './layout';

type V3 = [number, number, number];
const v = (p: { x: number; y: number }, z = 0): V3 => [p.x, p.y, z];

function Block({ b, color, depth = 0.8 }: { b: Box; color: string; depth?: number }) {
  return (
    <mesh position={[b.x, b.y, 0]}>
      <boxGeometry args={[b.w, b.h, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Scene({
  layoutName,
  params,
  s,
  forces,
  showForces,
  forceLabel,
  reading,
}: {
  layoutName: Layout;
  params: Values;
  s: number;
  forces: ForceVec[];
  showForces: boolean;
  forceLabel: (f: { kind: ForceVec['kind']; index?: number }) => string;
  reading?: string;
}) {
  const tk = useTokens();
  const frame = frameFor(layoutName, params, s);
  const L = frame.layout;
  const arrows = showForces ? forceArrows(forces, frame.anchors, 2.2) : [];
  return (
    <>
      {L.kind === 'elevator' ? (
        <>
          {/* Shaft rails with moving marks show the motion; the cabin stays in view. */}
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 1.5, -0.9]}>
              <boxGeometry args={[0.08, 7, 0.08]} />
              <meshStandardMaterial color={tk.muted} />
            </mesh>
          ))}
          {Array.from({ length: 8 }, (_, i) => -2 + i - L.railOffset).map((y) => (
            <mesh key={y} position={[1.6, y, -0.85]}>
              <boxGeometry args={[0.3, 0.05, 0.05]} />
              <meshStandardMaterial color={tk.text} />
            </mesh>
          ))}
          <mesh position={[0, L.cabin.y - L.cabin.h / 2, 0]}>
            <boxGeometry args={[L.cabin.w, 0.1, 2]} />
            <meshStandardMaterial color={tk.surface} />
          </mesh>
          <mesh position={[0, L.cabin.y + L.cabin.h / 2, 0]}>
            <boxGeometry args={[L.cabin.w, 0.1, 2]} />
            <meshStandardMaterial color={tk.surface} />
          </mesh>
          <mesh position={[0, L.cabin.y, -1]}>
            <boxGeometry args={[L.cabin.w, L.cabin.h, 0.05]} />
            <meshStandardMaterial color={tk.surface} transparent opacity={0.5} />
          </mesh>
          <Polyline3D
            points={[
              [0, L.cabin.y + L.cabin.h / 2, 0],
              [0, 6, 0],
            ]}
            color={tk.text}
          />
          <Block b={{ ...L.scale, y: L.cabin.y - L.cabin.h / 2 + 0.13 }} color={tk.text} />
          {/* Person: legs and body (capsules) and head. */}
          <mesh position={[0, L.cabin.y - L.cabin.h / 2 + 1.0, 0]}>
            <capsuleGeometry args={[0.22, 1.0, 6, 12]} />
            <meshStandardMaterial color={tk.info} />
          </mesh>
          <mesh position={[0, L.cabin.y - L.cabin.h / 2 + 1.85, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={tk.accent} />
          </mesh>
          {reading ? (
            <Label3D
              position={[0.9, L.cabin.y - L.cabin.h / 2 + 0.4, 0.4]}
              text={reading}
              className="font-semibold"
            />
          ) : null}
        </>
      ) : null}
      {L.kind === 'lamp' ? (
        <>
          {[L.left, L.right].map((a, i) => (
            <mesh key={i} position={[a.x, (a.y - 2.2) / 2, 0]}>
              <boxGeometry args={[0.15, a.y + 2.2, 0.15]} />
              <meshStandardMaterial color={tk.muted} />
            </mesh>
          ))}
          <Polyline3D points={[v(L.left), v(L.node)]} color={tk.text} />
          <Polyline3D points={[v(L.right), v(L.node)]} color={tk.text} />
          <Polyline3D points={[v(L.node), v(L.lamp)]} color={tk.text} />
          <mesh position={[L.lamp.x, L.lamp.y - 0.15, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.45, 0.4, 24, 1, true]} />
            <meshStandardMaterial color={tk.accent} side={2} />
          </mesh>
          <mesh position={[L.lamp.x, L.lamp.y - 0.3, 0]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshBasicMaterial color={tk.bg} />
          </mesh>
        </>
      ) : null}
      {L.kind === 'table-pulley' ? (
        <>
          <mesh position={[(L.table.x0 + L.table.x1) / 2, L.table.y - 0.05, 0]}>
            <boxGeometry args={[L.table.x1 - L.table.x0, 0.1, 1.6]} />
            <meshStandardMaterial color={tk.surface} />
          </mesh>
          {[L.table.x0 + 0.2, L.table.x1 - 0.2].map((x) => (
            <mesh key={x} position={[x, -1.25, 0]}>
              <boxGeometry args={[0.12, 2.4, 0.12]} />
              <meshStandardMaterial color={tk.muted} />
            </mesh>
          ))}
          <mesh position={[L.pulley.x, L.pulley.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[L.pulley.r, L.pulley.r, 0.12, 24]} />
            <meshStandardMaterial color={tk.text} />
          </mesh>
          <Polyline3D
            points={[
              [L.block.x + L.block.w / 2, L.block.y, 0],
              [L.pulley.x, L.pulley.y + L.pulley.r, 0],
              [L.pulley.x + L.pulley.r, L.pulley.y, 0],
              [L.hang.x, L.hang.y + L.hang.h / 2, 0],
            ]}
            color={tk.text}
          />
          <Block b={L.block} color={tk.accent} />
          <Block b={L.hang} color={tk.info} depth={0.5} />
        </>
      ) : null}
      {L.kind === 'atwood' ? (
        <>
          <mesh position={[0, L.ceiling, 0]}>
            <boxGeometry args={[3, 0.15, 1.2]} />
            <meshStandardMaterial color={tk.muted} />
          </mesh>
          <Polyline3D
            points={[
              [0, L.ceiling, 0],
              [0, L.pulley.y, 0],
            ]}
            color={tk.text}
          />
          <mesh position={[L.pulley.x, L.pulley.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[L.pulley.r, L.pulley.r, 0.15, 32]} />
            <meshStandardMaterial color={tk.text} />
          </mesh>
          <Polyline3D
            points={[
              [-L.pulley.r, L.pulley.y, 0],
              [L.left.x, L.left.y + L.left.h / 2, 0],
            ]}
            color={tk.text}
          />
          <Polyline3D
            points={[
              [L.pulley.r, L.pulley.y, 0],
              [L.right.x, L.right.y + L.right.h / 2, 0],
            ]}
            color={tk.text}
          />
          <Block b={L.left} color={tk.accent} depth={L.left.w} />
          <Block b={L.right} color={tk.info} depth={L.right.w} />
        </>
      ) : null}
      {arrows.map((a) => (
        <group key={a.key}>
          <Arrow3D from={v(a.from, 0.6)} to={v(a.to, 0.6)} color={tk[FORCE_TONE[a.kind]]} />
          <Label3D
            position={[
              a.to.x + 0.25 * Math.sign(a.to.x - a.from.x || 1),
              a.to.y + 0.2 * Math.sign(a.to.y - a.from.y || 1),
              0.6,
            ]}
            text={forceLabel(a)}
            className="font-semibold"
          />
        </group>
      ))}
    </>
  );
}

export default function ScenarioScene3D({
  layout,
  params,
  s,
  forces,
  showForces,
  forceLabel,
  reading,
  label,
  resetLabel,
  ...h
}: Scene3DHandlers & {
  layout: Layout;
  params: Values;
  s: number;
  forces: ForceVec[];
  showForces: boolean;
  forceLabel: (f: { kind: ForceVec['kind']; index?: number }) => string;
  reading?: string;
  label: string;
  resetLabel: string;
}) {
  const frame = frameFor(layout, params, 0);
  const c = frame.center;
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[c.x + 1.5, c.y + 2.5, 10]}
      target={[c.x, c.y, 0]}
      fitWidth={frame.width}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Scene
        layoutName={layout}
        params={params}
        s={s}
        forces={forces}
        showForces={showForces}
        forceLabel={forceLabel}
        reading={reading}
      />
    </GameScene3D>
  );
}
