import { describe, expect, it } from 'vitest';

import { canonicalizeDistrict, districtsMatch } from '../src/districts';

describe('district aliases', () => {
  it('maps TANSIDCO snapshot spellings onto the engine enum', () => {
    expect(canonicalizeDistrict('Trichy')).toBe('Tiruchirappalli');
    expect(canonicalizeDistrict('Kanchipuram')).toBe('Kancheepuram');
    expect(canonicalizeDistrict('Villupuram')).toBe('Viluppuram');
    expect(canonicalizeDistrict('Thirupathur')).toBe('Tirupathur');
    expect(canonicalizeDistrict('Thiruvarur')).toBe('Tiruvarur');
  });

  it('treats snapshot and official names as the same district', () => {
    expect(districtsMatch('Trichy', 'Tiruchirappalli')).toBe(true);
    expect(districtsMatch('thanjavur', 'Thanjavur')).toBe(true);
    expect(districtsMatch('Trichy', 'Thanjavur')).toBe(false);
    expect(districtsMatch('Not a district', 'Thanjavur')).toBe(false);
  });
});
