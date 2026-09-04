import { describe, expect, it } from 'vitest';

import {
  estateSlug,
  getPublicLandCatalog,
  getPublicLandEstate,
  landForDistrict,
  publicLandSlugs,
} from './tansidco-estates';

describe('TANSIDCO public land catalog', () => {
  it('exposes the vacancy snapshot plus leftover directory stubs', () => {
    const catalog = getPublicLandCatalog();
    expect(catalog.length).toBeGreaterThan(80);
    expect(
      catalog.filter((estate) => estate.dataQuality === 'vacancy-snapshot')
        .length,
    ).toBe(85);
    expect(getPublicLandEstate('guindy-industrial-estate')?.name).toBe(
      'Guindy',
    );
    expect(
      getPublicLandEstate(estateSlug('Guindy', 'Chennai'))?.vacantTotal,
    ).toBe(19);
    expect(getPublicLandEstate('hosur-industrial-complex')?.agency).toBe(
      'sipcot',
    );
    expect(getPublicLandEstate('hosur-industrial-complex')?.dataQuality).toBe(
      'directory-only',
    );
    expect(publicLandSlugs()).toContain('guindy-industrial-estate');
  });

  it('canonicalizes snapshot district spellings on public pages', () => {
    const trichy = getPublicLandCatalog().find(
      (estate) => estate.district === 'Tiruchirappalli',
    );
    expect(trichy).toBeDefined();
    expect(landForDistrict('Trichy').length).toBeGreaterThan(0);
  });
});
