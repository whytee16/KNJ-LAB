import { evalCondition, evalNumber } from './expr.ts';
import { substitute, type EngineLocale } from './format.ts';
import { mulberry32, randomInt, shuffle } from './prng.ts';
import type { ParamDef, TaskSpec, TaskTexts, TaskType } from './spec.ts';

/** What the student sees. Never contains the answer. */
export interface TaskPrompt {
  type: TaskType;
  statement: string;
  /** Choice / ordering items in display order, with opaque ids. */
  options?: { id: string; text: string }[];
  /** Matching: left items (fixed order) and right items (shuffled). */
  left?: { id: string; text: string }[];
  right?: { id: string; text: string }[];
  unit?: string;
  variables?: string[];
  hints: string[];
}

/** Stored server-side only (task_instance_keys). */
export type Expected =
  | { type: 'single_choice'; correct: string }
  | { type: 'multi_choice'; correct: string[] }
  | {
      type: 'number';
      value: number;
      decimals?: number;
      tolerance: { abs?: number; rel?: number };
      unit?: string;
    }
  | { type: 'formula'; expression: string; variables: string[]; range: [number, number] }
  | { type: 'cloze_word'; accepted: string[] }
  | { type: 'matching'; pairs: Record<string, string> }
  | { type: 'ordering'; order: string[] };

export interface GeneratedTask {
  params: Record<string, number>;
  prompt: TaskPrompt;
  expected: Expected;
  solution: string;
}

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

const MAX_TRIES = 200;

function drawParam(p: ParamDef, rand: () => number): number {
  if (p.kind === 'int') return randomInt(rand, Math.min(p.min, p.max), Math.max(p.min, p.max));
  if (p.kind === 'choice') return p.values[Math.floor(rand() * p.values.length)]!;
  const steps = Math.floor((p.max - p.min) / p.step + 1e-9);
  const k = randomInt(rand, 0, Math.max(0, steps));
  return Math.round((p.min + k * p.step) * 1e9) / 1e9;
}

/** Picks parameters satisfying all constraints (deterministic for a seed). */
export function drawParams(spec: TaskSpec, rand: () => number): Record<string, number> {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const params: Record<string, number> = {};
    for (const p of spec.params) params[p.name] = drawParam(p, rand);
    if (spec.constraints.every((c) => evalCondition(c, params))) return params;
  }
  throw new GenerationError(`constraints not satisfiable in ${MAX_TRIES} tries`);
}

function roundTo(v: number, decimals?: number): number {
  if (decimals === undefined) return v;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Builds a task instance from a template for one locale and seed. */
export function generateTask(
  spec: TaskSpec,
  texts: TaskTexts,
  seed: number,
  locale: EngineLocale,
): GeneratedTask {
  const rand = mulberry32(seed);
  const params = drawParams(spec, rand);
  const sub = (s: string) => substitute(s, params, locale);
  const prompt: TaskPrompt = {
    type: spec.type,
    statement: sub(texts.statement),
    hints: texts.hints.map(sub),
  };
  let expected: Expected;

  switch (spec.type) {
    case 'number': {
      const value = roundTo(evalNumber(spec.answer, params), spec.decimals);
      expected = {
        type: 'number',
        value,
        decimals: spec.decimals,
        tolerance: spec.tolerance,
        unit: spec.unit,
      };
      if (spec.unit) prompt.unit = spec.unit;
      break;
    }
    case 'formula': {
      // Bake parameters into the expected expression; variables stay symbolic.
      const expression = spec.answer.replace(/\b([a-z][a-z0-9_]*)\b/g, (m) =>
        m in params && !spec.variables.includes(m) ? `(${params[m]})` : m,
      );
      expected = { type: 'formula', expression, variables: spec.variables, range: spec.range };
      prompt.variables = spec.variables;
      break;
    }
    case 'single_choice':
    case 'multi_choice': {
      const indexed = texts.options.map((text, index) => ({ index, text: sub(text) }));
      const shown = shuffle(indexed, rand).map((o, i) => ({ ...o, id: `o${i + 1}` }));
      prompt.options = shown.map(({ id, text }) => ({ id, text }));
      const idOf = (index: number) => {
        const found = shown.find((o) => o.index === index);
        if (!found) throw new GenerationError(`correct option ${index} does not exist`);
        return found.id;
      };
      expected =
        spec.type === 'single_choice'
          ? { type: 'single_choice', correct: idOf(spec.correct) }
          : { type: 'multi_choice', correct: spec.correct.map(idOf).sort() };
      break;
    }
    case 'ordering': {
      const items = texts.options.map((text, index) => ({ index, text: sub(text) }));
      let shown = shuffle(items, rand);
      if (items.length > 1 && shown.every((o, i) => o.index === i))
        shown = [...shown.slice(1), shown[0]!];
      const withIds = shown.map((o, i) => ({ ...o, id: `o${i + 1}` }));
      prompt.options = withIds.map(({ id, text }) => ({ id, text }));
      expected = {
        type: 'ordering',
        order: [...withIds].sort((a, b) => a.index - b.index).map((o) => o.id),
      };
      break;
    }
    case 'matching': {
      if (texts.options.length !== texts.matches.length)
        throw new GenerationError('matching columns differ in length');
      prompt.left = texts.options.map((text, i) => ({ id: `l${i + 1}`, text: sub(text) }));
      const right = shuffle(
        texts.matches.map((text, index) => ({ index, text: sub(text) })),
        rand,
      ).map((o, i) => ({ ...o, id: `r${i + 1}` }));
      prompt.right = right.map(({ id, text }) => ({ id, text }));
      const pairs: Record<string, string> = {};
      for (const r of right) pairs[`l${r.index + 1}`] = r.id;
      expected = { type: 'matching', pairs };
      break;
    }
    case 'cloze_word':
      expected = { type: 'cloze_word', accepted: texts.accepted.map(sub) };
      break;
  }
  return { params, prompt, expected, solution: sub(texts.solution) };
}
