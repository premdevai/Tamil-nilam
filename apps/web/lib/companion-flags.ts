export const COMPANION_SLICES = [
  'memory',
  'readiness',
  'execution',
  'impact',
  'outcomes',
] as const;

export type CompanionSlice = (typeof COMPANION_SLICES)[number];

export function companionFlags(): Readonly<Record<CompanionSlice, boolean>> {
  return {
    memory: true,
    readiness: true,
    execution: true,
    impact: true,
    outcomes: true,
  };
}
