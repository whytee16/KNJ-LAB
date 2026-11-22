'use client';

import { chargeOffset, circuit, type CircuitParams } from '@knj/physics';
import { useMeasuredWidth } from '@knj/ui/game';
import { chargePositions, circuitLayout, type P2 } from './circuit-geometry';
import type { CircuitLabels } from './circuit-scene3d';

/** Circuit diagram with standard symbols; charges move along the wires. Drawing only. */
export function CircuitSide2D({
  params,
  tau,
  closed,
  label,
  labels,
}: {
  params: CircuitParams;
  tau: number;
  closed: boolean;
  label: string;
  labels: CircuitLabels;
}) {
  const [ref, W] = useMeasuredWidth<HTMLDivElement>(640);
  const H = 340;
  const layout = circuitLayout(params);
  const r = circuit.compute(params);
  // Board x ∈ [−5, 5], z ∈ [−4.4, 2.6] → screen; z grows towards the viewer = down on the diagram.
  const s = Math.min((W - 40) / 10, (H - 40) / 7);
  const ox = W / 2;
  const oy = 20 + 2.6 * s;
  const X = (p: P2) => ox + p[0] * s;
  const Yp = (p: P2) => oy - p[1] * s;
  const pts = (ps: P2[]) => ps.map((p) => `${X(p)},${Yp(p)}`).join(' ');
  const resistor = (at: P2, text: string, key: string) => (
    <g key={key}>
      <rect
        x={X(at) - 0.8 * s}
        y={Yp(at) - 0.25 * s}
        width={1.6 * s}
        height={0.5 * s}
        className="fill-surface stroke-text"
        strokeWidth={2}
      />
      <text x={X(at)} y={Yp(at) - 0.45 * s} textAnchor="middle" className="fill-text text-xs">
        {text}
      </text>
    </g>
  );
  const meter = (at: P2, letter: string, text: string, key: string) => (
    <g key={key} data-meter={letter}>
      <circle
        cx={X(at)}
        cy={Yp(at)}
        r={0.45 * s}
        className="fill-surface stroke-text"
        strokeWidth={2}
      />
      <text
        x={X(at)}
        y={Yp(at) + 4}
        textAnchor="middle"
        className="fill-text text-sm font-semibold"
      >
        {letter}
      </text>
      <text
        x={X(at)}
        y={Yp(at) - 0.6 * s}
        textAnchor="middle"
        className="fill-text text-xs font-semibold"
      >
        {text}
      </text>
    </g>
  );
  const b = layout.battery;
  const sw = layout.switchAt;
  return (
    <div ref={ref} data-testid="scene-2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {layout.wires.map((w, i) => (
          <polyline
            key={i}
            points={pts(w.points)}
            fill="none"
            className="stroke-text"
            strokeWidth={2}
          />
        ))}
        {/* Gap for the switch: when open, the blade is lifted. */}
        <line
          x1={X(sw) - 0.45 * s}
          x2={X(sw) + 0.45 * s}
          y1={Yp(sw)}
          y2={Yp(sw)}
          className="stroke-surface"
          strokeWidth={4}
        />
        <line
          x1={X(sw) - 0.45 * s}
          y1={Yp(sw)}
          x2={X(sw) + 0.45 * s}
          y2={closed ? Yp(sw) : Yp(sw) - 0.4 * s}
          className="stroke-text"
          strokeWidth={2.5}
        />
        <circle
          cx={X(sw) - 0.45 * s}
          cy={Yp(sw)}
          r={4}
          className="fill-surface stroke-text"
          strokeWidth={2}
        />
        <circle
          cx={X(sw) + 0.45 * s}
          cy={Yp(sw)}
          r={4}
          className="fill-surface stroke-text"
          strokeWidth={2}
        />
        {/* Source: long plate (+) and short plate (−). */}
        <line
          x1={X(b)}
          x2={X(b)}
          y1={Yp([b[0], 0.6])}
          y2={Yp(b) - 6}
          className="stroke-text"
          strokeWidth={2}
        />
        <line
          x1={X(b)}
          x2={X(b)}
          y1={Yp(b) + 6}
          y2={Yp([b[0], -0.6])}
          className="stroke-text"
          strokeWidth={2}
        />
        <line
          x1={X(b) - 0.45 * s}
          x2={X(b) + 0.45 * s}
          y1={Yp(b) - 6}
          y2={Yp(b) - 6}
          className="stroke-text"
          strokeWidth={2.5}
        />
        <line
          x1={X(b) - 0.22 * s}
          x2={X(b) + 0.22 * s}
          y1={Yp(b) + 6}
          y2={Yp(b) + 6}
          className="stroke-text"
          strokeWidth={5}
        />
        <text x={X(b) - 0.6 * s} y={Yp(b) + 4} textAnchor="end" className="fill-text text-xs">
          {labels.source}
        </text>
        {resistor(layout.R1, labels.R1, 'R1')}
        {resistor(layout.R2, labels.R2, 'R2')}
        <polyline
          points={pts([layout.r1Ends[0], layout.voltmeter, layout.r1Ends[1]])}
          fill="none"
          className="stroke-text-muted"
          strokeDasharray="4 3"
        />
        {meter(layout.ammeter, 'A', labels.ammeter, 'A')}
        {meter(layout.voltmeter, 'V', labels.voltmeter, 'V')}
        {closed
          ? layout.wires.flatMap((w, i) =>
              chargePositions(w.points, chargeOffset(r[w.current], tau, 1.5)).map((p, j) => (
                <circle key={`${i}-${j}`} cx={X(p)} cy={Yp(p)} r={3} className="fill-info" />
              )),
            )
          : null}
      </svg>
    </div>
  );
}
