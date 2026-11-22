'use client';

import { createClock } from '@knj/physics';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Model time τ for an animated lab: runs from 0 (or the pause point) to `duration` on the fixed-step
 * clock. At rest τ = duration, so the lab shows the end state. Reduced motion jumps to the end.
 */
export function useModelTime(duration: number) {
  const [tau, setTau] = useState(duration);
  const [running, setRunning] = useState(false);
  const clock = useRef(createClock());
  const frame = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setRunning(false);
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const run = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || duration === 0) {
      setTau(duration);
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
  }, [duration, tau]);

  /** New parameters: stop and show the end state of the new motion. */
  const restart = useCallback(
    (nextDuration: number) => {
      stop();
      setTau(nextDuration);
    },
    [stop],
  );

  return { tau: Math.min(tau, duration), running, run, stop, restart };
}
