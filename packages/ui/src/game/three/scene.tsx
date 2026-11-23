'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RenderQuality } from './quality.ts';

export interface SceneTokens {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  info: string;
  success: string;
  danger: string;
}

const FALLBACK: SceneTokens = {
  bg: '#ffffff',
  surface: '#f2ece2',
  border: '#e4dccf',
  text: '#1c1a17',
  muted: '#5e574d',
  accent: '#a84508',
  info: '#2b6cb0',
  success: '#186a3b',
  danger: '#b53628',
};

function readTokens(): SceneTokens {
  if (typeof document === 'undefined') return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, key: keyof SceneTokens) =>
    css.getPropertyValue(name).trim() || FALLBACK[key];
  return {
    bg: v('--surface', 'bg'),
    surface: v('--surface-muted', 'surface'),
    border: v('--border', 'border'),
    text: v('--text', 'text'),
    muted: v('--text-muted', 'muted'),
    accent: v('--accent', 'accent'),
    info: v('--info', 'info'),
    success: v('--success', 'success'),
    danger: v('--danger', 'danger'),
  };
}

/** Design tokens as colours for the scene; follows the light/dark switch. */
export function useSceneTokens(): SceneTokens {
  const [tokens, setTokens] = useState<SceneTokens>(readTokens);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setTokens(readTokens());
    mq?.addEventListener('change', update);
    return () => mq?.removeEventListener('change', update);
  }, []);
  return tokens;
}

const OverlayContext = createContext<HTMLDivElement | null>(null);
const TokensContext = createContext<SceneTokens | null>(null);
export const useTokens = () => useContext(TokensContext)!;

/** Measures the average frame rate over the first two seconds, once. */
function FpsProbe({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef(0);
  const start = useRef<number | null>(null);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    const now = performance.now();
    start.current ??= now;
    frames.current += 1;
    const elapsed = now - start.current;
    if (elapsed >= 2000) {
      done.current = true;
      onFps((frames.current * 1000) / elapsed);
    }
  });
  return null;
}

/** Orbit / pinch / pan around the target; `resetKey` changes return to the default view. */
function Controls({
  position,
  target,
  resetKey,
  fitWidth,
  fitHeight,
}: {
  position: [number, number, number];
  target: [number, number, number];
  resetKey: number;
  /** Scene width that must fit the view; the camera moves back on narrow (phone) screens. */
  fitWidth?: number;
  /** Scene height that must fit the view (tall set-ups: a table with a hanging load). */
  fitHeight?: number;
}) {
  const { camera, gl, size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  useEffect(() => {
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // never below the ground
    return () => controls.dispose();
  }, [controls]);
  // Arrays are recreated on every render: react to their values, not identities.
  const posKey = position.join(',');
  const targetKey = target.join(',');
  useEffect(() => {
    const [px, py, pz] = posKey.split(',').map(Number) as [number, number, number];
    const [tx, ty, tz] = targetKey.split(',').map(Number) as [number, number, number];
    const offset = new THREE.Vector3(px - tx, py - ty, pz - tz);
    if ((fitWidth || fitHeight) && camera instanceof THREE.PerspectiveCamera) {
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const need = Math.max(
        fitWidth ? (fitWidth / 2 / (half * aspect)) * 1.1 : 0,
        fitHeight ? (fitHeight / 2 / half) * 1.1 : 0,
      );
      if (offset.length() < need) offset.setLength(need);
    }
    camera.position.set(tx + offset.x, ty + offset.y, tz + offset.z);
    controls.target.set(tx, ty, tz);
    controls.update();
  }, [camera, controls, posKey, targetKey, resetKey, fitWidth, fitHeight, aspect]);
  useFrame(() => controls.update());
  return null;
}

/**
 * Text label that follows a 3D point. A plain DOM element in the overlay above the canvas
 * (the canvas has its own React renderer, so labels are managed imperatively), crisp and translated.
 */
export function Label3D({
  position,
  text,
  className,
}: {
  position: [number, number, number];
  text: string;
  className?: string;
}) {
  const overlay = useContext(OverlayContext);
  const el = useMemo(
    () => (typeof document === 'undefined' ? null : document.createElement('span')),
    [],
  );
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    if (!overlay || !el) return;
    overlay.appendChild(el);
    return () => el.remove();
  }, [overlay, el]);
  useEffect(() => {
    if (!el) return;
    el.className =
      'pointer-events-none absolute top-0 left-0 rounded bg-surface/80 px-1 text-xs whitespace-nowrap text-text ' +
      (className ?? '');
    el.textContent = text;
  }, [el, text, className]);
  useFrame(() => {
    if (!el) return;
    v.set(...position).project(camera);
    el.style.opacity = v.z < 1 ? '1' : '0';
    el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
  });
  return null;
}

