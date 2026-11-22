'use client';

import { createClock } from '@knj/physics';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Model time τ for an animated lab: runs from 0 (or the pause point) to `duration` on the fixed-step
 * clock. At rest τ = duration, so the lab shows the end state. Reduced motion jumps to the end.
 */
export function useModelTime(duration: number, restAt: 'end' | 'start' = 'end') {
  const rest = (d: number) => (restAt === 'end' ? d : 0);
  const [tau, setTau] = useState(() => rest(duration));
  const [running, setRunning] = useState(false);
  const clock = useRef(createClock());
  const frame = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setRunning(false);
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const run = useCallback(() => {
    if (duration === 0) return;
    // Reduced motion: no animation — the end state for one-off motion, the start for oscillations.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTau(rest(duration));
      return;
    }
    const start = tau >= duration ? 0 : tau;
    clock.current.reset();
    setTau(start);
    setRunning(true);
    let last = performance.now();
    const step = (time: number) => {
      clock.current.advance((time - last) / 1000);
      last = time;
      const next = Math.min(start + clock.current.time, duration);
      setTau(next);
      if (next >= duration) setRunning(false);
      else frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, tau, restAt]);

  /** New parameters: stop and show the end state of the new motion. */
  const restart = useCallback(
    (nextDuration: number) => {
      stop();
      setTau(rest(nextDuration));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stop, restAt],
  );

  return { tau: Math.min(tau, duration), running, run, stop, restart };
}
