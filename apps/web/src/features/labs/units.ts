import type { UnitCode } from '@knj/physics';

/** Message key (labs.units.*) of each SI unit code used by lab models. */
export const UNIT_KEY = {
  m: 'm',
  s: 's',
  'm/s': 'mps',
  deg: 'deg',
  'm/s2': 'mps2',
} as const satisfies Record<UnitCode, string>;

export const camelCode = (code: string) =>
  code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
