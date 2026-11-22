import { describe, expect, it } from 'vitest';
import { degrade, pickQuality } from './quality.ts';

describe('3D quality', () => {
  it('starts from device hints', () => {
    expect(pickQuality({ webgl: false })).toBe('2d');
    expect(pickQuality({ webgl: true, deviceMemory: 8, cores: 8 })).toBe('high');
    expect(pickQuality({ webgl: true, deviceMemory: 4, cores: 8 })).toBe('low');
    expect(pickQuality({ webgl: true, cores: 4 })).toBe('low');
    expect(pickQuality({ webgl: true, deviceMemory: 8, cores: 8, reducedMotion: true })).toBe(
      'low',
    );
    expect(pickQuality({ webgl: true })).toBe('high');
  });

  it('steps down by the measured frame rate', () => {
    expect(degrade('high', 55)).toBe('high');
    expect(degrade('high', 25)).toBe('low');
    expect(degrade('low', 25)).toBe('low');
    expect(degrade('low', 15)).toBe('2d');
    expect(degrade('2d', 5)).toBe('2d');
  });
});
