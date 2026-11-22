/** Render quality of a 3D lab (GAME_TEMPLATE.md §6, ADR-0009). */
export type RenderQuality = 'high' | 'low' | '2d';

export interface DeviceHints {
  webgl: boolean;
  deviceMemory?: number;
  cores?: number;
  reducedMotion?: boolean;
}

/** Starting quality from what the device tells us before anything is drawn. */
export function pickQuality(h: DeviceHints): RenderQuality {
  if (!h.webgl) return '2d';
  const weak =
    (h.deviceMemory !== undefined && h.deviceMemory <= 4) ||
    (h.cores !== undefined && h.cores <= 4) ||
    Boolean(h.reducedMotion);
  return weak ? 'low' : 'high';
}

/** Step down after measuring the frame rate: high → low below 30 fps, low → 2D below 20 fps. */
export function degrade(current: RenderQuality, fps: number): RenderQuality {
  if (current === 'high' && fps < 30) return 'low';
  if (current === 'low' && fps < 20) return '2d';
  return current;
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    webgl: hasWebGL(),
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}
