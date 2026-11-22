import { describe, expect, it } from 'vitest';
import {
  clampParam,
  createClock,
  defaultParams,
  labModel,
  parseParams,
  pathSeries,
  positionAt,
  uniformMotion,
  UNIFORM_MOTION_TRACK_MAX,
} from './index.ts';

describe('uniform motion', () => {
  it('matches S = v·t and x = x0 + S', () => {
    expect(uniformMotion.compute({ v: 5, t: 10, x0: 0 })).toEqual({ S: 50, x: 50 });
    expect(uniformMotion.compute({ v: 2.5, t: 4, x0: 12 })).toEqual({ S: 10, x: 22 });
    expect(uniformMotion.compute({ v: 0, t: 20, x0: 7 })).toEqual({ S: 0, x: 7 });
  });

  it('stops the body at t', () => {
    const p = { v: 3, t: 4, x0: 1 };
    expect(positionAt(p, 0)).toBe(1);
    expect(positionAt(p, 2)).toBe(7);
    expect(positionAt(p, 100)).toBe(13);
    expect(positionAt(p, -1)).toBe(1);
  });

  it('samples a straight line through the origin', () => {
    const s = pathSeries({ v: 2, t: 10, x0: 5 }, 11);
    expect(s).toHaveLength(11);
    expect(s[0]).toEqual({ x: 0, y: 0 });
    expect(s[10]).toEqual({ x: 10, y: 20 });
    for (const pt of s) expect(pt.y).toBeCloseTo(2 * pt.x, 12);
  });

  it('track covers the largest allowed position', () => {
    const p = parseParams(uniformMotion, { v: 1e9, t: 1e9, x0: 1e9 });
    expect(uniformMotion.compute(p).x).toBe(UNIFORM_MOTION_TRACK_MAX);
  });
});

describe('parameters', () => {
  const v = uniformMotion.params.v;
  it('clamps to the range and snaps to the step', () => {
    expect(clampParam(v, 31)).toBe(30);
    expect(clampParam(v, -2)).toBe(0);
    expect(clampParam(v, 2.26)).toBe(2.5);
    expect(clampParam(v, 0.1 + 0.2)).toBe(0.5);
    expect(clampParam(v, Number.NaN)).toBe(5);
  });

  it('parses untrusted input', () => {
    expect(parseParams(uniformMotion, { v: '7.5', t: 3, x0: 'abc', evil: 1 })).toEqual({
      v: 7.5,
      t: 3,
      x0: 0,
    });
    expect(parseParams(uniformMotion, null)).toEqual(defaultParams(uniformMotion));
    expect(parseParams(uniformMotion, [1, 2])).toEqual(defaultParams(uniformMotion));
  });

  it('registry finds models by code only', () => {
    expect(labModel('uniform-motion')).toBe(uniformMotion);
    expect(labModel('constructor')).toBeNull();
    expect(labModel('nope')).toBeNull();
  });
});

describe('model clock', () => {
  const run = (fps: number, seconds: number) => {
    const clock = createClock(1 / 120);
    for (let i = 0; i < fps * seconds; i++) clock.advance(1 / fps);
    return clock.time;
  };

  it('gives the same model time at different frame rates', () => {
    expect(run(30, 2)).toBeCloseTo(2, 6);
    expect(run(60, 2)).toBeCloseTo(2, 6);
    expect(run(144, 2)).toBeCloseTo(2, 6);
  });

  it('does not jump after a long pause and resets', () => {
    const clock = createClock(0.01, 0.25);
    clock.advance(10);
    expect(clock.time).toBeCloseTo(0.25, 9);
    clock.advance(-1);
    expect(clock.time).toBeCloseTo(0.25, 9);
    clock.reset();
    expect(clock.time).toBe(0);
  });
});
