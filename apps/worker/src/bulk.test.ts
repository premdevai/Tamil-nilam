import { describe, expect, it } from 'vitest';

import { matcherInputFromBulkRow } from './bulk';

describe('bulk stack import', () => {
  it('maps rupee project costs into matcher lakhs with defaults', () => {
    const input = matcherInputFromBulkRow({
      businessName: 'Kaveri Foods',
      sector: 'food-processing',
      district: 'Thanjavur',
      projectCost: '2500000',
    });
    expect(input.projectCostLakhs).toBe(25);
    expect(input.district).toBe('Thanjavur');
    expect(input.sector).toBe('food-processing');
  });
});
