/**
 * Fixed-step model clock: model time advances in whole steps regardless of the frame rate,
 * so a simulation looks and ends the same at 30 and at 144 fps (GAME_TEMPLATE.md §2).
 */
export interface ModelClock {
  /** Feeds real elapsed seconds; returns how many model steps were taken. */
  advance(realSeconds: number): number;
  readonly time: number;
  reset(): void;
}

export function createClock(stepSeconds = 1 / 120, maxFrameSeconds = 0.25): ModelClock {
  let steps = 0;
  let acc = 0;
  return {
    advance(real) {
      if (!(real > 0)) return 0;
      // A long pause (background tab) must not fast-forward the model in one jump.
      acc += Math.min(real, maxFrameSeconds);
      const n = Math.floor(acc / stepSeconds + 1e-9);
      acc -= n * stepSeconds;
      steps += n;
      return n;
    },
    get time() {
      return steps * stepSeconds;
    },
    reset() {
      steps = 0;
      acc = 0;
    },
  };
}
