import { z } from 'zod';

import { FALLBACK_ESTATES } from './public-data';

const PlotStatusSchema = z.enum([
  'vacant',
  'allotted',
  'litigation',
  'reserved',
  'pending_cancel',
  'unknown',
]);

const boundsSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/u)
  .transform(
    (value) => value.split(',').map(Number) as [number, number, number, number],
  )
  .refine(
    ([west, south, east, north]) =>
      west >= 67 &&
      east <= 99 &&
      south >= 5 &&
      north <= 38 &&
      west < east &&
      south < north,
    'Bounds must be a valid India-area west,south,east,north box',
  );

export const LandFilterSchema = z
  .object({
    district: z.string().trim().min(1).max(80).optional(),
    agency: z.enum(['tansidco', 'sipcot']).optional(),
    status: z
      .union([PlotStatusSchema, z.array(PlotStatusSchema)])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .optional(),
    minAreaCents: z.coerce.number().nonnegative().max(1_000_000).optional(),
    maxAreaCents: z.coerce.number().positive().max(1_000_000).optional(),
    bounds: boundsSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict()
  .refine(
    ({ minAreaCents, maxAreaCents }) =>
      minAreaCents === undefined ||
      maxAreaCents === undefined ||
      minAreaCents <= maxAreaCents,
    { message: 'minAreaCents cannot exceed maxAreaCents' },
  );

export type LandFilters = z.infer<typeof LandFilterSchema>;

export type LandFeature = {
  readonly type: 'Feature';
  readonly geometry:
    | {
        readonly type: 'Point';
        readonly coordinates: readonly [number, number];
      }
    | {
        readonly type: 'Polygon' | 'MultiPolygon';
        readonly coordinates: unknown;
      };
  readonly properties: {
    readonly id: string;
    readonly estateSlug: string;
    readonly estateName: string;
    readonly estateNameTa: string | null;
    readonly district: string;
    readonly agency: string;
    readonly plotNumber: string | null;
    readonly areaCents: number | null;
    readonly status:
      | 'vacant'
      | 'allotted'
      | 'litigation'
      | 'reserved'
      | 'pending_cancel'
      | 'unknown';
    readonly sourceUrl: string;
    readonly verifiedOn: string;
    readonly sourceSyncedAt: string;
    readonly dataQuality: 'verified-plot' | 'directory-only';
  };
};

export type LandResponse = {
  readonly type: 'FeatureCollection';
  readonly mode: 'postgis' | 'fallback';
  readonly notice: string;
  readonly generatedAt: string;
  readonly features: readonly LandFeature[];
};

export function fallbackLandResponse(filters: LandFilters): LandResponse {
  const features = FALLBACK_ESTATES.filter(
    (estate) =>
      (filters.district === undefined ||
        estate.district.toLowerCase() === filters.district.toLowerCase()) &&
      (filters.agency === undefined || estate.agency === filters.agency) &&
      (filters.status === undefined || filters.status.includes('unknown')),
  )
    .slice(0, filters.limit)
    .map((estate): LandFeature => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [estate.longitude, estate.latitude],
      },
      properties: {
        id: estate.id,
        estateSlug: estate.slug,
        estateName: estate.name,
        estateNameTa: estate.nameTa,
        district: estate.district,
        agency: estate.agency,
        plotNumber: null,
        areaCents: null,
        status: 'unknown',
        sourceUrl: estate.sourceUrl,
        verifiedOn: estate.verifiedOn,
        sourceSyncedAt: estate.sourceSyncedAt,
        dataQuality: 'directory-only',
      },
    }));

  return {
    type: 'FeatureCollection',
    mode: 'fallback',
    notice:
      'Verified plot geometry is unavailable. Showing directory-only estate points; availability, boundaries and rates remain unknown.',
    generatedAt: new Date().toISOString(),
    features,
  };
}
