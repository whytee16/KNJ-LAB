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
}: {
  position: [number, number, number];
  target: [number, number, number];
  resetKey: number;
}) {
  const { camera, gl } = useThree();
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
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz);
    controls.update();
  }, [camera, controls, posKey, targetKey, resetKey]);
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
    <group position={a} quaternion={q}>
      <mesh position={[0, shaft / 2, 0]}>
        <cylinderGeometry args={[radius, radius, shaft, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, shaft + head / 2, 0]}>
        <coneGeometry args={[radius * 3, head, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
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
              <gridHelper args={[gridSize * 2, gridSize * 2, tokens.muted, tokens.border]} />
              <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow={high}>
                <planeGeometry args={[gridSize * 2, gridSize * 2]} />
                <meshStandardMaterial color={tokens.surface} transparent opacity={0.6} />
              </mesh>
              <Controls position={camera} target={target} resetKey={resetKey} />
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
