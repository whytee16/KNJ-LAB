'use client';

import { chargeOffset, circuit, type CircuitParams } from '@knj/physics';
import { GameScene3D, Label3D, Polyline3D, Tube3D, useTokens } from '@knj/ui/game3d';
import { chargePositions, circuitLayout, type P2 } from './circuit-geometry';
import type { Scene3DHandlers } from './lab-frame-3d';

type V3 = [number, number, number];
const Y = 0.25; // wire height above the board
// Board z up on the diagram = away from the viewer in 3D, so the scene reads like the diagram.
const on = (p: P2, y = Y): V3 => [p[0], y, -p[1]];

export interface CircuitLabels {
  ammeter: string;
  voltmeter: string;
  R1: string;
  R2: string;
  source: string;
}

function Circuit({
  params,
  tau,
  closed,
  labels,
  low,
}: {
  params: CircuitParams;
  tau: number;
  closed: boolean;
  labels: CircuitLabels;
  low: boolean;
}) {
  const tk = useTokens();
  const layout = circuitLayout(params);
  const r = circuit.compute(params);
  const seg = low ? 10 : 24;
  const resistor = (at: P2, key: string) => (
    <group key={key} position={on(at)}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 1.6, seg]} />
        <meshStandardMaterial color={tk.surface} />
      </mesh>
      {[-0.45, -0.15, 0.15].map((x, i) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.23, 0.23, 0.1, seg]} />
          <meshStandardMaterial color={[tk.danger, tk.text, tk.accent][i]} />
        </mesh>
      ))}
    </group>
  );
  const meter = (at: P2, key: string) => (
    <group key={key} position={on(at, 0.2)}>
      <mesh>
        <cylinderGeometry args={[0.55, 0.55, 0.35, seg]} />
        <meshStandardMaterial color={tk.text} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.02, seg]} />
        <meshStandardMaterial color={tk.bg} />
      </mesh>
    </group>
  );
  const flow = (current: number) => (closed ? chargeOffset(current, tau, 1.5) : 0);
  return (
    <>
      <mesh position={[0, -0.05, 0.6]} receiveShadow={!low}>
        <boxGeometry args={[10.5, 0.1, 6.8]} />
        <meshStandardMaterial color={tk.surface} />
      </mesh>
      {layout.wires.map((w, i) => (
        <Tube3D key={i} points={w.points.map((p) => on(p))} radius={0.05} color={tk.muted} />
      ))}
      {/* Charges: visible only while current flows. */}
      {closed
        ? layout.wires.flatMap((w, i) =>
            chargePositions(w.points, flow(r[w.current])).map((p, j) => (
              <mesh key={`${i}-${j}`} position={on(p, Y + 0.06)}>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshBasicMaterial color={tk.info} />
              </mesh>
            )),
          )
        : null}
      {/* Source: a battery with the "+" end at the top. */}
      <group position={on(layout.battery, 0.4)}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 1.2, seg]} />
          <meshStandardMaterial color={tk.accent} />
        </mesh>
        <mesh position={[0, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.2, seg]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
      </group>
      {/* Switch: the lever lies on the contact when closed and is lifted when open. */}
      <group position={on(layout.switchAt, Y)}>
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
        <mesh position={[0, closed ? 0 : 0.3, 0]} rotation={[0, 0, closed ? 0 : 0.6]}>
          <boxGeometry args={[0.9, 0.06, 0.12]} />
          <meshStandardMaterial color={tk.text} />
        </mesh>
      </group>
      {resistor(layout.R1, 'R1')}
      {resistor(layout.R2, 'R2')}
      {meter(layout.ammeter, 'A')}
      {meter(layout.voltmeter, 'V')}
      <Polyline3D
        points={[on(layout.r1Ends[0]), on(layout.voltmeter, 0.2)]}
        color={tk.border}
        dashed
      />
      <Polyline3D
        points={[on(layout.r1Ends[1]), on(layout.voltmeter, 0.2)]}
        color={tk.border}
        dashed
      />
      <Label3D position={on(layout.ammeter, 0.9)} text={labels.ammeter} className="font-semibold" />
      <Label3D
        position={on(layout.voltmeter, 0.9)}
        text={labels.voltmeter}
        className="font-semibold"
      />
      <Label3D position={[layout.R1[0], 0.8, -layout.R1[1] + 0.5]} text={labels.R1} />
      <Label3D position={[layout.R2[0], 0.8, -layout.R2[1] + 0.5]} text={labels.R2} />
      <Label3D position={[layout.battery[0] - 0.9, 1, -layout.battery[1]]} text={labels.source} />
    </>
  );
}

/** 3D board with the circuit; charges move with a speed proportional to the current. */
export default function CircuitScene3D({
  params,
  tau,
  closed,
  label,
  resetLabel,
  labels,
  ...h
}: Scene3DHandlers & {
  params: CircuitParams;
  tau: number;
  closed: boolean;
  label: string;
  resetLabel: string;
  labels: CircuitLabels;
}) {
  return (
    <GameScene3D
      quality={h.quality}
      label={label}
      resetLabel={resetLabel}
      camera={[0, 8, 8.5]}
      target={[0, 0, 0.8]}
      fitWidth={11}
      onFps={h.onFps}
      onContextLost={h.onContextLost}
    >
      <Circuit
        params={params}
        tau={tau}
        closed={closed}
        labels={labels}
        low={h.quality === 'low'}
      />
    </GameScene3D>
  );
}
