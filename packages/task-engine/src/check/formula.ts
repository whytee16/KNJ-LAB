import { ComputeEngine } from '@cortex-js/compute-engine';
import { tryEvalReal } from '../expr.ts';
import { mulberry32 } from '../prng.ts';
import { correct, invalid, wrong, type CheckResult } from './types.ts';

const ce = new ComputeEngine();
const POINTS = 20;
const MIN_POINTS = 8;

/** Student LaTeX from MathLive: decimal comma → point, invisible operators removed. */
export function normalizeLatex(latex: string): string {
  return latex
    .replace(/(\d)\{,\}(\d)/g, '$1.$2')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\\placeholder\{\}/g, '')
    .trim();
}

type Parsed = NonNullable<ReturnType<typeof ce.parse>>;

function realAt(expr: Parsed, scope: Record<string, number>): number | null {
  const subs: Record<string, ReturnType<typeof ce.number>> = {};
  for (const [k, v] of Object.entries(scope)) subs[k] = ce.number(v);
  const n = expr.subs(subs).N();
  const re = n.re;
  const im = n.im;
  if (
    typeof re !== 'number' ||
    !Number.isFinite(re) ||
    (typeof im === 'number' && Math.abs(im) > 1e-12)
  )
    return null;
  return re;
}

/**
 * Equivalence by sampling: both expressions are evaluated at random points of the range;
 * points where either side is undefined (outside the domain) are skipped.
 */
export function checkFormula(
  latex: string,
  expected: { expression: string; variables: string[]; range: [number, number] },
  seed = 12345,
): CheckResult {
  const source = normalizeLatex(latex);
  if (!source) return invalid('empty');
  const parsed = ce.parse(source);
  if (!parsed || !parsed.isValid) return invalid('unparseable');
  const unknown = [...parsed.unknowns].filter((u) => !expected.variables.includes(String(u)));
  if (unknown.length) return wrong();

  const rand = mulberry32(seed);
  const [lo, hi] = expected.range;
  let compared = 0;
  for (let i = 0; i < POINTS * 5 && compared < POINTS; i++) {
    const scope: Record<string, number> = {};
    for (const v of expected.variables)
      scope[v] = Math.round((lo + rand() * (hi - lo)) * 1000) / 1000;
    const want = tryEvalReal(expected.expression, scope);
    if (want === null) continue;
    const got = realAt(parsed, scope);
    if (got === null) continue;
    compared++;
    if (Math.abs(got - want) > 1e-6 * Math.max(1, Math.abs(want))) return wrong();
  }
  return compared >= MIN_POINTS ? correct : invalid('cannot_verify');
}
