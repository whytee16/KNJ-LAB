'use client';

import { useCallback, useEffect, useState } from 'react';
import { degrade, deviceHints, pickQuality, type RenderQuality } from './quality.ts';

const KEY = 'knj.lab.view';

function readChoice(): '3d' | '2d' | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === '3d' || v === '2d' ? v : null;
  } catch {
    return null;
  }
}

/**
 * 3D or 2D view of a lab. Starts from the device hints, steps down when the measured frame rate
 * is too low, and remembers the student's own choice (per browser, a convenience only).
 */
export function useViewMode() {
  // Before mounting we do not know the device: render the 2D view (also what SSR shows).
  const [quality, setQuality] = useState<RenderQuality>('2d');
  const [webgl, setWebgl] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [ready, setReady] = useState(false);
  // An explicit choice of the student is kept: no automatic step-down after it.
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const hints = deviceHints();
    setWebgl(hints.webgl);
    const auto = pickQuality(hints);
    const choice = readChoice();
    setPinned(choice !== null);
    setQuality(choice === '2d' || !hints.webgl ? '2d' : auto === '2d' ? 'low' : auto);
    setReady(true);
  }, []);

  const choose = useCallback(
    (view: '3d' | '2d') => {
      try {
        window.localStorage.setItem(KEY, view);
      } catch {
        // storage blocked: the choice lasts for this page only
      }
      setDegraded(false);
      setPinned(true);
      setQuality(
        view === '2d' || !webgl ? '2d' : pickQuality(deviceHints()) === 'high' ? 'high' : 'low',
      );
    },
    [webgl],
  );

  const reportFps = useCallback(
    (fps: number) => {
      if (pinned) return;
      setQuality((q) => {
        const next = degrade(q, fps);
        if (next !== q) setDegraded(true);
        return next;
      });
    },
    [pinned],
  );

  const lost = useCallback(() => {
    setDegraded(true);
    setQuality('2d');
  }, []);

  return {
    quality,
    view: quality === '2d' ? '2d' : '3d',
    webgl,
    degraded,
    ready,
    choose,
    reportFps,
    lost,
  } as const;
}
