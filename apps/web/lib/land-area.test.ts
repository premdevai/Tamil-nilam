import { describe, expect, it } from 'vitest';

import {
  CENTS_PER_ACRE,
  acresToCents,
  displayArea,
  formatArea,
  perUnitPhrase,
  perUnitShort,
  perUnitTitle,
  ratePerUnit,
} from './land-area';

/**
 * Mallur figures as published in the TANSIDCO snapshot. These are the values
 * the Land Explorer shows for plot 1 / the estate header — locked here so a
 * rounding change cannot silently drift from the source.
 */
const MALLUR = {
  totalAreaAcres: 26.62,
  saleableAreaAcres: 25.041,
  roadAreaAcres: 0.602,
  plot1: { extent: 0.37, costRs: 1_869_018 },
  plot3: { extent: 0.206, costRs: 1_196_676 },
} as const;

describe('Tamil Nadu acre ↔ cent', () => {
  it('treats one acre as exactly 100 cents', () => {
    expect(CENTS_PER_ACRE).toBe(100);
    expect(acresToCents(1)).toBe(100);
    expect(acresToCents(0)).toBe(0);
  });

  it('converts published Mallur extents without float leftovers', () => {
    expect(acresToCents(MALLUR.plot1.extent)).toBe(37);
    expect(acresToCents(MALLUR.plot3.extent)).toBe(20.6);
    expect(acresToCents(0.099)).toBe(9.9);
    expect(acresToCents(MALLUR.totalAreaAcres)).toBe(2662);
    expect(acresToCents(MALLUR.saleableAreaAcres)).toBe(2504.1);
    expect(acresToCents(MALLUR.roadAreaAcres)).toBe(60.2);
  });

  it('formats area in the unit the toggle asks for', () => {
    expect(formatArea(MALLUR.plot1.extent, 'acre')).toBe('0.37 ac');
    expect(formatArea(MALLUR.plot1.extent, 'cent')).toBe('37 cent');
    expect(formatArea(MALLUR.plot3.extent, 'acre')).toBe('0.206 ac');
    expect(formatArea(MALLUR.plot3.extent, 'cent')).toBe('20.6 cent');
    expect(formatArea(MALLUR.totalAreaAcres, 'acre')).toBe('26.62 ac');
    expect(formatArea(MALLUR.totalAreaAcres, 'cent')).toBe('2,662 cent');
    expect(displayArea(MALLUR.saleableAreaAcres, 'cent')).toBe(2504.1);
  });

  it('derives per-cent rate from raw rupees-per-acre, not the rounded Lakh label', () => {
    const perAcre = MALLUR.plot1.costRs / MALLUR.plot1.extent;
    expect(perAcre).toBe(5_051_400);
    expect(ratePerUnit(perAcre, 'acre')).toBe(5_051_400);
    expect(ratePerUnit(perAcre, 'cent')).toBe(50_514);
  });

  it("leaves a plot's total price untouched — only the per-unit rate scales", () => {
    const perAcre = MALLUR.plot1.costRs / MALLUR.plot1.extent;
    expect(
      ratePerUnit(perAcre, 'cent') * acresToCents(MALLUR.plot1.extent),
    ).toBe(MALLUR.plot1.costRs);
  });

  it('labels the selected unit the same way the explorer and map popup do', () => {
    expect(perUnitPhrase('acre')).toBe('per acre');
    expect(perUnitPhrase('cent')).toBe('per cent');
    expect(perUnitShort('acre')).toBe('/ac');
    expect(perUnitShort('cent')).toBe('/cent');
    expect(perUnitTitle('acre')).toBe('Per acre');
    expect(perUnitTitle('cent')).toBe('Per cent');
  });
});
