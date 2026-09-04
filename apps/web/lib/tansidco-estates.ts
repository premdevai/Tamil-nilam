import { canonicalizeDistrict, districtsMatch } from '@nilam/engine';

import snapshot from '../data/tansidco.json';
import { FALLBACK_ESTATES, type PublicEstate } from './public-data';

const SNAPSHOT_SOURCE = 'https://tansidco.org/Home/vacant_chart';
const TANSIDCO_APPLY = 'https://www.tansidco.tn.gov.in/';

export type PublicLandEstate = {
  readonly id: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly name: string;
  readonly nameTa: string;
  readonly agency: 'tansidco' | 'sipcot';
  readonly district: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly sourceUrl: string;
  readonly verifiedOn: string;
  readonly sourceSyncedAt: string;
  readonly dataQuality: 'directory-only' | 'vacancy-snapshot';
  readonly plotStatus: 'unknown' | 'listed-vacant';
  readonly vacantTotal: number | null;
  readonly block: string | null;
  readonly backward: boolean;
  readonly summary: string;
  readonly snapshotId: number | null;
};

type SnapshotEstate = {
  readonly id: number;
  readonly name: string;
  readonly district: string;
  readonly block: string | null;
  readonly backward: boolean;
  readonly vacant: { readonly total: number };
  readonly coords: { readonly lat: number; readonly lon: number } | null;
};

type SnapshotFile = {
  readonly source: string;
  readonly fetchedAt: string;
  readonly note: string;
  readonly estates: readonly SnapshotEstate[];
};

const SLUG_ALIASES: Readonly<Record<string, number>> = {
  'guindy-industrial-estate': 4,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '');
}

export function estateSlug(name: string, district: string): string {
  return `${slugify(name)}-${slugify(district)}`;
}

function readSnapshot(): SnapshotFile {
  return snapshot as SnapshotFile;
}

function toLandEstate(
  estate: SnapshotEstate,
  fetchedAt: string,
): PublicLandEstate {
  const district = canonicalizeDistrict(estate.district) ?? estate.district;
  const slug = estateSlug(estate.name, district);
  const aliases = Object.entries(SLUG_ALIASES)
    .filter(([, snapshotId]) => snapshotId === estate.id)
    .map(([alias]) => alias);
  const date = fetchedAt.slice(0, 10);
  return {
    id: `tansidco-${String(estate.id)}`,
    slug,
    aliases,
    name: estate.name,
    nameTa: estate.name,
    agency: 'tansidco',
    district,
    latitude: estate.coords?.lat ?? null,
    longitude: estate.coords?.lon ?? null,
    sourceUrl: SNAPSHOT_SOURCE,
    verifiedOn: date,
    sourceSyncedAt: fetchedAt,
    dataQuality: 'vacancy-snapshot',
    plotStatus: 'listed-vacant',
    vacantTotal: estate.vacant.total,
    block: estate.block,
    backward: estate.backward,
    summary: `${estate.vacant.total} vacant units on the TANSIDCO vacancy chart as of ${date}. Confirm written availability before paying EMD. This is not a complete TANSIDCO, SIPCOT or SIDCO registry.`,
    snapshotId: estate.id,
  };
}

function fallbackToLand(estate: PublicEstate): PublicLandEstate {
  return {
    id: estate.id,
    slug: estate.slug,
    aliases: [],
    name: estate.name,
    nameTa: estate.nameTa,
    agency: estate.agency,
    district: estate.district,
    latitude: estate.latitude,
    longitude: estate.longitude,
    sourceUrl: estate.sourceUrl,
    verifiedOn: estate.verifiedOn,
    sourceSyncedAt: estate.sourceSyncedAt,
    dataQuality: 'directory-only',
    plotStatus: 'unknown',
    vacantTotal: null,
    block: null,
    backward: false,
    summary: estate.summary,
    snapshotId: null,
  };
}

let cached: readonly PublicLandEstate[] | undefined;

export function getPublicLandCatalog(): readonly PublicLandEstate[] {
  if (cached !== undefined) return cached;
  const snapshot = readSnapshot();
  const fromSnapshot = snapshot.estates.map((estate) =>
    toLandEstate(estate, snapshot.fetchedAt),
  );
  const covered = new Set(
    fromSnapshot.flatMap((estate) => [estate.slug, ...estate.aliases]),
  );
  const extras = FALLBACK_ESTATES.filter(
    (estate) => !covered.has(estate.slug),
  ).map(fallbackToLand);
  cached = [...fromSnapshot, ...extras];
  return cached;
}

export function getPublicLandEstate(
  slug: string,
): PublicLandEstate | undefined {
  return getPublicLandCatalog().find(
    (estate) => estate.slug === slug || estate.aliases.includes(slug),
  );
}

export function publicLandSlugs(): readonly string[] {
  return [
    ...new Set(
      getPublicLandCatalog().flatMap((estate) => [
        estate.slug,
        ...estate.aliases,
      ]),
    ),
  ];
}

export function landForDistrict(district: string): readonly PublicLandEstate[] {
  return getPublicLandCatalog()
    .filter((estate) => districtsMatch(estate.district, district))
    .slice()
    .sort(
      (left, right) => (right.vacantTotal ?? -1) - (left.vacantTotal ?? -1),
    );
}

export function tansidcoApplyUrl(): string {
  return TANSIDCO_APPLY;
}

export function snapshotFetchedAt(): string {
  return readSnapshot().fetchedAt;
}
