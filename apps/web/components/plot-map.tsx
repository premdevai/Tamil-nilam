'use client';

/**
 * The real plot plan for one TANSIDCO estate: actual surveyed polygons from
 * `Gis/get_industrial_estate_details`, rendered with mapcn (MapLibre).
 *
 * The source mixes four kinds of parcel into one list, distinguishable only by
 * the plot label. Separating them matters for more than looks: the estate
 * `Boundary` parcel is a single polygon covering everything, so leaving it in
 * the interactive layer means almost every hover reports "Boundary" instead of
 * the plot under the cursor. Roads and reservations are drawn but inert; only
 * allottable plots respond to the pointer.
 */

import { Building2, LandPlot, Store, Warehouse, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Map as MapCanvas, MapControls, MapGeoJSON, MapPopup } from './ui/map';

export type SourcePlot = {
  no: string;
  acre: number | null;
  status: string | null;
  holder: string | null;
  activity: string | null;
  ring: [number, number][];
};

/** A row from the estate's published vacancy report. */
export type AvailablePlot = {
  no: string;
  extent: number | null;
  type: string;
  costRs: number | null;
  costBasis: 'outright' | 'unclear' | 'unpublished';
};

/**
 * TANSIDCO's vacancy chart only publishes these four unit kinds. The GIS
 * layer has no type field, so a hover without a vacancy match infers from
 * the plot label (CML/CMP, shed, module) and otherwise treats a numbered
 * parcel as an industrial plot.
 */
export type PlotUnitKind =
  | 'industrial-plot'
  | 'commercial-plot'
  | 'shed'
  | 'module';

const PLOT_UNITS: Record<
  PlotUnitKind,
  { readonly label: string; readonly Icon: LucideIcon }
> = {
  'industrial-plot': { label: 'Industrial plot', Icon: LandPlot },
  'commercial-plot': { label: 'Commercial plot', Icon: Store },
  shed: { label: 'Shed', Icon: Warehouse },
  module: { label: 'Module', Icon: Building2 },
};

export function plotUnitFromVacancyType(type: string): PlotUnitKind | null {
  const key = type.trim().toLowerCase();
  if (key === 'industrial plot') return 'industrial-plot';
  if (key === 'commercial plot') return 'commercial-plot';
  if (key === 'shed') return 'shed';
  if (key === 'module') return 'module';
  return null;
}

export function inferPlotUnit(no: string): PlotUnitKind {
  const label = no.toLowerCase();
  if (/\bshed\b/.test(label)) return 'shed';
  if (/\b(module|plug)\b/.test(label)) return 'module';
  if (/\b(cml|cmp|commercial)\b/.test(label)) return 'commercial-plot';
  return 'industrial-plot';
}

export function plotUnitsForHover(
  plotNo: string,
  matches: readonly AvailablePlot[],
): readonly PlotUnitKind[] {
  const fromReport = [
    ...new Set(
      matches
        .map((row) => plotUnitFromVacancyType(row.type))
        .filter((kind): kind is PlotUnitKind => kind !== null),
    ),
  ];
  return fromReport.length > 0 ? fromReport : [inferPlotUnit(plotNo)];
}

type Geometry = {
  id: number;
  name: string;
  district: string;
  centre: { lat: number; lon: number } | null;
  fetchedAt: string;
  plots: SourcePlot[];
};

type Kind = 'plot' | 'road' | 'reservation' | 'boundary';

export type PlotFeatureProps = {
  key: string;
  /** True when the vacancy report lists this parcel as available. */
  offered: boolean;
  no: string;
  acre: number | null;
  status: string;
  holder: string | null;
  activity: string | null;
};

/**
 * Plot identifiers differ between TANSIDCO's two datasets — the vacancy report
 * says `DP NO.63 D/1 NP` where the GIS register says `63D/1` — so ids are
 * normalised before joining. This recovers some estates but not all: see
 * `reconcile` below.
 */
