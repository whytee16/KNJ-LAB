'use client';

import type { ForceVec, Layout, Values } from '@knj/physics';
import { Arrow3D, GameScene3D, Label3D, Polyline3D, useTokens } from '@knj/ui/game3d';
import type { Scene3DHandlers } from '../lab-frame-3d';
import { forceArrows, FORCE_TONE } from './forces';
import { frameFor, LINK, type Box, type FrameMotion, type XY } from './layout';

type V3 = [number, number, number];
const v3 = (p: XY, z = 0): V3 => [p.x, p.y, z];

/** Texts drawn in the scene: spring extension, lift motion and floor. */
export interface ScenarioSceneLabels {
  extension?: string;
  motion?: string;
  floor?: string;
  v?: string;
  a?: string;
}

/** A load of the chosen kind (weight, block, bucket, phone, car, box) filling the box b. */
function Load({
  b,
  kind,
  color,
  depth = 0.8,
}: {
  b: Box;
  kind: string;
  color: string;
  depth?: number;
}) {
  const tk = useTokens();
  if (kind === 'weight')
    return (
      <group position={[b.x, b.y, 0]}>
        <mesh position={[0, -b.h * 0.1, 0]}>
          <cylinderGeometry args={[b.w * 0.42, b.w * 0.5, b.h * 0.8, 24]} />
          <meshStandardMaterial color={tk.text} metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[0, b.h * 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[b.w * 0.15, b.w * 0.04, 8, 16]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
      </group>
    );
  if (kind === 'bucket')
    return (
      <group position={[b.x, b.y, 0]}>
        <mesh>
          <cylinderGeometry args={[b.w * 0.5, b.w * 0.38, b.h, 24, 1, true]} />
          <meshStandardMaterial color={color} side={2} />
        </mesh>
        <mesh position={[0, -b.h / 2 + 0.01, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[b.w * 0.38, 24]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, b.h * 0.5, 0]}>
          <torusGeometry args={[b.w * 0.5, 0.02, 6, 24, Math.PI]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
      </group>
    );
  if (kind === 'phone')
    return (
      <group position={[b.x, b.y - b.h / 2 + 0.06, 0]}>
        <mesh>
          <boxGeometry args={[b.w * 0.6, 0.1, Math.min(depth, 0.9)]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
        <mesh position={[0, 0.051, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[b.w * 0.5, Math.min(depth, 0.9) * 0.85]} />
          <meshBasicMaterial color={tk.info} />
        </mesh>
      </group>
    );
  if (kind === 'car')
    return (
      <group position={[b.x, b.y - b.h / 2, 0]}>
        <mesh position={[0, b.h * 0.35, 0]}>
          <boxGeometry args={[b.w * 1.1, b.h * 0.4, depth * 0.8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[-b.w * 0.1, b.h * 0.7, 0]}>
          <boxGeometry args={[b.w * 0.55, b.h * 0.3, depth * 0.7]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}${sz}`}
              position={[sx * b.w * 0.35, b.h * 0.14, sz * depth * 0.4]}
              rotation-x={Math.PI / 2}
            >
              <cylinderGeometry args={[b.h * 0.15, b.h * 0.15, 0.08, 16]} />
              <meshStandardMaterial color={tk.text} />
            </mesh>
          )),
        )}
      </group>
    );
  return (
    <mesh position={[b.x, b.y, 0]}>
      <boxGeometry args={[b.w, b.h, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Rope, chain or spring between two points. */
function Link({ from, to, link, color }: { from: V3; to: V3; link: number; color: string }) {
  if (link === LINK.chain) {
    const n = Math.max(2, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.14));
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const angle = Math.atan2(dy, dx);
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <mesh
            key={i}
            position={[from[0] + (dx * (i + 0.5)) / n, from[1] + (dy * (i + 0.5)) / n, 0]}
            rotation={[i % 2 ? Math.PI / 2 : 0, 0, angle]}
          >
            <torusGeometry args={[0.07, 0.018, 6, 12]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
      </>
    );
  }
  if (link === LINK.spring) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const turns = Math.max(6, Math.round(len / 0.12));
    const pts: V3[] = Array.from({ length: turns * 8 + 1 }, (_, i) => {
      const t = i / (turns * 8);
      const a = t * turns * 2 * Math.PI;
      const r = t < 0.06 || t > 0.94 ? 0 : 0.12;
      return [
        from[0] + dx * t + nx * r * Math.sin(a),
        from[1] + dy * t + ny * r * Math.sin(a),
        r * Math.cos(a),
      ];
    });
    return <Polyline3D points={pts} color={color} />;
  }
  return <Polyline3D points={[from, to]} color={color} />;
}

const TABLE_LOOKS = ['block', 'car', 'phone'];
const HANG_LOOKS = ['weight', 'bucket', 'phone'];
const ATWOOD_LOOKS = ['weight', 'box', 'bucket'];

function Scene({
  layoutName,
  params,
  s,
  motion,
  forces,
  showForces,
  forceLabel,
  reading,
  labels,
}: {
  layoutName: Layout;
  params: Values;
  s: number;
  motion: FrameMotion;
  forces: ForceVec[];
  showForces: boolean;
  forceLabel: (f: { kind: ForceVec['kind']; index?: number }) => string;
  reading?: string;
  labels: ScenarioSceneLabels;
}) {
  const tk = useTokens();
  const frame = frameFor(layoutName, params, s, motion);
  const L = frame.layout;
  const link = params.link ?? LINK.rope;
  const arrows = showForces && !motion.broken ? forceArrows(forces, frame.anchors, 2.2) : [];
  return (
    <>
      {L.kind === 'elevator' ? (
        <>
          {/* Shaft: back wall, rails and floor marks that move past the cabin. */}
          <mesh position={[0.6, 1.5, -1.3]}>
            <planeGeometry args={[7, 9]} />
            <meshStandardMaterial color={tk.surface} />
          </mesh>
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 1.5, -0.9]}>
              <boxGeometry args={[0.08, 9, 0.08]} />
              <meshStandardMaterial color={tk.muted} />
            </mesh>
          ))}
          {Array.from({ length: 10 }, (_, i) => -3 + i - L.railOffset).map((y) => (
            <mesh key={y} position={[1.6, y, -0.85]}>
              <boxGeometry args={[0.3, 0.05, 0.05]} />
              <meshStandardMaterial color={tk.text} />
            </mesh>
          ))}
          {/* Floor slabs of the building every 3 m pass by as the lift moves. */}
          {[-2, -1, 0, 1, 2].map((i) => {
            const y = L.cabin.y - L.cabin.h / 2 + 3 * i - (((L.h % 3) + 3) % 3);
            return (
              <mesh key={i} position={[0.6, y, -1.2]}>
                <boxGeometry args={[7, 0.25, 0.2]} />
                <meshStandardMaterial color={tk.border} />
              </mesh>
            );
          })}
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
              [0, 6.5, 0],
            ]}
            color={tk.text}
          />
          <Load
            b={{ ...L.scale, y: L.cabin.y - L.cabin.h / 2 + 0.13 }}
            kind="block"
            color={tk.text}
          />
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
          {/* Velocity and acceleration of the lift beside the cabin: direction at a glance. */}
          {Math.abs(L.v) > 0.05 ? (
            <>
              <Arrow3D
                from={[2.3, L.cabin.y, 0.6]}
                to={[
                  2.3,
                  L.cabin.y + Math.sign(L.v) * Math.min(2.2, 0.6 + Math.abs(L.v) * 0.4),
                  0.6,
                ]}
                color={tk.success}
                radius={0.07}
              />
              <Label3D
                position={[
                  2.6,
                  L.cabin.y + Math.sign(L.v) * (Math.min(2.2, 0.6 + Math.abs(L.v) * 0.4) + 0.25),
                  0.6,
                ]}
                text={labels.v ?? 'v'}
                className="font-semibold text-success"
              />
            </>
          ) : null}
          {Math.abs(L.a) > 0.05 ? (
            <>
              <Arrow3D
                from={[3.3, L.cabin.y, 0.6]}
                to={[
                  3.3,
                  L.cabin.y + Math.sign(L.a) * Math.min(2.2, 0.6 + Math.abs(L.a) * 0.15),
                  0.6,
                ]}
                color={tk.accent}
                radius={0.05}
              />
              <Label3D
                position={[
                  3.6,
                  L.cabin.y + Math.sign(L.a) * (Math.min(2.2, 0.6 + Math.abs(L.a) * 0.15) + 0.25),
                  0.6,
                ]}
                text={labels.a ?? 'a'}
                className="font-semibold text-accent"
              />
            </>
          ) : null}
          {labels.floor ? (
            <Label3D
              position={[-1.9, L.cabin.y + L.cabin.h / 2 - 0.2, 0.8]}
              text={labels.floor}
              className="font-semibold"
            />
          ) : null}
          {labels.motion ? (
            <Label3D
              position={[0.6, L.cabin.y - L.cabin.h / 2 - 0.6, 0.8]}
              text={labels.motion}
              className="font-semibold"
            />
          ) : null}
        </>
      ) : null}
      {L.kind === 'lamp' ? (
        <>
          {[L.left, L.right].map((a, i) => (
            <mesh key={i} position={[a.x, (a.y + (frame.floor ?? 0)) / 2, 0]}>
              <boxGeometry args={[0.15, a.y - (frame.floor ?? 0), 0.15]} />
              <meshStandardMaterial color={tk.muted} />
            </mesh>
          ))}
          {[L.left, L.right].map((a, i) => (
            <mesh key={`b${i}`} position={[a.x, (frame.floor ?? 0) + 0.05, 0]}>
              <boxGeometry args={[0.6, 0.1, 0.6]} />
              <meshStandardMaterial color={tk.text} />
            </mesh>
          ))}
          <Polyline3D points={[v3(L.left), v3(L.node)]} color={tk.text} />
          <Polyline3D points={[v3(L.right), v3(L.node)]} color={tk.text} />
          <Polyline3D points={[v3(L.node), v3(L.lamp)]} color={tk.text} />
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
            <mesh key={x} position={[x, ((frame.floor ?? -2.5) - 0.1) / 2, 0]}>
              <boxGeometry args={[0.12, -(frame.floor ?? -2.5) - 0.1, 0.12]} />
              <meshStandardMaterial color={tk.muted} />
            </mesh>
          ))}
          <mesh position={[L.pulley.x, L.pulley.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[L.pulley.r, L.pulley.r, 0.12, 24]} />
            <meshStandardMaterial color={tk.text} />
          </mesh>
          <Link
            from={[L.block.x + L.block.w / 2, L.block.y, 0]}
            to={[L.pulley.x, L.pulley.y + L.pulley.r, 0]}
            link={link === LINK.spring ? LINK.rope : link}
            color={tk.text}
          />
          {L.broken ? (
            <Polyline3D
              points={[
                [L.pulley.x + L.pulley.r, L.pulley.y, 0],
                [L.pulley.x + L.pulley.r, L.pulley.y - 0.4, 0],
              ]}
              color={tk.danger}
            />
          ) : (
            <Link
              from={[L.pulley.x + L.pulley.r, L.pulley.y, 0]}
              to={[L.hang.x, L.hang.y + L.hang.h / 2, 0]}
              link={link}
              color={tk.text}
            />
          )}
          {labels.extension ? (
            <Label3D
              position={[L.hang.x + 0.7, (L.pulley.y + L.hang.y) / 2, 0]}
              text={labels.extension}
              className="font-semibold"
            />
          ) : null}
          <Load b={L.block} kind={TABLE_LOOKS[params.look1 ?? 0] ?? 'block'} color={tk.accent} />
          <Load
            b={L.hang}
            kind={HANG_LOOKS[params.look2 ?? 0] ?? 'weight'}
            color={tk.info}
            depth={0.5}
          />
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
          {L.broken ? (
            <>
              <Polyline3D
                points={[
                  [-L.pulley.r, L.pulley.y, 0],
                  [-L.pulley.r, L.pulley.y - 0.4, 0],
                ]}
                color={tk.danger}
              />
              <Polyline3D
                points={[
                  [L.pulley.r, L.pulley.y, 0],
                  [L.pulley.r, L.pulley.y - 0.4, 0],
                ]}
                color={tk.danger}
              />
            </>
          ) : (
            <>
              <Link
                from={[-L.pulley.r, L.pulley.y, 0]}
                to={[L.left.x, L.left.y + L.left.h / 2, 0]}
                link={link === LINK.spring ? LINK.rope : link}
                color={tk.text}
              />
              <Link
                from={[L.pulley.r, L.pulley.y, 0]}
                to={[L.right.x, L.right.y + L.right.h / 2, 0]}
                link={link}
                color={tk.text}
              />
            </>
          )}
          {labels.extension ? (
            <Label3D
              position={[L.right.x + 0.9, (L.pulley.y + L.right.y) / 2, 0]}
              text={labels.extension}
              className="font-semibold"
            />
          ) : null}
          <Load
            b={L.left}
            kind={ATWOOD_LOOKS[params.look1 ?? 0] ?? 'weight'}
            color={tk.accent}
            depth={L.left.w}
          />
          <Load
            b={L.right}
            kind={ATWOOD_LOOKS[params.look2 ?? 0] ?? 'weight'}
            color={tk.info}
            depth={L.right.w}
          />
        </>
      ) : null}
      {arrows.map((a) => (
        <group key={a.key}>
          <Arrow3D from={v3(a.from, 0.6)} to={v3(a.to, 0.6)} color={tk[FORCE_TONE[a.kind]]} />
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
  motion,
  forces,
  showForces,
  forceLabel,
  reading,
  labels,
  label,
  resetLabel,
  ...h
}: Scene3DHandlers & {
  layout: Layout;
  params: Values;
  s: number;
  motion: FrameMotion;
  forces: ForceVec[];
  showForces: boolean;
  forceLabel: (f: { kind: ForceVec['kind']; index?: number }) => string;
  reading?: string;
  labels: ScenarioSceneLabels;
  label: string;
  resetLabel: string;
}) {
  const frame = frameFor(layout, params, 0, { broken: motion.broken });
  const c = frame.center;
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[c.x + 1.5, c.y + 2.5, 10]}
      target={[c.x, c.y, 0]}
      fitWidth={frame.width}
      fitHeight={frame.height}
      room={
        frame.room && frame.floor !== null
          ? { ...frame.room, center: [c.x, -2], floorY: frame.floor, board: true }
          : undefined
      }
      ground={frame.floor !== null}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Scene
        layoutName={layout}
        params={params}
        s={s}
        motion={motion}
        forces={forces}
        showForces={showForces}
        forceLabel={forceLabel}
        reading={reading}
        labels={labels}
      />
    </GameScene3D>
  );
}
