import { describe, expect, it } from 'vitest';
import {
  checkAnswer,
  expressionToTex,
  formatNumber,
  generateTask,
  parseNumberInput,
  substitute,
  taskSpecSchema,
  taskTextsSchema,
  validateTemplate,
  type Expected,
} from './index.ts';
import { mulberry32 } from './prng.ts';

const linear = taskSpecSchema.parse({
  type: 'number',
  params: [
    { name: 'a', kind: 'int', min: -9, max: 9 },
    { name: 'b', kind: 'int', min: -20, max: 20 },
  ],
  constraints: ['a != 0'],
  answer: '-b / a',
  decimals: 2,
});
const linearTexts = taskTextsSchema.parse({
  statement: 'Решите уравнение $ {{a}}x + {{b}} = 0 $.',
  solution: '$x = -b/a$',
});

describe('generation', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    const a = generateTask(linear, linearTexts, 42, 'ru');
    const b = generateTask(linear, linearTexts, 42, 'ru');
    expect(a).toEqual(b);
    const statements = new Set(
      Array.from(
        { length: 20 },
        (_, i) => generateTask(linear, linearTexts, i + 1, 'ru').prompt.statement,
      ),
    );
    expect(statements.size).toBeGreaterThan(10);
  });

  it('respects constraints and never divides by zero', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const t = generateTask(linear, linearTexts, seed, 'ru');
      expect(t.params.a).not.toBe(0);
      expect(Number.isFinite((t.expected as { value: number }).value)).toBe(true);
    }
  });

  it('reports unsatisfiable constraints', () => {
    const bad = taskSpecSchema.parse({ ...linear, constraints: ['a > 100'] });
    expect(() => generateTask(bad, linearTexts, 1, 'ru')).toThrow(/constraints/);
  });

  it('never puts the answer into the prompt', () => {
    const choice = taskSpecSchema.parse({ type: 'single_choice', correct: 2 });
    const texts = taskTextsSchema.parse({
      statement: 'Сколько?',
      options: ['один', 'два', 'три', 'четыре'],
    });
    const t = generateTask(choice, texts, 7, 'ru');
    expect(JSON.stringify(t.prompt)).not.toContain('correct');
    const shownTexts = t.prompt.options!.map((o) => o.text);
    expect(shownTexts.sort()).toEqual(['два', 'один', 'три', 'четыре']);
    const right = t.prompt.options!.find(
      (o) => o.id === (t.expected as { correct: string }).correct,
    );
    expect(right?.text).toBe('три');
  });

  it('sandboxes template expressions', () => {
    const evil = taskSpecSchema.parse({ ...linear, answer: 'evaluate("1+1")' });
    expect(() => generateTask(evil, linearTexts, 1, 'ru')).toThrow();
  });
});

describe('formatting', () => {
  it('uses a decimal comma and LaTeX-safe commas inside math', () => {
    expect(formatNumber(3.5)).toBe('3,5');
    expect(formatNumber(-2)).toBe('−2');
    expect(substitute('a = {{a}}, $x = {{a}}$', { a: 2.5 }, 'ru')).toBe('a = 2,5, $x = 2{,}5$');
    expect(substitute('$$ {{a}} $$ и {{a}}', { a: 0.1 }, 'kk')).toBe('$$ 0{,}1 $$ и 0,1');
  });

  it('prints expected formulas as LaTeX', () => {
    expect(expressionToTex('2*(x+1)').replace(/\s/g, '')).toBe('2\\cdot\\left(x+1\\right)');
  });
});