function normaliseId(no: string): string {
  return no
    .toUpperCase()
    .replaceAll(/\bDP\s*NO\.?\s*/g, '')
    .replaceAll(/\bPLOT\s*(NO\.?)?\s*/g, '')
    .replaceAll(/\b(NP|SP)\b/g, '')
    .replaceAll(/[^A-Z0-9/]/g, '');
}

const STATUS_FILL: Record<string, string> = {
  'Not Alloted': 'var(--color-green-100)',
  Alloted: 'var(--color-lightgray)',
  'Under Litigation': 'var(--color-red-100)',
  'Reserved Area': 'var(--color-petal)',
  Undeveloped: 'var(--color-warmgrey)',
};
const STATUS_UNKNOWN = 'var(--color-offwhite)';

export const STATUS_LEGEND: readonly [string, string][] = [
  ['Vacant', 'var(--color-green-100)'],
  ['Alloted', 'var(--color-lightgray)'],
  ['Reserved Area', 'var(--color-petal)'],
  ['Undeveloped', 'var(--color-warmgrey)'],
  ['Under Litigation', 'var(--color-red-100)'],
  ['Road', 'var(--color-offwhite)'],
];

/**
 * Classify a parcel. Two signals are needed, because neither works alone.
 *
 * Plot numbering is inconsistent across estates — Kattuvananjur uses `12`,
 * Guindy uses `1A`, `GC1`, `LT.40A`, `MF.15A` — so a regex on the label
 * mislabels most of the state. But `vaccant_status` is absent on plenty of
 * genuine plots too (roughly two thirds of Kattuvananjur's).
 *
 * So: roads and the boundary come from the label, since that is how the source
 * names them. A status is then conclusive proof of an allottable parcel. Only
 * where there is no status do we fall back to the agency's amenity vocabulary
 * — OSR (open space reservation), CMP (common facility), PP (public purpose)
 * and named buildings.
 */
const AMENITY =
  /^(osr|cmp|pp|osp)\b|open space|canteen|office|bank|dispensary|godown|building|tenement|amenity|conference|creche|toilet|substation|pump|oht|sump|drain|shop|quarters|police|post/i;

function classify(p: SourcePlot): Kind {
  const n = p.no.trim();
  if (/^boundary$/i.test(n)) return 'boundary';
  if (/road|street/i.test(n)) return 'road';
  if (p.status !== null) return 'plot';
  return AMENITY.test(n) ? 'reservation' : 'plot';
}

/** Resolve a CSS custom property to a literal colour MapLibre can parse. */
function resolved(value: string): string {
  const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (name === undefined) return value;
  const literal = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return literal === '' ? '#cccccc' : literal;
}

