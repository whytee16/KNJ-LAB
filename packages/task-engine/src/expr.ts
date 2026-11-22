import { all, create, type EvalFunction, type FactoryFunctionMap } from 'mathjs';

/**
 * Sandboxed mathjs instance for template expressions. Functions that could change the
 * instance or evaluate nested code are disabled, as recommended by the mathjs security docs.
 */
const math = create(all as FactoryFunctionMap, { number: 'number' });
// References kept before sandboxing (the pattern from the mathjs security docs): expressions
// in templates cannot reach import/evaluate/parse, but our own code still can.
const compile = math.compile;
const parseForTex = math.parse;
const disabled = () => {
  throw new Error('function disabled in templates');
};
math.import(
  {
    import: disabled,
    createUnit: disabled,
    evaluate: disabled,
    parse: disabled,
    simplify: disabled,
    derivative: disabled,
    resolve: disabled,
    reviver: disabled,
  },
  { override: true },
);

const cache = new Map<string, EvalFunction>();

function compiled(expression: string): EvalFunction {
  let c = cache.get(expression);
  if (!c) {
    c = compile(expression) as EvalFunction;
    if (cache.size > 2000) cache.clear();
    cache.set(expression, c);
  }
  return c;
}

/** Evaluates a numeric expression; throws if the result is not a finite real number. */
export function evalNumber(expression: string, scope: Record<string, number>): number {
  const v: unknown = compiled(expression).evaluate({ ...scope });
  if (typeof v !== 'number' || !Number.isFinite(v))
    throw new Error(`not a finite number: ${expression}`);
  return v;
}

/** Evaluates a boolean constraint like "a != 0 and b > a". */
export function evalCondition(expression: string, scope: Record<string, number>): boolean {
  const v: unknown = compiled(expression).evaluate({ ...scope });
  if (typeof v !== 'boolean') throw new Error(`constraint is not boolean: ${expression}`);
  return v;
}

/** Real value or null when the expression is undefined at this point (outside the domain). */
export function tryEvalReal(expression: string, scope: Record<string, number>): number | null {
  try {
    const v: unknown = compiled(expression).evaluate({ ...scope });
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** LaTeX of an expected expression, for showing the correct answer. */
export function expressionToTex(expression: string): string {
  return parseForTex(expression).toTex({ parenthesis: 'auto', implicit: 'hide' });
}
