import type { UnitCode } from '@knj/physics';

/** Message key (labs.units.*) of each SI unit code used by lab models. */
export const UNIT_KEY = {
  m: 'm',
  s: 's',
  'm/s': 'mps',
  deg: 'deg',
  'm/s2': 'mps2',
  kg: 'kg',
  N: 'N',
  '1': 'none',
  J: 'J',
  'N/m': 'Npm',
  Hz: 'Hz',
} as const satisfies Record<UnitCode, string>;

export const camelCode = (code: string) =>
  code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Unit text for display; dimensionless quantities (μ) have none. */
export function unitText(
  t: (key: `units.${(typeof UNIT_KEY)[UnitCode]}`) => string,
  u: UnitCode,
): string {
  return u === '1' ? '' : t(`units.${UNIT_KEY[u]}`);
}
