export {
  clampParam,
  defaultParams,
  parseParams,
  type LabModel,
  type ParamSpec,
  type ResultSpec,
  type UnitCode,
  type Values,
} from './lab-model.ts';
export { createClock, type ModelClock } from './clock.ts';
export {
  uniformMotion,
  positionAt,
  pathSeries,
  UNIFORM_MOTION_TRACK_MAX,
  type UniformMotionParams,
  type UniformMotionResults,
} from './uniform-motion.ts';
export { LAB_MODELS, LAB_CODES, labModel } from './registry.ts';
