/**
 * Tamil Nadu land measure: 1 acre is exactly 100 cents.
 *
 * TANSIDCO publishes extents in acres. Every on-screen figure converts from
 * that source number — never from an already-rounded rupee string — so
 * 0.206 ac is 20.6 cent (not a binary leftover) and a per-cent rate is the
 * raw rupees-per-acre divided by 100.
 */

export const CENTS_PER_ACRE = 100;

export type AreaUnit = 'acre' | 'cent';

export function acresToCents(acres: number): number {
  return Number((acres * CENTS_PER_ACRE).toFixed(4));
}

export function displayArea(acres: number, unit: AreaUnit): number {
  return unit === 'acre' ? acres : acresToCents(acres);
}

export function formatAreaNumber(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

export function areaSuffix(unit: AreaUnit): string {
  return unit === 'acre' ? 'ac' : 'cent';
}

export function formatArea(acres: number, unit: AreaUnit): string {
  return `${formatAreaNumber(displayArea(acres, unit))} ${areaSuffix(unit)}`;
}

/** Convert a rupees-per-acre rate into the rate for the selected unit. */
export function ratePerUnit(rupeesPerAcre: number, unit: AreaUnit): number {
  return unit === 'acre' ? rupeesPerAcre : rupeesPerAcre / CENTS_PER_ACRE;
}

export function perUnitPhrase(unit: AreaUnit): string {
  return unit === 'acre' ? 'per acre' : 'per cent';
}

export function perUnitShort(unit: AreaUnit): string {
  return unit === 'acre' ? '/ac' : '/cent';
}

export function perUnitTitle(unit: AreaUnit): string {
  return unit === 'acre' ? 'Per acre' : 'Per cent';
}
