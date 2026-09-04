import { Pool } from 'pg';

import type { LandFeature, LandFilters, LandResponse } from './land-contract';

type LandRow = {
  id: string;
  estate_slug: string;
  estate_name: string;
  estate_name_ta: string | null;
  district: string;
  agency: string;
  plot_number: string;
  area_cents: string | null;
  status: LandFeature['properties']['status'];
  source_url: string;
  verified_on: string | Date;
  source_synced_at: string | Date;
  geometry: LandFeature['geometry'];
};

export async function queryPostgisLand(
  filters: LandFilters,
): Promise<LandResponse> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured');
  }

  const clauses = ['coalesce(p.geom, e.centroid) is not null'];
  const values: unknown[] = [];
  const bind = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.district !== undefined) {
    clauses.push(`lower(e.district) = lower(${bind(filters.district)})`);
  }
  if (filters.agency !== undefined) {
    clauses.push(`a.slug = ${bind(filters.agency)}`);
  }
  if (filters.status !== undefined) {
    clauses.push(`p.status = any(${bind(filters.status)}::plot_status[])`);
  }
  if (filters.minAreaCents !== undefined) {
    clauses.push(`p.area_cents >= ${bind(filters.minAreaCents)}`);
  }
  if (filters.maxAreaCents !== undefined) {
    clauses.push(`p.area_cents <= ${bind(filters.maxAreaCents)}`);
  }
  if (filters.bounds !== undefined) {
    const [west, south, east, north] = filters.bounds;
    clauses.push(
      `st_intersects(coalesce(p.geom, e.centroid), st_makeenvelope(${bind(west)}, ${bind(south)}, ${bind(east)}, ${bind(north)}, 4326)::geography)`,
    );
  }
  const limit = bind(filters.limit);
  if (!databaseUrl.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
    max: 2,
  });

  try {
    const result = await pool.query<LandRow>(
      `select
        p.id::text,
        e.slug as estate_slug,
        e.name as estate_name,
        e.name_ta as estate_name_ta,
        e.district,
        a.slug as agency,
        p.plot_number,
        p.area_cents::text,
        p.status,
        e.source_url,
        e.verified_on,
        p.source_synced_at,
        st_asgeojson(coalesce(p.geom, e.centroid))::json as geometry
      from plots p
      join estates e on e.id = p.estate_id
      join agencies a on a.id = e.agency_id
      where ${clauses.join(' and ')}
      order by
        case p.status when 'vacant' then 0 when 'unknown' then 1 else 2 end,
        p.source_synced_at desc,
        e.slug,
        p.plot_number
      limit ${limit}`,
      values,
    );

    return {
      type: 'FeatureCollection',
      mode: 'postgis',
      notice:
        'Plot facts come from published database records. Confirm current availability and price with the cited agency before acting.',
      generatedAt: new Date().toISOString(),
      features: result.rows.map((row): LandFeature => ({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          id: row.id,
          estateSlug: row.estate_slug,
          estateName: row.estate_name,
          estateNameTa: row.estate_name_ta,
          district: row.district,
          agency: row.agency,
          plotNumber: row.plot_number,
          areaCents: row.area_cents === null ? null : Number(row.area_cents),
          status: row.status,
          sourceUrl: row.source_url,
          verifiedOn: new Date(row.verified_on).toISOString().slice(0, 10),
          sourceSyncedAt: new Date(row.source_synced_at).toISOString(),
          dataQuality: 'verified-plot',
        },
      })),
    };
  } finally {
    await pool.end();
  }
}
