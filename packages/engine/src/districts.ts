import { TAMIL_NADU_DISTRICTS } from './types';

export type TamilNaduDistrict = (typeof TAMIL_NADU_DISTRICTS)[number];

/**
 * Snapshot and colloquial spellings that are not the engine district enum.
 * Matching must use these aliases or ranked land and the Matcher silently
 * miss each other.
 */
export const DISTRICT_ALIASES = {
  Trichy: 'Tiruchirappalli',
  Tiruchi: 'Tiruchirappalli',
  Tiruchirapalli: 'Tiruchirappalli',
  Kanchipuram: 'Kancheepuram',
  Villupuram: 'Viluppuram',
  Thirupathur: 'Tirupathur',
  Thiruvarur: 'Tiruvarur',
  Sivagangai: 'Sivaganga',
} as const satisfies Readonly<Record<string, TamilNaduDistrict>>;

const CANONICAL_BY_LOWER = new Map<string, TamilNaduDistrict>([
  ...TAMIL_NADU_DISTRICTS.map(
    (district) => [district.toLowerCase(), district] as const,
  ),
  ...Object.entries(DISTRICT_ALIASES).map(
    ([alias, district]) => [alias.toLowerCase(), district] as const,
  ),
]);

export function canonicalizeDistrict(
  raw: string,
): TamilNaduDistrict | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  return CANONICAL_BY_LOWER.get(trimmed.toLowerCase());
}

export function districtsMatch(left: string, right: string): boolean {
  const canonicalLeft = canonicalizeDistrict(left);
  const canonicalRight = canonicalizeDistrict(right);
  return (
    canonicalLeft !== undefined &&
    canonicalRight !== undefined &&
    canonicalLeft === canonicalRight
  );
}
