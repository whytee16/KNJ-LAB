/**
 * Refractive indices for visible light (typical table values of school physics reference books:
 * water 1,33, glass 1,5, diamond 2,42; air is taken as 1,00).
 */
export const MEDIA = {
  air: 1,
  water: 1.33,
  glass: 1.5,
  diamond: 2.42,
} as const;
export type Medium = keyof typeof MEDIA;

/** Pairs of media offered in the refraction lab (light goes from the first into the second). */
export const MEDIA_PAIRS: { key: string; from: Medium; to: Medium }[] = [
  { key: 'airWater', from: 'air', to: 'water' },
  { key: 'airGlass', from: 'air', to: 'glass' },
  { key: 'airDiamond', from: 'air', to: 'diamond' },
  { key: 'waterAir', from: 'water', to: 'air' },
  { key: 'glassAir', from: 'glass', to: 'air' },
];
