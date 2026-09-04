import { describe, expect, it } from 'vitest';

import { LandFilterSchema, fallbackLandResponse } from './land-contract';

describe('public land filter contract', () => {
  it('accepts bounded PostGIS filters and repeated statuses', () => {
    const filters = LandFilterSchema.parse({
      district: 'Coimbatore',
      agency: 'tansidco',
      status: ['vacant', 'unknown'],
      minAreaCents: '25',
      maxAreaCents: '500',
      bounds: '76,10,78,12',
      limit: '50',
    });

    expect(filters.bounds).toEqual([76, 10, 78, 12]);
    expect(filters.status).toEqual(['vacant', 'unknown']);
    expect(filters.limit).toBe(50);
  });

  it('rejects inverted area and unsafe bounds', () => {
    expect(() =>
      LandFilterSchema.parse({
        minAreaCents: 500,
        maxAreaCents: 50,
        bounds: '-180,-90,180,90',
      }),
    ).toThrow();
  });

  it('never promotes fallback directory entries to vacant plots', () => {
    const response = fallbackLandResponse(
      LandFilterSchema.parse({ status: 'unknown' }),
    );

    expect(response.mode).toBe('fallback');
    expect(response.features.length).toBeGreaterThan(0);
    expect(
      response.features.every(
        ({ properties }) =>
          properties.status === 'unknown' &&
          properties.dataQuality === 'directory-only' &&
          properties.areaCents === null,
      ),
    ).toBe(true);
  });
});
