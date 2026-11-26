import { describe, expect, it } from 'vitest';
import {
  buildFigure,
  FigureError,
  figureSchema,
  generateTask,
  taskSpecSchema,
  validateTemplate,
  type Prim,
} from './index.ts';

const texts = (s: Prim[]) => s.filter((p) => p.t === 'text').map((p) => (p as { s: string }).s);
const poly = (s: Prim[]) => s.find((p) => p.t === 'poly') as { pts: [number, number][] };

describe('figures', () => {
  it('a right triangle is drawn to scale with the given labels', () => {
    const f = figureSchema.parse({
      kind: 'right_triangle',
      a: 'a',
      b: 'b',
      labels: { a: '{{a}} см', b: '{{b}} см', c: '?' },
      vertices: ['A', 'B', 'C'],
    });
    const scene = buildFigure(f, { a: 3, b: 4 }, 'ru');
    const [A, B, C] = poly(scene.prims).pts;
    expect(Math.hypot(A![0] - B![0], A![1] - B![1])).toBeCloseTo(5, 12);
    expect(C).toEqual([0, 0]);
    expect(texts(scene.prims)).toEqual(
      expect.arrayContaining(['3 см', '4 см', '?', 'A', 'B', 'C']),
    );
    // The answer (5) is never written on the figure.
    expect(texts(scene.prims).join(' ')).not.toContain('5');
  });

  it('a triangle by three sides keeps the side lengths; an impossible one is refused', () => {
    const f = figureSchema.parse({ kind: 'triangle', a: 7, b: 5, c: 6 });
    const [A, B, C] = poly(buildFigure(f, {}, 'ru').prims).pts;
    const d = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!);
    expect(d(B!, C!)).toBeCloseTo(7, 12);
    expect(d(A!, C!)).toBeCloseTo(5, 12);
    expect(d(A!, B!)).toBeCloseTo(6, 12);
    expect(() =>
      buildFigure(figureSchema.parse({ kind: 'triangle', a: 1, b: 2, c: 5 }), {}, 'ru'),
    ).toThrow(FigureError);
  });

  it('quadrilaterals, circles, plots and physics drawings build', () => {
    const specs = [
      { kind: 'quad', shape: 'trapezoid', a: 10, top: 6, h: 4, height: true, labels: { h: 'h' } },
      { kind: 'quad', shape: 'parallelogram', a: 8, b: 5, angle: 60, diagonals: true },
      {
        kind: 'circle',
        r: 5,
        chord: 100,
        central: true,
        inscribed: true,
        labels: { central: '{{c}}°', inscribed: '?' },
      },
      { kind: 'circle', r: 3, tangent: true, labels: { r: 'r' } },
      {
        kind: 'plot',
        x: [-4, 4],
        functions: [{ expr: 'k * x + b', label: 'y = kx + b' }],
        points: [{ x: 0, y: 'b' }],
        axes: { x: 'x', y: 'y' },
      },
      { kind: 'plot', x: [-5, 5], y: [-6, 6], functions: [{ expr: '6 / x' }] },
      {
        kind: 'forces',
        surface: 'incline',
        incline: 30,
        forces: [
          { angle: -90, size: 20, label: 'mg' },
          { angle: 120, size: 17, label: 'N' },
        ],
      },
      { kind: 'lever', left: 'l1', right: 2, labels: { f1: 'F₁', f2: '?' } },
      { kind: 'vessel', h: 50, body: { size: 10, depth: 15 }, labels: { h: 'h' } },
      {
        kind: 'circuit',
        mode: 'parallel',
        resistors: ['R₁', 'R₂'],
        ammeter: true,
        voltmeter: 'total',
      },
      { kind: 'circuit', mode: 'series', resistors: ['R₁', 'R₂', 'R₃'], voltmeter: 'first' },
    ];
    for (const s of specs) {
      const scene = buildFigure(figureSchema.parse(s), { c: 100, k: 2, b: 1, l1: 3 }, 'ru');
      expect(scene.prims.length, s.kind).toBeGreaterThan(2);
      for (const p of scene.prims)
        for (const v of JSON.stringify(p).match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? [])
          expect(Number.isFinite(Number(v))).toBe(true);
    }
    // The hyperbola is split at x = 0: no line jumps across the asymptote.
    const hyper = buildFigure(figureSchema.parse(specs[5]), {}, 'ru').prims.filter(
      (p) => p.t === 'poly',
    );
    expect(hyper.length).toBe(2);
    for (const h of hyper as { pts: [number, number][] }[])
      for (const [, y] of h.pts) expect(y >= -1e-9 && y <= 7 + 1e-9).toBe(true);
  });

  it('a body that does not fit the vessel is refused', () => {
    expect(() =>
      buildFigure(
        figureSchema.parse({ kind: 'vessel', h: 10, body: { size: 8, depth: 5 } }),
        {},
        'ru',
      ),
    ).toThrow(FigureError);
  });

  it('generated tasks carry the figure; templates with impossible figures fail validation', () => {
    const spec = taskSpecSchema.parse({
      type: 'number',
      params: [
        { name: 'a', kind: 'int', min: 3, max: 9 },
        { name: 'b', kind: 'int', min: 3, max: 9 },
      ],
      answer: 'sqrt(a^2 + b^2)',
      decimals: 2,
      figure: {
        kind: 'right_triangle',
        a: 'a',
        b: 'b',
        labels: { a: '{{a}}', b: '{{b}}', c: 'c = ?' },
      },
    });
    const t = generateTask(
      spec,
      {
        statement: 'Катеты {{a}} и {{b}}. Найдите гипотенузу.',
        hints: [],
        options: [],
        solution: 'c',
      } as never,
      7,
      'ru',
    );
    expect(t.prompt.figure?.kind).toBe('right_triangle');
    expect(texts(t.prompt.figure!.prims)).toContain('c = ?');

    const bad = validateTemplate(
      {
        type: 'number',
        params: [
          { name: 'a', kind: 'int', min: 1, max: 3 },
          { name: 'b', kind: 'int', min: 1, max: 3 },
          { name: 'c', kind: 'int', min: 7, max: 9 },
        ],
        answer: 'a + b + c',
        figure: { kind: 'triangle', a: 'a', b: 'b', c: 'c' },
      },
      { ru: { statement: 'Стороны {{a}}, {{b}}, {{c}}.', hints: [], solution: 'P' } },
    );
    expect(bad.ok).toBe(false);
  });
});
