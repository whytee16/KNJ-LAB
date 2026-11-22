import { correct, invalid, wrong, type CheckResult } from './types.ts';

/** Parses "3,5", "-2.25", "−4", "3/4", " 1 200 " into a number, or null. */
export function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(/[\s ]/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return null;
}

export function checkNumber(
  raw: string,
  expected: { value: number; decimals?: number; tolerance: { abs?: number; rel?: number } },
): CheckResult {
  if (!raw.trim()) return invalid('empty');
  const v = parseNumberInput(raw);
  if (v === null) return invalid('unparseable');
  const halfUnit = expected.decimals !== undefined ? 0.5 * 10 ** -expected.decimals : 0;
  const tol = Math.max(
    expected.tolerance.abs ?? 0,
    (expected.tolerance.rel ?? 0) * Math.abs(expected.value),
    halfUnit,
    1e-9,
  );
  return Math.abs(v - expected.value) <= tol + 1e-12 ? correct : wrong();
}