/** Arrow from `from` to `to` (shaft + head); hidden when shorter than a few millimetres. */
export function Arrow3D({
  from,
  to,
  color,
  radius = 0.04,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  radius?: number;
}) {
  const a = new THREE.Vector3(...from);
  const dir = new THREE.Vector3(...to).sub(a);
  const len = dir.length();
  if (len < 0.05) return null;
  const head = Math.min(0.35, len * 0.35);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const shaft = len - head;
  return (
    // Vectors are drawn over the bodies (no depth test): a force must stay visible even when it
    // points into the wedge or the ground.
    <group position={a} quaternion={q}>
      <mesh position={[0, shaft / 2, 0]} renderOrder={10}>
        <cylinderGeometry args={[radius, radius, shaft, 8]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
      <mesh position={[0, shaft + head / 2, 0]} renderOrder={10}>
        <coneGeometry args={[radius * 3, head, 12]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
    </group>
  );
}

/** Right-angled wedge (inclined plane): legs `base` along x and `height` along y, centred in z. */
export function Wedge3D({
  base,
  height,
  depth,
  color,
  position,
  shadows,
}: {
  base: number;
  height: number;
  depth: number;
  color: string;
  position: [number, number, number];
  shadows?: boolean;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.max(base, 0.01), 0);
    shape.lineTo(0, Math.max(height, 0.01));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [base, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} castShadow={shadows} receiveShadow={shadows}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private coils: number,
    private radius: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.coils * Math.PI * 2;
    return target.set(t, this.radius * Math.cos(a), this.radius * Math.sin(a));
  }
}

/** Coil spring along +x from `from`, stretched to `length` (the coils stretch evenly, as in a real spring). */
export function Spring3D({
  from,
  length,
  radius = 0.25,
  coils = 12,
  wire = 0.03,
  color,
  segments = 240,
}: {
  from: [number, number, number];
  length: number;
  radius?: number;
  coils?: number;
  wire?: number;
  color: string;
  segments?: number;
}) {
  const geometry = useMemo(
    () => new THREE.TubeGeometry(new Helix(coils, radius), segments, wire, 6, false),
    [coils, radius, wire, segments],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={from} scale={[Math.max(length, 0.01), 1, 1]}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Thick wire through points (straight segments), e.g. circuit conductors. */
export function Tube3D({
  points,
  radius = 0.05,
  color,
}: {
  points: [number, number, number][];
  radius?: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < points.length; i++)
      path.add(
        new THREE.LineCurve3(
          new THREE.Vector3(...points[i - 1]!),
          new THREE.Vector3(...points[i]!),
        ),
      );
    return new THREE.TubeGeometry(path, Math.max(8, points.length * 8), radius, 8, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Polyline through model points (dashed for predicted paths). */
export function Polyline3D({
  points,
  color,
  dashed,
}: {
  points: [number, number, number][];
  color: string;
  dashed?: boolean;
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.25, gapSize: 0.15 })
      : new THREE.LineBasicMaterial({ color });
    const l = new THREE.Line(geometry, material);
    if (dashed) l.computeLineDistances();
    return l;
  }, [points, color, dashed]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

/** A classroom around the experiment: floor in metre tiles, back and left walls, a board. */
export interface RoomSpec {
  /** Centre of the floor (x, z). */
  center?: [number, number];
  width: number;
  depth: number;
  height: number;
  /** Draw the classroom board on the back wall. */
  board?: boolean;
  /** Height of the floor in scene units (below 0 when the experiment stands on a table). */
  floorY?: number;
}

function mix(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

function FloorGrid({ width, depth, color }: { width: number; depth: number; color: string }) {
  const lines = useMemo(() => {
    const pts: number[] = [];
    for (let x = -width / 2; x <= width / 2 + 1e-6; x += 1)
      pts.push(x, 0, -depth / 2, x, 0, depth / 2);
    for (let z = -depth / 2; z <= depth / 2 + 1e-6; z += 1)
      pts.push(-width / 2, 0, z, width / 2, 0, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }),
    );
  }, [width, depth, color]);
  useEffect(
    () => () => {
      lines.geometry.dispose();
      (lines.material as THREE.Material).dispose();
    },
    [lines],
  );
  return <primitive object={lines} />;
}

/** Walls face the default camera; seen from behind they disappear (back faces are culled). */
export function Room3D({ spec, shadows }: { spec: RoomSpec; shadows?: boolean }) {
  const tk = useTokens();
  const [cx, cz] = spec.center ?? [0, 0];
  const { width: w, depth: d, height: h } = spec;
  const floor = mix(tk.surface, tk.muted, 0.12);
  const wall = mix(tk.bg, tk.surface, 0.55);
  const side = mix(tk.bg, tk.surface, 0.8);
  const trim = mix(tk.surface, tk.text, 0.25);
  return (
    <group position={[cx, spec.floorY ?? 0, cz]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow={shadows}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floor} />
      </mesh>
      <group position={[0, 0.001, 0]}>
        <FloorGrid width={w} depth={d} color={tk.border} />
      </group>
      <mesh position={[0, h / 2, -d / 2]} receiveShadow={shadows}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]} rotation-y={Math.PI / 2} receiveShadow={shadows}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color={side} />
      </mesh>
      <mesh position={[0, 0.08, -d / 2 + 0.03]}>
        <boxGeometry args={[w, 0.16, 0.06]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[-w / 2 + 0.03, 0.08, 0]}>
        <boxGeometry args={[0.06, 0.16, d]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      {spec.board ? (
        <group position={[0, Math.min(h * 0.55, h - 1.4), -d / 2 + 0.02]}>
          <mesh>
            <boxGeometry args={[Math.min(w * 0.45, 7) + 0.2, 2.2, 0.04]} />
            <meshStandardMaterial color={trim} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[Math.min(w * 0.45, 7), 2]} />
            <meshStandardMaterial color={mix(tk.success, tk.text, 0.55)} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

/**
 * Shared 3D canvas of the lab template: token colours, light, ground grid, orbit controls,
 * a "default view" button and an HTML overlay for labels. Physics stays in the model.
 */
export function GameScene3D({
  quality,
  label,
  resetLabel,
  camera,
  target,
  gridSize = 20,
  room,
  ground = true,
  fitWidth,
  fitHeight,
  onFps,
  onContextLost,
  children,
}: {
  quality: Exclude<RenderQuality, '2d'>;
  label: string;
  resetLabel: string;
  camera: [number, number, number];
  target: [number, number, number];
  gridSize?: number;
  /** A classroom around the experiment instead of the open grid. */
  room?: RoomSpec;
  /** Ground grid when there is no room; off for scenes with their own surroundings (lift shaft). */
  ground?: boolean;
  fitWidth?: number;
  fitHeight?: number;
  onFps?: (fps: number) => void;
  onContextLost?: () => void;
  children: ReactNode;
}) {
  const tokens = useSceneTokens();
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const high = quality === 'high';
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <div className="relative">
      <div
        role="img"
        aria-label={label}
        className="relative h-[clamp(260px,50svh,460px)] w-full overflow-hidden rounded-md bg-surface"
        data-testid="scene-3d"
        data-quality={quality}
      >
        <Canvas
          dpr={high ? [1, 2] : 1}
          shadows={high}
          gl={{ antialias: high, powerPreference: high ? 'high-performance' : 'low-power' }}
          camera={{ position: camera, fov: 45, near: 0.1, far: 500 }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              // Unmounting the canvas (switch to 2D) releases the context too: not a failure.
              if (alive.current) onContextLost?.();
            });
          }}
        >
          <TokensContext.Provider value={tokens}>
            <OverlayContext.Provider value={overlay}>
              <color attach="background" args={[tokens.bg]} />
              <hemisphereLight args={[tokens.bg, tokens.surface, 1.2]} />
              <directionalLight position={[8, 14, 10]} intensity={1.4} castShadow={high} />
              {room ? (
                <Room3D spec={room} shadows={high} />
              ) : !ground ? null : (
                <>
                  <gridHelper args={[gridSize * 2, gridSize * 2, tokens.muted, tokens.border]} />
                  <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow={high}>
                    <planeGeometry args={[gridSize * 2, gridSize * 2]} />
                    <meshStandardMaterial color={tokens.surface} transparent opacity={0.6} />
                  </mesh>
                </>
              )}
              <Controls
                position={camera}
                target={target}
                resetKey={resetKey}
                fitWidth={fitWidth}
                fitHeight={fitHeight}
              />
              {onFps ? <FpsProbe key={quality} onFps={onFps} /> : null}
              {children}
            </OverlayContext.Provider>
          </TokensContext.Provider>
        </Canvas>
        <div ref={setOverlay} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={() => setResetKey((k) => k + 1)}
        className="absolute bottom-2 left-2 min-h-11 rounded-md border border-border bg-surface/90 px-3 text-sm hover:bg-surface-muted"
      >
        {resetLabel}
      </button>
    </div>
  );
}
