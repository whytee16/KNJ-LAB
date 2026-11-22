import type { ParamDef, TaskSpec, TaskTexts, TaskType } from './spec.ts';
import { taskSpecSchema, taskTextsSchema } from './spec.ts';

/**
 * Studio form ⇄ template. Authors write parameters one per line:
 *   a: int -9..9
 *   h: decimal 0.5..10 step 0.5
 *   k: choice 2, 3, 5
 */
const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const num = (s: string) => Number(s.trim().replace(',', '.').replace('−', '-'));

export class EditorError extends Error {
  constructor(
    public field: string,
    public code: string,
    public line?: number,
  ) {
    super(`${field}: ${code}`);
    this.name = 'EditorError';
  }
}

export function parseParams(text: string): ParamDef[] {
  return lines(text).map((line, i) => {
    const m = line.match(/^([a-z][a-z0-9_]*)\s*:\s*(int|decimal|choice)\s+(.+)$/);
    if (!m) throw new EditorError('params', 'paramLine', i + 1);
    const [, name, kind, rest] = m as unknown as [
      string,
      string,
      'int' | 'decimal' | 'choice',
      string,
    ];
    if (kind === 'choice') {
      const values = rest
        .split(/[;,]\s*|\s+/)
        .filter(Boolean)
        .map(num);
      if (!values.length || values.some((v) => !Number.isFinite(v)))
        throw new EditorError('params', 'paramLine', i + 1);
      return { name, kind, values };
    }
    const r = rest.match(/^(-?[\d.,−]+)\s*\.\.\s*(-?[\d.,−]+)(?:\s+step\s+([\d.,]+))?$/);
    if (!r) throw new EditorError('params', 'paramLine', i + 1);
    const min = num(r[1]!);
    const max = num(r[2]!);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max)
      throw new EditorError('params', 'paramLine', i + 1);
    if (kind === 'int') {
      if (!Number.isInteger(min) || !Number.isInteger(max))
        throw new EditorError('params', 'paramLine', i + 1);
      return { name, kind, min, max };
    }
    const step = r[3] ? num(r[3]) : 0.1;
    if (!(step > 0)) throw new EditorError('params', 'paramLine', i + 1);
    return { name, kind, min, max, step };
  });
}

export function paramsToText(params: ParamDef[]): string {
  return params
    .map((p) =>
      p.kind === 'choice'
        ? `${p.name}: choice ${p.values.join(', ')}`
        : p.kind === 'int'
          ? `${p.name}: int ${p.min}..${p.max}`
          : `${p.name}: decimal ${p.min}..${p.max} step ${p.step}`,
    )
    .join('\n');
}

export interface SpecForm {
  type: TaskType;
  params: string;
  constraints: string;
  answer: string;
  decimals: string;
  toleranceAbs: string;
  tolerancePercent: string;
  unit: string;
  variables: string;
  rangeFrom: string;
  rangeTo: string;
  /** 1-based option numbers, e.g. "2" or "1, 3". */
  correct: string;
}

export function specFromForm(f: SpecForm): TaskSpec {
  const base = { type: f.type, params: parseParams(f.params), constraints: lines(f.constraints) };
  const numbers = (s: string) =>
    s
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((x) => Number(x) - 1);
  let raw: Record<string, unknown> = base;
  switch (f.type) {
    case 'number': {
      if (!f.answer.trim()) throw new EditorError('answer', 'required');
      const tolerance: { abs?: number; rel?: number } = {};
      if (f.toleranceAbs.trim()) tolerance.abs = num(f.toleranceAbs);
      if (f.tolerancePercent.trim()) tolerance.rel = num(f.tolerancePercent) / 100;
      raw = {
        ...base,
        answer: f.answer.trim(),
        tolerance,
        ...(f.decimals.trim() ? { decimals: Number(f.decimals) } : {}),
        ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
      };
      break;
    }
    case 'formula':
      if (!f.answer.trim()) throw new EditorError('answer', 'required');
      raw = {
        ...base,
        answer: f.answer.trim(),
        variables: f.variables.split(/[,\s]+/).filter(Boolean),
        range: [
          f.rangeFrom.trim() ? num(f.rangeFrom) : -10,
          f.rangeTo.trim() ? num(f.rangeTo) : 10,
        ],
      };
      break;
    case 'single_choice': {
      const [c] = numbers(f.correct);
      if (c === undefined || Number.isNaN(c)) throw new EditorError('correct', 'required');
      raw = { ...base, correct: c };
      break;
    }
    case 'multi_choice': {
      const cs = numbers(f.correct);
      if (!cs.length || cs.some(Number.isNaN)) throw new EditorError('correct', 'required');
      raw = { ...base, correct: cs };
      break;
    }
    default:
      break;
  }
  const parsed = taskSpecSchema.safeParse(raw);
  if (!parsed.success)
    throw new EditorError(String(parsed.error.issues[0]?.path[0] ?? 'spec'), 'invalid');
  return parsed.data;
}

export function specToForm(spec: TaskSpec): SpecForm {
  const f: SpecForm = {
    type: spec.type,
    params: paramsToText(spec.params),
    constraints: spec.constraints.join('\n'),
    answer: '',
    decimals: '',
    toleranceAbs: '',
    tolerancePercent: '',
    unit: '',
    variables: '',
    rangeFrom: '',
    rangeTo: '',
    correct: '',
  };
  if (spec.type === 'number') {
    f.answer = spec.answer;
    f.decimals = spec.decimals === undefined ? '' : String(spec.decimals);
    f.toleranceAbs = spec.tolerance.abs === undefined ? '' : String(spec.tolerance.abs);
    f.tolerancePercent =
      spec.tolerance.rel === undefined ? '' : String(Math.round(spec.tolerance.rel * 10000) / 100);
    f.unit = spec.unit ?? '';
  } else if (spec.type === 'formula') {
    f.answer = spec.answer;
    f.variables = spec.variables.join(', ');
    f.rangeFrom = String(spec.range[0]);
    f.rangeTo = String(spec.range[1]);
  } else if (spec.type === 'single_choice') {
    f.correct = String(spec.correct + 1);
  } else if (spec.type === 'multi_choice') {
    f.correct = spec.correct.map((c) => c + 1).join(', ');
  }
  return f;
}

export interface TextsForm {
  statement: string;
  options: string;
  matches: string;
  accepted: string;
  hints: string;
  solution: string;
}

export function textsFromForm(f: TextsForm): TaskTexts {
  const parsed = taskTextsSchema.safeParse({
    statement: f.statement.trim(),
    options: lines(f.options),
    matches: lines(f.matches),
    accepted: lines(f.accepted),
    hints: lines(f.hints),
    solution: f.solution.trim(),
  });
  if (!parsed.success)
    throw new EditorError(String(parsed.error.issues[0]?.path[0] ?? 'texts'), 'invalid');
  return parsed.data;
}

export function textsToForm(t: TaskTexts): TextsForm {
  return {
    statement: t.statement,
    options: t.options.join('\n'),
    matches: t.matches.join('\n'),
    accepted: t.accepted.join('\n'),
    hints: t.hints.join('\n'),
    solution: t.solution,
  };
}