describe('number checker', () => {
  const exp = (
    value: number,
    extra: Partial<Extract<Expected, { type: 'number' }>> = {},
  ): Expected => ({ type: 'number', value, tolerance: {}, ...extra });
  it('parses comma, point, minus signs and fractions', () => {
    expect(parseNumberInput('3,5')).toBe(3.5);
    expect(parseNumberInput('−4')).toBe(-4);
    expect(parseNumberInput('1 200')).toBe(1200);
    expect(parseNumberInput('3/4')).toBe(0.75);
    expect(parseNumberInput('3/0')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
  });
  it('applies rounding and tolerance', () => {
    expect(checkAnswer(exp(0.33, { decimals: 2 }), '0,33').status).toBe('correct');
    expect(checkAnswer(exp(0.33, { decimals: 2 }), '0,3333').status).toBe('correct');
    expect(checkAnswer(exp(0.33, { decimals: 2 }), '0,34').status).toBe('wrong');
    expect(checkAnswer(exp(9.8, { tolerance: { rel: 0.02 } }), '9,7').status).toBe('correct');
    expect(checkAnswer(exp(1), '').status).toBe('invalid');
    expect(checkAnswer(exp(1), 'один').status).toBe('invalid');
  });
});

describe('choice, ordering, matching, cloze checkers', () => {
  it('scores multi choice with partial credit', () => {
    const e: Expected = { type: 'multi_choice', correct: ['o1', 'o3'] };
    expect(checkAnswer(e, ['o3', 'o1'])).toEqual({ status: 'correct', score: 1 });
    expect(checkAnswer(e, ['o1'])).toEqual({ status: 'wrong', score: 0.5 });
    expect(checkAnswer(e, ['o1', 'o2'])).toEqual({ status: 'wrong', score: 0 });
  });
  it('checks ordering and matching', () => {
    expect(
      checkAnswer({ type: 'ordering', order: ['o2', 'o1', 'o3'] }, ['o2', 'o1', 'o3']).status,
    ).toBe('correct');
    expect(
      checkAnswer({ type: 'ordering', order: ['o2', 'o1', 'o3'] }, ['o1', 'o2', 'o3']).score,
    ).toBeCloseTo(1 / 3);
    const m: Expected = { type: 'matching', pairs: { l1: 'r2', l2: 'r1' } };
    expect(checkAnswer(m, { l1: 'r2', l2: 'r1' }).status).toBe('correct');
    expect(checkAnswer(m, { l1: 'r1', l2: 'r2' })).toEqual({ status: 'wrong', score: 0 });
    expect(checkAnswer(m, { l1: 'r2' }).status).toBe('invalid');
  });
  it('normalizes cloze answers', () => {
    const e: Expected = { type: 'cloze_word', accepted: ['гипотенуза'] };
    expect(checkAnswer(e, ' Гипотенуза. ').status).toBe('correct');
    expect(checkAnswer({ type: 'cloze_word', accepted: ['ёмкость'] }, 'емкость').status).toBe(
      'correct',
    );
    expect(checkAnswer(e, 'катет').status).toBe('wrong');
  });
});

describe('formula checker', () => {
  const e = (expression: string, variables = ['x']): Expected => ({
    type: 'formula',
    expression,
    variables,
    range: [-10, 10],
  });
  it('accepts equivalent expressions', () => {
    expect(checkAnswer(e('2*(x+1)'), '2x+2').status).toBe('correct');
    expect(checkAnswer(e('2*x+2'), '2\\left(x+1\\right)').status).toBe('correct');
    expect(checkAnswer(e('(x+1)^2'), 'x^2+2x+1').status).toBe('correct');
    expect(checkAnswer(e('x/2'), '0,5x').status).toBe('correct');
  });
  it('rejects different expressions', () => {
    expect(checkAnswer(e('x^2'), '2x').status).toBe('wrong');
    expect(checkAnswer(e('x+1'), 'x+y').status).toBe('wrong');
  });
  it('skips points outside the domain', () => {
    expect(checkAnswer(e('sqrt(x)'), '\\sqrt{x}').status).toBe('correct');
    expect(checkAnswer(e('1/x'), '\\frac{1}{x}').status).toBe('correct');
  });
  it('treats unreadable input as invalid, not wrong', () => {
    expect(checkAnswer(e('x+1'), 'x+').status).toBe('invalid');
    expect(checkAnswer(e('x+1'), '').status).toBe('invalid');
  });
  it('bakes parameters into the expected expression', () => {
    const spec = taskSpecSchema.parse({
      type: 'formula',
      params: [{ name: 'k', kind: 'int', min: 2, max: 5 }],
      answer: 'k*(x + 1)',
      variables: ['x'],
    });
    const t = generateTask(
      spec,
      taskTextsSchema.parse({ statement: 'Вынесите множитель: ${{k}}x + {{k}}$' }),
      3,
      'ru',
    );
    const k = t.params.k!;
    expect(checkAnswer(t.expected, `${k}\\left(x+1\\right)`).status).toBe('correct');
    expect(checkAnswer(t.expected, `${k + 1}x+${k + 1}`).status).toBe('wrong');
  });
});

describe('validateTemplate', () => {
  it('passes a good template and returns samples', () => {
    const r = validateTemplate(linear, { ru: linearTexts });
    expect(r.ok).toBe(true);
    expect(r.samples.length).toBe(3);
  });
  it('finds structural problems', () => {
    expect(
      validateTemplate(
        { type: 'single_choice', correct: 5 },
        { ru: { statement: 'x', options: ['a', 'b'] } },
      ).problems.map((p) => p.code),
    ).toContain('correct_out_of_range');
    expect(validateTemplate(linear, { ru: { statement: '{{c}}' } }).problems[0]?.code).toBe(
      'unknown_placeholder',
    );
    expect(
      validateTemplate(
        { type: 'cloze_word' },
        { ru: { statement: 'нет пропуска', accepted: [] } },
      ).problems.map((p) => p.code),
    ).toEqual(['cloze_gap_missing', 'cloze_no_answers']);
    expect(validateTemplate(linear, { kk: linearTexts }).problems[0]?.code).toBe('ru_missing');
    expect(
      validateTemplate({ ...linear, constraints: ['a > 100'] }, { ru: linearTexts }).problems[0]
        ?.code,
    ).toBe('generation_failed');
  });
  it('prng is uniform enough', () => {
    const r = mulberry32(1);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(r() * 4)]!++;
    for (const b of buckets) expect(b).toBeGreaterThan(850);
  });
});
