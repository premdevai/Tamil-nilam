import { describe, expect, it } from 'vitest';

import { COMPANION_SLICES, companionFlags } from './companion-flags';

describe('companion slices', () => {
  it('keeps every project companion slice on as core product', () => {
    expect(companionFlags()).toEqual({
      memory: true,
      readiness: true,
      execution: true,
      impact: true,
      outcomes: true,
    });
    expect(COMPANION_SLICES).toEqual([
      'memory',
      'readiness',
      'execution',
      'impact',
      'outcomes',
    ]);
  });
});
