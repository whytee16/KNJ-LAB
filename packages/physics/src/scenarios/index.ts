import type { Scenario } from './types.ts';
import { atwood, blockPulley } from './chain-scenarios.ts';
import { elevatorScales } from './elevator.ts';
import { lampTwoRopes } from './lamp.ts';

export {
  scenarioSchema,
  LAYOUTS,
  type Layout,
  type Scenario,
  type ScenarioChart,
} from './types.ts';
export { atwood, blockPulley, elevatorScales, lampTwoRopes };

/** All mechanics scenarios; registered as lab models by code. */
export const SCENARIOS: Scenario[] = [
  elevatorScales,
  lampTwoRopes,
  blockPulley,
  atwood,
] as unknown as Scenario[];

export function scenarioFor(code: string): Scenario | null {
  return SCENARIOS.find((s) => s.code === code) ?? null;
}
