import { z } from 'zod';
import type { LabModel, ResultSpec, Values } from '../lab-model.ts';
import type { ForceVec } from '../mechanics/index.ts';

/** Generic scene layouts drawn by the app; a new scenario reuses one of them. */
export const LAYOUTS = ['atwood', 'table-pulley', 'lamp', 'elevator'] as const;
export type Layout = (typeof LAYOUTS)[number];

export interface ScenarioChart {
  id: string;
  x: { symbol: string; unit: ResultSpec['unit'] };
  y: { symbol: string; unit: ResultSpec['unit'] };
  series: { x: number; y: number }[];
  xMax: number;
  yMax: number;
  marker?: { x: number; y: number };
}

/**
 * A mechanics lab described as data on top of the shared solvers (ADR-0010): parameters and results
 * like any lab model, plus a layout for the generic views, motion in time, forces for the diagram,
 * a status line and charts. No drawing code per scenario.
 */
export interface Scenario<P extends Values = Values, R extends Values = Values> extends LabModel<
  P,
  R
> {
  layout: Layout;
  /** Seconds of motion after "Run"; 0 — a static scene (no Run button). */
  duration(p: P): number;
  /** Displacement of the moving body (m) and live readouts at model time τ. */
  state(p: P, tau: number): { s: number; live: Values };
  liveSpecs: Record<string, ResultSpec>;
  /** Forces for the free-body diagram (scene coordinates, newtons). */
  forces(p: P): ForceVec[];
  /** Status line: i18n key suffix and values to insert. */
  status(p: P): { key: string; values: Record<string, number | undefined> };
  charts(p: P, tau: number): ScenarioChart[];
}

const paramSpec = z
  .object({
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    default: z.number(),
    unit: z.string(),
    symbol: z.string(),
    choices: z.array(z.object({ value: z.number(), key: z.string().min(1) })).optional(),
  })
  .refine((s) => s.min < s.max && s.default >= s.min && s.default <= s.max, 'range');

/** Serializable part of a scenario, checked for every registered scenario. */
export const scenarioSchema = z.object({
  code: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  layout: z.enum(LAYOUTS),
  params: z.record(z.string(), paramSpec),
  results: z.record(
    z.string(),
    z.object({ unit: z.string(), symbol: z.string(), digits: z.number().int().min(0) }),
  ),
  liveSpecs: z.record(
    z.string(),
    z.object({ unit: z.string(), symbol: z.string(), digits: z.number().int().min(0) }),
  ),
  assumptions: z.array(z.string().regex(/^labs\.assumptions\.[a-zA-Z]+$/)).min(1),
});
