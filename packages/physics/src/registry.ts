import type { LabModel } from './lab-model.ts';
import { circuit } from './circuit.ts';
import { inclinedPlane } from './inclined-plane.ts';
import { pendulum } from './pendulum.ts';
import { springPendulum } from './spring.ts';
import { projectile } from './projectile.ts';
import { uniformMotion } from './uniform-motion.ts';

/** Lab models by `labs.code`. A lab row without a model here cannot be opened. */
export const LAB_MODELS: Record<string, LabModel> = {
  [uniformMotion.code]: uniformMotion as unknown as LabModel,
  [projectile.code]: projectile as unknown as LabModel,
  [inclinedPlane.code]: inclinedPlane as unknown as LabModel,
  [pendulum.code]: pendulum as unknown as LabModel,
  [springPendulum.code]: springPendulum as unknown as LabModel,
  [circuit.code]: circuit as unknown as LabModel,
};

export const LAB_CODES = Object.keys(LAB_MODELS);

export function labModel(code: string): LabModel | null {
  return Object.hasOwn(LAB_MODELS, code) ? LAB_MODELS[code]! : null;
}
