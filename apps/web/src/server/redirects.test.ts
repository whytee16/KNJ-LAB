import { describe, expect, it } from 'vitest';
import { dashboardPath, safeNext } from './redirects';

describe('dashboardPath', () => {
  it('routes each role to its cabinet', () => {
    expect(dashboardPath('parent', 'ru')).toBe('/ru/parent');
    expect(dashboardPath('student', 'kk')).toBe('/kk/app');
    expect(dashboardPath('admin', 'ru')).toBe('/ru/account');
  });
});

describe('safeNext', () => {
  const fb = '/ru/parent';
  it.each([
    ['/ru/app', '/ru/app'],
    ['/ru', '/ru'],
    ['https://evil.example/ru/app', fb],
    ['//evil.example', fb],
    ['/ru//evil.example', fb],
    ['/ru/\\evil', fb],
    ['/kk/app', fb],
    ['/ru/app\n', fb],
    [undefined, fb],
    [42, fb],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input, 'ru', fb)).toBe(expected);
  });
});
