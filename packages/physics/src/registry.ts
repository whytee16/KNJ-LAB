import type { LabModel } from './lab-model.ts';
import { uniformMotion } from './uniform-motion.ts';

/** Lab models by `labs.code`. A lab row without a model here cannot be opened. */
export const LAB_MODELS: Record<string, LabModel> = {
  [uniformMotion.code]: uniformMotion as unknown as LabModel,
};

export const LAB_CODES = Object.keys(LAB_MODELS);

export function labModel(code: string): LabModel | null {
  return Object.hasOwn(LAB_MODELS, code) ? LAB_MODELS[code]! : null;
}