/** Bounding box of every ring, so a 42-acre estate and a 404-acre one both fit. */
function bounds(
  plots: readonly SourcePlot[],
): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const p of plots) {
    for (const [lat, lon] of p.ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/** Ring centroid, for anchoring the popup on the plot rather than the cursor. */
function centroid(ring: readonly [number, number][]): [number, number] {
  let lat = 0;
  let lon = 0;
  for (const [a, b] of ring) {
    lat += a;
    lon += b;
  }
  return [lon / ring.length, lat / ring.length];
}

/**
 * One revolution of a ring — see scripts/fetch-tansidco.mjs. Duplicated as a
 * guard so a stale or hand-edited snapshot cannot silently kill hit-testing.
 */
function oneRevolution(ring: readonly [number, number][]): [number, number][] {
  const same = (a: [number, number], b: [number, number]) =>
    a[0] === b[0] && a[1] === b[1];
  const deduped = ring.filter(
    (v, i) => i === 0 || !same(v, ring[i - 1] as [number, number]),
  );
  const start = deduped[0];
  if (start === undefined) return [...deduped];
  for (let i = 1; i < deduped.length; i++) {
    if (same(deduped[i] as [number, number], start))
      return deduped.slice(0, i + 1);
  }
  return [...deduped];
}

function collection(
  plots: readonly SourcePlot[],
  want: (k: Kind) => boolean,
  offered?: ReadonlySet<string>,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, PlotFeatureProps> {
  const features: GeoJSON.Feature<GeoJSON.Polygon, PlotFeatureProps>[] = [];
  plots.forEach((p, index) => {
    if (!want(classify(p))) return;
    const ring = oneRevolution(p.ring).map(
      ([lat, lon]) => [lon, lat] as [number, number],
    );
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1]))
      ring.push(first);
    features.push({
      type: 'Feature',
      id: index,
      properties: {
        key: `${index}`,
        offered: offered?.has(String(index)) === true,
        no: p.no,
        acre: p.acre,
        status: p.status ?? 'Not published',
        holder: p.holder,
        activity: p.activity,
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  });
  return { type: 'FeatureCollection', features };
}

/**
 * Feature properties round-trip through MapLibre's worker, where a JSON `null`
 * comes back as `undefined` rather than `null`. A `!== null` check therefore
 * passes for absent values, which rendered empty "Held by" rows on vacant
 * plots. Test for a real value instead.
 */
const present = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.trim() !== '-';

const numeric = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const rupees = (n: number): string => {
  if (n >= 1e7) return `₹${Math.round((n / 1e7) * 100) / 100}Cr`;
  if (n >= 1e5) return `₹${Math.round((n / 1e5) * 10) / 10}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

type PlotMapProps = {
  readonly estateId: number;
  /** false renders a tile-less canvas — the plan alone, no map furniture. */
  readonly basemap: boolean;
  readonly backward: boolean;
  /** Vacancy rows for this estate, merged into the popup by plot number. */
  readonly available: readonly AvailablePlot[];
  readonly selected: string | null;
  readonly onSelect: (props: PlotFeatureProps | null) => void;
  readonly onHover: (props: PlotFeatureProps | null) => void;
};

export function PlotMap(props: PlotMapProps) {
  // Remount estate-scoped state when the selected estate changes. This avoids
  // briefly showing the previous estate's geometry while the next plan loads.
  return <PlotMapEstate key={props.estateId} {...props} />;
}

function PlotMapEstate({
  estateId,
  basemap,
  backward,
  available,
  selected,
  onSelect,
  onHover,
}: PlotMapProps) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PlotFeatureProps | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/estates/${estateId}/geometry`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((g: Geometry) => {
        if (live) setGeometry(g);
      })
      .catch(() => {
        if (live) setError('No surveyed plan is published for this estate.');
      });
    return () => {
      live = false;
    };
  }, [estateId]);

  /**
   * Which parcels the vacancy report offers, and how many of its rows we could
   * actually place on the plan. The two datasets disagree for some estates —
   * the GIS layer marks nothing vacant at Ambattur or Guindy even though the
   * report lists plots — so this is surfaced rather than smoothed over.
   */
  const reconciled = useMemo(() => {
    const wanted = new Map<string, AvailablePlot>();
    for (const a of available) wanted.set(normaliseId(a.no), a);
    const offered = new Set<string>();
    const located = new Set<string>();
    (geometry?.plots ?? []).forEach((p, index) => {
      const key = normaliseId(p.no);
      if (wanted.has(key)) {
        offered.add(String(index));
        located.add(key);
      }
    });
    return { offered, locatedRows: located.size, totalRows: available.length };
  }, [geometry, available]);

  const layers = useMemo(() => {
    const plots = geometry?.plots ?? [];
    return {
      boundary: collection(plots, (k) => k === 'boundary'),
      inert: collection(plots, (k) => k === 'road' || k === 'reservation'),
      plots: collection(plots, (k) => k === 'plot', reconciled.offered),
    };
  }, [geometry, reconciled]);

  const ringByKey = useMemo(() => {
    const map = new Map<string, [number, number][]>();
    (geometry?.plots ?? []).forEach((p, index) => map.set(`${index}`, p.ring));
    return map;
  }, [geometry]);

  if (error !== null) {
    return (
      <div
        className="q-body-sm-default"
        style={{
          color: 'var(--color-silvergray)',
          border: '1px solid var(--color-lightgray)',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          padding: '20px 22px',
          textAlign: 'center',
        }}
      >
        {error}
      </div>
    );
  }

  if (geometry === null) {
    return (
      <div
        className="q-body-sm-default"
        style={{
          color: 'var(--color-silvergray)',
          border: '1px solid var(--color-lightgray)',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        Loading surveyed plan…
      </div>
    );
  }

  const frame = bounds(geometry.plots);
  const centre = geometry.centre;

  const byStatus: unknown[] = ['match', ['get', 'status']];
  for (const [status, colour] of Object.entries(STATUS_FILL)) {
    byStatus.push(status, resolved(colour));
  }
  byStatus.push(resolved(STATUS_UNKNOWN));

  // The vacancy report is the authority on what is for sale: where a parcel
  // appears in it, paint it vacant even if the GIS status still says otherwise.
  const fillColor: unknown[] = [
    'case',
    ['get', 'offered'],
    resolved('var(--color-green-100)'),
    byStatus,
  ];

  // Rows the vacancy report lists under this plot number. More than one means
  // the number is reused across plot types, so we show each rather than pick.
  const matches =
    active === null
      ? []
      : available.filter((a) => a.no.trim() === active.no.trim());

  const anchor = active === null ? null : (ringByKey.get(active.key) ?? null);

  const clearHover = () => {
    setActive(null);
    onHover(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }} onMouseLeave={clearHover}>
        <MapCanvas
          className="h-full w-full border border-border"
          blank={!basemap}
          {...(frame === null
            ? centre === null
              ? { center: [78.6569, 11.1271] as [number, number], zoom: 7 }
              : {
                  center: [centre.lon, centre.lat] as [number, number],
                  zoom: 15.5,
                }
            : {
                bounds: frame,
                fitBoundsOptions: { padding: 24, animate: false },
              })}
          attributionControl={false}
        >
          <MapControls />

          {/* Estate outline: drawn, never interactive. */}
          <MapGeoJSON<PlotFeatureProps>
            id="boundary"
            data={layers.boundary}
            fillPaint={false}
            linePaint={{
              'line-color': resolved('var(--color-darkgray)'),
              'line-width': 1.6,
            }}
          />

          {/* Roads and reservations: context, not offers. */}
          <MapGeoJSON<PlotFeatureProps>
            id="inert"
            data={layers.inert}
            fillPaint={{
              'fill-color': resolved('var(--color-offwhite)'),
              'fill-opacity': 0.9,
            }}
            linePaint={{
              'line-color': resolved('var(--color-lightgray)'),
              'line-width': 0.4,
            }}
          />

          {/* Allottable plots: the only interactive layer. */}
          <MapGeoJSON<PlotFeatureProps>
            id="plots"
            data={layers.plots}
            promoteId="key"
            interactive
            fillPaint={{
              'fill-color': fillColor as never,
              'fill-opacity': [
                'case',
                ['==', ['get', 'key'], selected ?? ' '],
                0.95,
                0.62,
              ] as never,
            }}
            linePaint={{
              'line-color': resolved('var(--color-darkgray)'),
              'line-width': [
                'case',
                ['==', ['get', 'key'], selected ?? ' '],
                2.4,
                0.4,
              ] as never,
            }}
            fillHoverPaint={{ 'fill-opacity': 0.92 }}
            onHover={(e) => {
              const props = e?.feature.properties ?? null;
              setActive(props);
              onHover(props);
            }}
            onClick={(e) => onSelect(e?.feature.properties ?? null)}
          />

          {active !== null && anchor !== null && (
            <MapPopup
              longitude={centroid(anchor)[0]}
              latitude={centroid(anchor)[1]}
              closeOnClick={false}
            >
              <div style={{ minWidth: 216 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'baseline',
                  }}
                >
                  <span className="q-body-sm-caps">Plot {active.no}</span>
                  <span
                    className="q-body-sm-caps"
                    style={{
                      color:
                        active.status === 'Not Alloted'
                          ? 'var(--color-green-100)'
                          : active.status === 'Under Litigation'
                            ? 'var(--color-red-100)'
                            : 'var(--color-mediumgray)',
                    }}
                  >
                    {active.status}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  {plotUnitsForHover(active.no, matches).map((kind) => {
                    const { label, Icon } = PLOT_UNITS[kind];
                    return (
                      <span
                        key={kind}
                        className="q-body-sm-caps"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--color-darkgray)',
                        }}
                      >
                        <Icon size={14} strokeWidth={1.75} aria-hidden />
                        {label}
                      </span>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid var(--color-lightgray)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <Row
                    label="Surveyed extent"
                    value={
                      numeric(active.acre)
                        ? `${active.acre} ac`
                        : 'Not published'
                    }
                  />
                  {matches.map((m) => (
                    <div key={`${m.type}-${m.no}`}>
                      <Row
                        label="Tentative cost"
                        value={
                          m.costRs === null
                            ? 'Not published'
                            : m.costBasis === 'outright'
                              ? rupees(m.costRs)
                              : `₹${m.costRs} · basis unstated`
                        }
                      />
                      {m.costBasis === 'outright' &&
                        m.costRs !== null &&
                        m.extent !== null &&
                        m.extent > 0 && (
                          <Row
                            label="Per acre"
                            value={rupees(m.costRs / m.extent)}
                          />
                        )}
                    </div>
                  ))}
                  {present(active.holder) && (
                    <Row label="Held by" value={active.holder} />
                  )}
                  {present(active.activity) && (
                    <Row label="Activity" value={active.activity} />
                  )}
                  {matches.length === 0 && active.status !== 'Not Alloted' && (
                    <Row label="Offered" value="Not in the vacancy report" />
                  )}
                </div>

                {matches.length > 0 && backward && (
                  <div
                    className="q-body-sm-default"
                    style={{ color: 'var(--color-umber)', marginTop: 8 }}
                  >
                    Backward block — 50% of stamp duty and registration charges
                    reimbursed.
                  </div>
                )}
              </div>
            </MapPopup>
          )}
        </MapCanvas>
      </div>
      {reconciled.totalRows > 0 &&
        reconciled.locatedRows < reconciled.totalRows && (
          <div
            className="q-body-sm-default"
            style={{
              flex: 'none',
              marginTop: 8,
              padding: '8px 10px',
              background: 'var(--color-stone)',
              color: 'var(--color-umber)',
              textWrap: 'pretty',
            }}
          >
            {reconciled.locatedRows === 0
              ? `None of the ${reconciled.totalRows} vacant plots in the vacancy report can be located on this plan — the GIS layer marks no parcel vacant here and numbers plots differently. Use the list on the right; the plan shows layout only.`
              : `${reconciled.locatedRows} of ${reconciled.totalRows} vacant plots are shown in green. The rest are listed in the vacancy report but cannot be matched to a parcel on this plan.`}
          </div>
        )}
      <div
        className="q-body-sm-default"
        style={{ color: 'var(--color-silvergray)', marginTop: 8, flex: 'none' }}
      >
        {layers.plots.features.length} parcels · {layers.inert.features.length}{' '}
        roads and reservations · TANSIDCO GIS, snapshot{' '}
        {geometry.fetchedAt.slice(0, 10)}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div
      className="q-body-sm-default"
      style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}
    >
      <span style={{ color: 'var(--color-mediumgray)' }}>{label}</span>
      <span className="q-body-sm-bold" style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
