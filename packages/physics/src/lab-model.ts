import { z } from 'zod';

/** SI unit codes; the app translates them (labs.units.*). */
export type UnitCode =
  | 'm'
  | 'cm'
  | 's'
  | 'm/s'
  | 'deg'
  | 'm/s2'
  | 'kg'
  | 'N'
  | '1'
  | 'J'
  | 'N/m'
  | 'Hz'
  | 'V'
  | 'A'
  | 'Ohm'
  | 'W'
  | 'dpt';

export interface ParamSpec {
  min: number;
  max: number;
  step: number;
  default: number;
  unit: UnitCode;
  /** Symbol used in formulas and chart axes (not translated). */
  symbol: string;
  /** Fixed set of values (e.g. g on the Earth, the Moon, Mars); `key` is an i18n key suffix. */
  choices?: { value: number; key: string }[];
  /** Shown only when another parameter has this value (e.g. spring stiffness for a spring link). */
  when?: { param: string; value: number };
}

export interface ResultSpec {
  unit: UnitCode;
  symbol: string;
  /** Digits after the decimal point shown in readouts. */
  digits: number;
  /** Shown only when a parameter has this value. */
  when?: { param: string; value: number };
}

/** Whether a parameter or result is relevant for the current parameters. */
export function isShown(
  spec: { when?: { param: string; value: number } },
  values: Values,
): boolean {
  return !spec.when || values[spec.when.param] === spec.when.value;
}

export type Values = Record<string, number>;

/**
 * Pure lab model (GAME_TEMPLATE.md §2): parameters with ranges, a deterministic `compute`
 * and the model assumptions (i18n keys) shown to the student. Views draw, models calculate.
 */
export interface LabModel<P extends Values = Values, R extends Values = Values> {
  code: string;
  params: { [K in keyof P]: ParamSpec };
  results: { [K in keyof R]: ResultSpec };
  compute(params: P): R;
  assumptions: string[];
}

const decimals = (n: number) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

/** Keeps a value inside the range and on the step grid (counted from `min`). */
export function clampParam(spec: ParamSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.default;
  if (spec.choices?.length)
    return spec.choices.reduce((best, c) =>
      Math.abs(c.value - value) < Math.abs(best.value - value) ? c : best,
    ).value;
  const within = Math.min(spec.max, Math.max(spec.min, value));
  const snapped = spec.min + Math.round((within - spec.min) / spec.step) * spec.step;
  const fixed = Number(snapped.toFixed(Math.max(decimals(spec.step), decimals(spec.min))));
  return Math.min(spec.max, fixed);
}

export function defaultParams<P extends Values>(model: LabModel<P>): P {
  const out: Values = {};
  for (const [key, spec] of Object.entries(model.params) as [string, ParamSpec][])
    out[key] = spec.default;
  return out as P;
}

const inputSchema = z.record(z.string(), z.unknown());

/**
 * Untrusted input (URL, saved session, form) → valid parameters: unknown keys are dropped,
 * non-numbers fall back to defaults, numbers are clamped to the range.
 */
export function parseParams<P extends Values>(model: LabModel<P>, input: unknown): P {
  const parsed = inputSchema.safeParse(input);
  const raw = parsed.success ? parsed.data : {};
  const out: Values = {};
  for (const [key, spec] of Object.entries(model.params) as [string, ParamSpec][]) {
    const v = raw[key];
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    out[key] = Number.isFinite(n) ? clampParam(spec, n) : spec.default;
  }
  return out as P;
}
