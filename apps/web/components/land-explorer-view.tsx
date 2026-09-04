'use client';

/**
 * Land Explorer, driven by the TANSIDCO snapshot rather than hand-written data.
 *
 * Everything shown here comes from a published source: the vacancy chart, the
 * per-estate detail report, and the GIS estate record. Where the source has
 * nothing — approach roads, sector suitability — this view says so rather than
 * inventing a figure.
 */

import { Building2, Info, LandPlot, Store, Warehouse } from 'lucide-react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AreaUnit,
  formatArea,
  perUnitPhrase,
  perUnitShort,
  ratePerUnit,
} from '../lib/land-area';
import {
  type PlotUnitKind,
  PLOT_UNIT_META,
  PLOT_UNIT_ORDER,
  plotUnitFromVacancyType,
} from '../lib/plot-unit';
import { PlotMap, STATUS_LEGEND, type PlotFeatureProps } from './plot-map';
import { useNarrow } from './use-narrow';

const UNIT_ICON = {
  'industrial-plot': LandPlot,
  'commercial-plot': Store,
  shed: Warehouse,
  module: Building2,
} as const;

const UNIT_HELP: Record<PlotUnitKind, string> = {
  'industrial-plot':
    'A land parcel labelled for industrial use; no building is implied.',
  module:
    'A unit within a modular building or facility, rather than a land parcel.',
  'commercial-plot':
    'A land parcel labelled for commercial or support use rather than industrial use.',
  shed: 'A built industrial shed category, rather than an empty land parcel.',
};

type Vacancy = {
  industrialPlot: number;
  commercialPlot: number;
  shed: number;
  module: number;
  total: number;
};

type AvailablePlot = {
  no: string;
  extent: number | null;
  type: string;
  costRs: number | null;
  costBasis: 'outright' | 'unclear' | 'unpublished';
};

type EstateRecord = {
  totalAreaAcres: number | null;
  saleableAreaAcres: number | null;
  openSpaceAcres: number | null;
  roadAreaAcres: number | null;
  roadLengthM: number | null;
  drainageLengthM: number | null;
  plotCount: number | null;
  commercialPlotCount: number | null;
  streetLights: number | null;
  borewells: number | null;
  developedYear: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type Estate = {
  id: number;
  district: string;
  name: string;
  block: string | null;
  backward: boolean;
  vacant: Vacancy;
  gisUrl: string;
  coords: { lat: number; lon: number } | null;
  record: EstateRecord | null;
  polygonCount: number;
  plots: AvailablePlot[];
};

type Snapshot = {
  source: string;
  fetchedAt: string;
  note: string;
  estateCount: number;
  plotCount: number;
  districts: string[];
  estates: Estate[];
};

const css = (decls: string): CSSProperties => {
  const out: Record<string, string> = {};
  for (const part of decls.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const k = part.slice(0, at).trim();
    const v = part.slice(at + 1).trim();
    if (k !== '' && v !== '') {
      out[k.replaceAll(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
    }
  }
  return out as CSSProperties;
};

/**
 * The view owns the viewport: the app header is 64px, this fills the rest, and
 * nothing here scrolls the page — the estate list and the detail column scroll
 * inside their own panes. `min-height:0` on every grid child is what lets them.
 */
const SHELL =
  'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';

const CHIP_OFF_SM =
  'padding:6px 13px;border-radius:9999px;border:1px solid var(--color-lightgray);background:#fff;color:var(--color-gray);cursor:pointer;user-select:none';
const CHIP_ON_SM =
  'padding:6px 13px;border-radius:9999px;border:1px solid var(--action);background:var(--action);color:var(--on-action);cursor:pointer;user-select:none';

const SORT_OPTIONS = [
  ['nearest', 'Nearest to me'],
  ['default', 'Published order'],
  ['cheapest', 'Price: low to high'],
  ['priciest', 'Price: high to low'],
  ['vacancy', 'Most vacant'],
] as const;

function AreaUnitToggle({
  unit,
  onChange,
}: {
  readonly unit: AreaUnit;
  readonly onChange: (unit: AreaUnit) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Land area unit"
      style={css(
        'display:inline-flex;overflow:hidden;border:1px solid var(--color-lightgray);border-radius:9999px;background:#fff;flex:none',
      )}
    >
      {(['acre', 'cent'] as const).map((id) => (
        <button
          key={id}
          type="button"
          className="q-body-sm-caps"
          aria-pressed={unit === id}
          onClick={() => onChange(id)}
          style={css(
            `padding:6px 13px;border:none;cursor:pointer;user-select:none;min-height:36px;${
              unit === id
                ? 'background:var(--action);color:var(--on-action)'
                : 'background:transparent;color:var(--color-gray)'
            }`,
          )}
        >
          {id === 'acre' ? 'Acre' : 'Cent'}
        </button>
      ))}
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label
      className="q-body-sm-default"
      style={css('display:flex;align-items:center;gap:7px;white-space:nowrap')}
    >
      <span style={css('color:var(--color-mediumgray)')}>Sort by</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Sort estates"
        className="q-body-sm-default"
        style={css(
          'height:36px;border:1px solid var(--color-lightgray);border-radius:4px;padding:0 28px 0 10px;background:#fff;color:var(--color-darkgray);cursor:pointer',
        )}
      >
        {SORT_OPTIONS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

const rupees = (n: number): string => {
  if (n >= 1e7) return `₹${Math.round((n / 1e7) * 100) / 100}Cr`;
  if (n >= 1e5) return `₹${Math.round((n / 1e5) * 10) / 10}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

/** Only plot rows carry acres; sheds are sq.m and modules sq.ft. */
const isPlotRow = (p: AvailablePlot) => /plot/i.test(p.type);

type Location = { readonly lat: number; readonly lon: number };
type LocationState = 'idle' | 'locating' | 'ready' | 'unavailable';

function distanceKm(from: Location, to: Location): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(km: number): string {
  if (km < 1) return '<1 km away';
  return `${Math.round(km).toLocaleString('en-IN')} km away`;
}

function vacancyOf(e: Estate, kind: PlotUnitKind): number {
  return e.vacant[PLOT_UNIT_META[kind].vacancyKey];
}

function matchingVacant(e: Estate, types: ReadonlySet<PlotUnitKind>): number {
  if (types.size === 0) return e.vacant.total;
  let n = 0;
  for (const kind of types) n += vacancyOf(e, kind);
  return n;
}

function plotMatchesTypes(
  p: AvailablePlot,
  types: ReadonlySet<PlotUnitKind>,
): boolean {
  if (types.size === 0) return true;
  const kind = plotUnitFromVacancyType(p.type);
  return kind !== null && types.has(kind);
}

function unitRowLabel(p: AvailablePlot): string {
  const kind = plotUnitFromVacancyType(p.type);
  if (kind === 'module') return `Module ${p.no}`;
  if (kind === 'shed') return `Shed ${p.no}`;
  return `Plot ${p.no}`;
}

/**
 * Cheapest published rate per acre across an estate's available plots, used for
 * sorting. Rows whose cost basis is unclear (the per-sq.ft rental quotes) are
 * excluded rather than silently averaged in.
 */
function cheapestPerAcre(e: Estate): number | null {
  const rates = e.plots
    .filter(
      (p) =>
        isPlotRow(p) &&
        p.costBasis === 'outright' &&
        p.costRs !== null &&
        p.extent !== null &&
        p.extent > 0,
    )
    .map((p) => (p.costRs as number) / (p.extent as number));
  return rates.length === 0 ? null : Math.min(...rates);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/[^a-z0-9\s]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

export function LandExplorerView({
  eyebrow,
  title,
  simpleWords,
  explain,
  runHereLabel,
  backwardBadge,
  onRunMatcher,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly simpleWords: string;
  readonly explain: string;
  readonly runHereLabel: string;
  readonly backwardBadge: string;
  readonly onRunMatcher: (district: string, backward: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('nearest');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [backwardOnly, setBackwardOnly] = useState(false);
  const [unitTypes, setUnitTypes] = useState<ReadonlySet<PlotUnitKind>>(
    () => new Set(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeHelpOpen, setTypeHelpOpen] = useState(false);
  const [activeTypeHelp, setActiveTypeHelp] = useState<PlotUnitKind | null>(
    null,
  );
  const [selId, setSelId] = useState<number | null>(null);
  const [basemap, setBasemap] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  // Phone layout is master → detail rather than two columns: 390px cannot give
  // both a list and a surveyed plan enough room to be usable.
  const narrow = useNarrow();
  const [showDetail, setShowDetail] = useState(false);
  const [pane, setPane] = useState<'plan' | 'available' | 'record'>('plan');
  const [selPlot, setSelPlot] = useState<PlotFeatureProps | null>(null);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('acre');

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationState('unavailable');
      return;
    }
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lon: coords.longitude });
        setLocationState('ready');
      },
      () => setLocationState('unavailable'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(requestLocation, 0);
    return () => window.clearTimeout(timer);
  }, [requestLocation]);

  useEffect(() => {
    fetch('/api/estates')
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((s: Snapshot) => setSnapshot(s))
      .catch(() => setFailed(true));
  }, []);

  const rates = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const e of snapshot?.estates ?? []) map.set(e.id, cheapestPerAcre(e));
    return map;
  }, [snapshot]);

  const tokens = norm(query).split(' ').filter(Boolean);

  const searched = useMemo(() => {
    const all = snapshot?.estates ?? [];
    return all.filter((e) => {
      if (backwardOnly && !e.backward) return false;
      if (tokens.length === 0) return true;
      const hay = norm(`${e.name} ${e.district} ${e.block ?? ''}`);
      return tokens.every((t) => hay.includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, query, backwardOnly]);

  const typeCounts = useMemo(() => {
    const counts = {
      'industrial-plot': 0,
      'commercial-plot': 0,
      shed: 0,
      module: 0,
    } satisfies Record<PlotUnitKind, number>;
    for (const e of searched) {
      for (const kind of PLOT_UNIT_ORDER) counts[kind] += vacancyOf(e, kind);
    }
    return counts;
  }, [searched]);

  const filtered = useMemo(() => {
    const matched =
      unitTypes.size === 0
        ? searched
        : searched.filter((e) => matchingVacant(e, unitTypes) > 0);
    const byRate = (e: Estate) => rates.get(e.id) ?? Number.POSITIVE_INFINITY;
    const byDistance = (e: Estate) =>
      userLocation !== null && e.coords !== null
        ? distanceKm(userLocation, e.coords)
        : Number.POSITIVE_INFINITY;
    return [...matched].sort((a, b) => {
      if (sort === 'nearest') return byDistance(a) - byDistance(b);
      if (sort === 'cheapest') return byRate(a) - byRate(b);
      if (sort === 'priciest') {
        const ra = rates.get(a.id) ?? -1;
        const rb = rates.get(b.id) ?? -1;
        return rb - ra;
      }
      if (sort === 'vacancy') {
        return matchingVacant(b, unitTypes) - matchingVacant(a, unitTypes);
      }
      return 0;
    });
  }, [searched, sort, unitTypes, rates, userLocation]);

  const matchingUnits = useMemo(
    () => filtered.reduce((n, e) => n + matchingVacant(e, unitTypes), 0),
    [filtered, unitTypes],
  );

  const toggleType = (kind: PlotUnitKind) => {
    setUnitTypes((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const hasFacetFilters = unitTypes.size > 0 || backwardOnly;
  const clearFacets = () => {
    setUnitTypes(new Set());
    setBackwardOnly(false);
  };

  const sel = useMemo(
    () => filtered.find((e) => e.id === selId) ?? filtered[0] ?? null,
    [filtered, selId],
  );

  // Districts we actually hold estates for — used for the empty state, so a
  // search that finds nothing tells you what would work.
  const districts = snapshot?.districts ?? [];

  // A dashboard header, not an editorial one: one line of identity and one of
  // controls. The explainer is genuinely useful for first-timers but it is not
  // what you came here for, so it collapses to a link.
  const header = (
    <div style={css('padding:14px 24px 0;flex:none')}>
      <div
        style={css(
          'display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap',
        )}
      >
        <div style={css('display:flex;align-items:baseline;gap:12px')}>
          <h2 className="q-title-md-dec">{title}</h2>
          <button
            type="button"
            className="q-body-sm-caps"
            onClick={() => setExplainOpen((v) => !v)}
            aria-expanded={explainOpen}
            style={css(
              'border:none;background:transparent;color:var(--action);cursor:pointer;padding:0',
            )}
          >
            {explainOpen ? 'Hide' : simpleWords}
          </button>
        </div>
        <span
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray)')}
        >
          {eyebrow}
        </span>
      </div>
      {explainOpen && (
        <div
          className="q-body-sm-default"
          style={css(
            'background:var(--color-paperwhite);padding:12px 16px;margin-top:10px;color:var(--color-gray);text-wrap:pretty;max-width:900px',
          )}
        >
          {explain}
        </div>
      )}
    </div>
  );

  if (failed) {
    return (
      <div style={css(SHELL)}>
        {header}
        <div
          className="q-body-base-default"
          style={css('color:var(--color-gray)')}
        >
          The estate snapshot could not be loaded. Run{' '}
          <code>node scripts/fetch-tansidco.mjs</code> to rebuild it.
        </div>
      </div>
    );
  }

  if (snapshot === null) {
    return (
      <div style={css(SHELL)}>
        {header}
        <div
          className="q-body-base-default"
          style={css('color:var(--color-silvergray)')}
        >
          Loading estates…
        </div>
      </div>
    );
  }

  const rec = sel?.record ?? null;
  const listedPlots = (sel?.plots ?? []).filter((p) =>
    plotMatchesTypes(p, unitTypes),
  );
  const plotRows = listedPlots.filter(isPlotRow);
  const otherRows = listedPlots.filter((p) => !isPlotRow(p));
  const shownUnits = unitTypes.size === 0 ? plotRows : listedPlots;
  const shownOthers = unitTypes.size === 0 ? otherRows : [];
  const selectedUnitType =
    unitTypes.size === 1 ? unitTypes.values().next().value : undefined;
  const selVacant = sel === null ? 0 : matchingVacant(sel, unitTypes);
  const selRate = sel === null ? null : (rates.get(sel.id) ?? null);
  const unitToggle = <AreaUnitToggle unit={areaUnit} onChange={setAreaUnit} />;
  const locationControl =
    sort !== 'nearest' || locationState === 'ready' ? null : locationState ===
      'unavailable' ? (
      <button
        type="button"
        className="q-body-sm-caps"
        onClick={requestLocation}
        style={css(
          'border:none;background:transparent;color:var(--action);cursor:pointer;padding:4px 0;white-space:nowrap',
        )}
      >
        Retry location
      </button>
    ) : (
      <span
        className="q-body-sm-default"
        role="status"
        style={css('color:var(--color-silvergray);white-space:nowrap')}
      >
        Locating…
      </span>
    );

  const stats: [string, string][] = [
    [sel === null ? '—' : String(selVacant), 'Vacant now'],
    [
      rec?.plotCount === null || rec === null ? '—' : String(rec.plotCount),
      'Plots in estate',
    ],
    [
      rec?.totalAreaAcres === null || rec === null
        ? '—'
        : formatArea(rec.totalAreaAcres, areaUnit),
      'Total area',
    ],
    [
      selRate === null ? '—' : `${rupees(ratePerUnit(selRate, areaUnit))}`,
      `From, ${perUnitPhrase(areaUnit)}`,
    ],
  ];

  const estateList = (
    <>
      {filtered.map((e) => {
        const rate = rates.get(e.id) ?? null;
        const distance =
          sort === 'nearest' && userLocation !== null && e.coords !== null
            ? distanceKm(userLocation, e.coords)
            : null;
        const on = e.id === sel?.id && !narrow;
        return (
          <button
            key={e.id}
            type="button"
            className="qh-row-paper"
            onClick={() => {
              setSelId(e.id);
              setSelPlot(null);
              if (narrow) {
                setShowDetail(true);
                setPane('plan');
              }
            }}
            style={css(
              `display:block;width:100%;text-align:left;padding:${
                narrow ? '14px 16px' : '11px 14px'
              };border:none;border-bottom:1px solid var(--color-lightgray);cursor:pointer;background:${
                on ? 'var(--color-paperwhite)' : 'transparent'
              };border-left:2px solid ${on ? 'var(--color-darkgray)' : 'transparent'}`,
            )}
          >
            <div
              style={css('display:flex;justify-content:space-between;gap:8px')}
            >
              <span className="q-body-base-bold">{e.name}</span>
              {e.backward && (
                <span
                  className="q-body-sm-caps"
                  style={css('color:var(--color-umber);white-space:nowrap')}
                >
                  BB
                </span>
              )}
            </div>
            <div
              className="q-body-sm-default"
              style={css('color:var(--color-gray);margin-top:2px')}
            >
              {[
                e.district,
                `${matchingVacant(e, unitTypes)} vacant`,
                distance === null ? null : distanceLabel(distance),
                rate === null
                  ? null
                  : `from ${rupees(ratePerUnit(rate, areaUnit))}${perUnitShort(areaUnit)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </button>
        );
      })}
      {filtered.length === 0 && (
        <div
          className="q-body-sm-default"
          style={css(
            'padding:20px 14px;color:var(--color-gray);text-wrap:pretty',
          )}
        >
          {hasFacetFilters
            ? 'Nothing matches these filters. Clear them, or search another district.'
            : `Nothing matches “${query.trim()}”. TANSIDCO publishes vacancy in ${districts.join(', ')}.`}
        </div>
      )}
    </>
  );

  const availablePane = (
    <>
      <div
        className="q-body-sm-caps"
        style={css('color:var(--color-mediumgray);margin-bottom:6px')}
      >
        Available now · {shownUnits.length}{' '}
        {selectedUnitType !== undefined
          ? PLOT_UNIT_META[selectedUnitType].label.toLowerCase() +
            (shownUnits.length === 1 ? '' : 's')
          : shownUnits.length === 1
            ? 'unit'
            : 'units'}
      </div>
      {shownUnits.map((p) => (
        <div
          key={`${p.type}-${p.no}`}
          style={css(
            'display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--color-lightgray)',
          )}
        >
          <span className="q-body-sm-default">
            {unitRowLabel(p)}
            {p.extent === null ? '' : ` · ${formatArea(p.extent, areaUnit)}`}
          </span>
          <span
            className="q-body-sm-bold"
            style={css(
              p.costBasis === 'outright' ? '' : 'color:var(--color-silvergray)',
            )}
          >
            {p.costRs === null
              ? 'Not published'
              : p.costBasis === 'outright'
                ? rupees(p.costRs)
                : `₹${p.costRs} (basis unstated)`}
          </span>
        </div>
      ))}
      {shownUnits.length === 0 && (
        <div
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray)')}
        >
          {unitTypes.size > 0
            ? 'No vacant units of this type here.'
            : 'No vacant plots — sheds or modules only.'}
        </div>
      )}
      {shownOthers.length > 0 && (
        <div
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray);margin-top:6px')}
        >
          Also {shownOthers.length} shed/module unit
          {shownOthers.length === 1 ? '' : 's'} vacant.
        </div>
      )}
    </>
  );

  const recordPane = (
    <>
      <div
        className="q-body-sm-caps"
        style={css('color:var(--color-mediumgray);margin-bottom:6px')}
      >
        Estate record
      </div>
      {(
        [
          ['Saleable area', rec?.saleableAreaAcres, 'area'],
          ['Open space', rec?.openSpaceAcres, 'area'],
          ['Road area', rec?.roadAreaAcres, 'area'],
          ['Road length', rec?.roadLengthM, 'm'],
          ['Drainage length', rec?.drainageLengthM, 'm'],
          ['Street lights', rec?.streetLights, ''],
        ] as [string, number | null | undefined, string][]
      ).map(([label, value, unit]) => (
        <div
          key={label}
          style={css(
            'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--color-lightgray)',
          )}
        >
          <span className="q-body-sm-default">{label}</span>
          <span
            className="q-body-sm-default"
            style={css('color:var(--color-gray)')}
          >
            {value === null || value === undefined
              ? '—'
              : unit === 'area'
                ? formatArea(value, areaUnit)
                : `${value.toLocaleString('en-IN')}${unit === '' ? '' : ` ${unit}`}`}
          </span>
        </div>
      ))}
      <div
        className="q-body-sm-caps"
        style={css('color:var(--color-mediumgray);margin:16px 0 6px')}
      >
        Where to apply
      </div>
      <div
        className="q-body-sm-default"
        style={css('color:var(--color-gray);text-wrap:pretty')}
      >
        {rec?.address ?? 'Branch office not published'}
      </div>
      <div
        className="q-body-sm-default"
        style={css('color:var(--color-gray);margin-top:3px')}
      >
        {[rec?.phone, rec?.email].filter(Boolean).join(' · ') || '—'}
      </div>
      {sel !== null && (
        <a
          className="q-body-sm-caps"
          href={sel.gisUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={css('display:inline-block;margin-top:8px')}
        >
          Open TANSIDCO GIS →
        </a>
      )}
      <div
        className="q-body-sm-default"
        style={css(
          'color:var(--color-silvergray);margin-top:14px;text-wrap:pretty',
        )}
      >
        Approach roads and rail distances are not published in this extract, so
        none are shown.
      </div>
    </>
  );

  const backwardCount = searched.filter((e) => e.backward).length;

  const facetPanel = (
    <div
      style={css(
        'padding:12px 14px 10px;border-bottom:1px solid var(--color-lightgray)',
      )}
    >
      <div
        style={css(
          'display:flex;justify-content:space-between;align-items:baseline;gap:12px',
        )}
      >
        <span
          className="q-body-sm-caps"
          style={css('color:var(--color-mediumgray)')}
        >
          Filter by
        </span>
        {hasFacetFilters && (
          <button
            type="button"
            className="q-body-sm-caps"
            onClick={clearFacets}
            style={css(
              'border:none;background:transparent;color:var(--action);cursor:pointer;padding:0',
            )}
          >
            Clear filters
          </button>
        )}
      </div>
      <div
        style={css('display:flex;align-items:center;gap:5px;margin:10px 0 4px')}
      >
        <span
          className="q-body-sm-caps"
          style={css('color:var(--color-mediumgray)')}
        >
          Type
        </span>
        {narrow && (
          <button
            type="button"
            aria-label="About property types"
            aria-expanded={typeHelpOpen}
            aria-controls="property-type-help"
            title="Understand the property types"
            onClick={() => setTypeHelpOpen((open) => !open)}
            style={css(
              'width:24px;height:24px;display:grid;place-items:center;border:1px solid var(--color-lightgray);border-radius:9999px;background:#fff;color:var(--action);cursor:pointer;padding:0',
            )}
          >
            <Info size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
      {narrow && typeHelpOpen && (
        <div
          id="property-type-help"
          role="note"
          style={css(
            'margin:0 0 8px;padding:10px;background:var(--color-paperwhite);border:1px solid var(--color-lightgray)',
          )}
        >
          {PLOT_UNIT_ORDER.map((kind) => {
            const Icon = UNIT_ICON[kind];
            return (
              <div
                key={kind}
                style={css(
                  'display:grid;grid-template-columns:16px 1fr;gap:7px;margin-bottom:8px',
                )}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden />
                <div>
                  <div className="q-body-sm-bold">
                    {PLOT_UNIT_META[kind].label}
                  </div>
                  <div
                    className="q-body-sm-default"
                    style={css('color:var(--color-gray);line-height:1.35')}
                  >
                    {UNIT_HELP[kind]}
                  </div>
                </div>
              </div>
            );
          })}
          <p
            className="q-body-sm-default"
            style={css(
              'margin:4px 0 0;color:var(--color-silvergray);line-height:1.35',
            )}
          >
            These are TANSIDCO snapshot labels. Size, condition, fit-out and
            utilities must be confirmed with TANSIDCO.
          </p>
        </div>
      )}
      {PLOT_UNIT_ORDER.map((kind) => {
        const Icon = UNIT_ICON[kind];
        const count = typeCounts[kind];
        const on = unitTypes.has(kind);
        const disabled = count === 0 && !on;
        const tooltipId = `property-type-${kind}-help`;
        return (
          <div
            key={kind}
            style={css(
              `position:relative;display:flex;align-items:center;gap:7px;opacity:${
                disabled ? '0.45' : '1'
              }`,
            )}
          >
            <label
              style={css(
                `min-width:0;flex:1;display:flex;align-items:center;gap:8px;min-height:36px;cursor:${
                  disabled ? 'default' : 'pointer'
                }`,
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={() => toggleType(kind)}
              />
              <Icon size={15} strokeWidth={1.75} aria-hidden />
              <span className="q-body-sm-default" style={css('flex:1')}>
                {PLOT_UNIT_META[kind].label}
              </span>
              <span
                className="q-body-sm-default"
                style={css(
                  'color:var(--color-silvergray);font-variant-numeric:tabular-nums',
                )}
              >
                {count.toLocaleString('en-IN')}
              </span>
            </label>
            {!narrow && (
              <button
                type="button"
                aria-label={`About ${PLOT_UNIT_META[kind].label}`}
                aria-describedby={
                  activeTypeHelp === kind ? tooltipId : undefined
                }
                onMouseEnter={() => setActiveTypeHelp(kind)}
                onMouseLeave={() => setActiveTypeHelp(null)}
                onFocus={() => setActiveTypeHelp(kind)}
                onBlur={() => setActiveTypeHelp(null)}
                style={css(
                  'width:22px;height:22px;flex:none;display:grid;place-items:center;border:none;border-radius:9999px;background:transparent;color:var(--color-mediumgray);cursor:help;padding:0',
                )}
              >
                <Info size={14} strokeWidth={2} aria-hidden />
              </button>
            )}
            {!narrow && activeTypeHelp === kind && (
              <span
                id={tooltipId}
                role="tooltip"
                className="q-body-sm-default"
                style={css(
                  'position:absolute;z-index:20;top:calc(100% - 2px);right:0;width:240px;padding:8px 10px;border-radius:4px;background:var(--color-darkgray);color:#fff;line-height:1.4;pointer-events:none',
                )}
              >
                {UNIT_HELP[kind]}
              </span>
            )}
          </div>
        );
      })}
      <div
        className="q-body-sm-caps"
        style={css('color:var(--color-mediumgray);margin:10px 0 4px')}
      >
        Eligibility
      </div>
      <label
        style={css(
          'display:flex;align-items:center;gap:8px;min-height:36px;cursor:pointer',
        )}
      >
        <input
          type="checkbox"
          checked={backwardOnly}
          onChange={() => setBackwardOnly((b) => !b)}
        />
        <span className="q-body-sm-default" style={css('flex:1')}>
          Backward block
        </span>
        <span
          className="q-body-sm-default"
          style={css(
            'color:var(--color-silvergray);font-variant-numeric:tabular-nums',
          )}
        >
          {backwardCount.toLocaleString('en-IN')}
        </span>
      </label>
    </div>
  );

  const plan =
    sel === null ? null : sel.polygonCount === 0 ? (
      <div
        className="q-body-sm-default"
        style={css(
          'height:100%;display:grid;place-items:center;color:var(--color-silvergray);border:1px solid var(--color-lightgray);padding:20px;text-align:center',
        )}
      >
        TANSIDCO publishes no surveyed plan for this estate — it offers modules
        or sheds inside a building rather than land parcels.
      </div>
    ) : (
      <PlotMap
        estateId={sel.id}
        basemap={basemap}
        backward={sel.backward}
        available={listedPlots}
        areaUnit={areaUnit}
        selected={selPlot?.key ?? null}
        onSelect={setSelPlot}
        onHover={() => undefined}
      />
    );

  // ── Phone: list screen ⇄ estate screen, each owning the viewport ──
  if (narrow) {
    if (showDetail && sel !== null) {
      const tabs: ['plan' | 'available' | 'record', string][] = [
        ['plan', 'Plan'],
        ['available', `Available ${shownUnits.length}`],
        ['record', 'Record'],
      ];
      return (
        <div style={css(SHELL)}>
          <div
            style={css(
              'flex:none;display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--color-lightgray)',
            )}
          >
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              className="q-body-sm-caps"
              style={css(
                'border:none;background:transparent;color:var(--action);cursor:pointer;padding:6px 2px;min-height:44px',
              )}
            >
              ← All estates
            </button>
            <div style={css('min-width:0;flex:1')}>
              <div className="q-body-base-bold" style={css('truncate:1')}>
                {sel.name}
              </div>
              <div
                className="q-body-sm-default"
                style={css('color:var(--color-gray)')}
              >
                {[sel.district, `${selVacant} vacant`]
                  .filter(Boolean)
                  .join(' · ')}
                {sel.backward ? ' · backward block' : ''}
              </div>
            </div>
            {unitToggle}
          </div>

          <div
            style={css(
              'flex:none;display:flex;border-bottom:1px solid var(--color-lightgray)',
            )}
          >
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPane(id)}
                aria-pressed={pane === id}
                className="q-body-sm-caps"
                style={css(
                  `flex:1;min-height:44px;border:none;cursor:pointer;background:transparent;color:${
                    pane === id
                      ? 'var(--color-darkgray)'
                      : 'var(--color-mediumgray)'
                  };border-bottom:2px solid ${
                    pane === id ? 'var(--color-darkgray)' : 'transparent'
                  }`,
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {pane === 'plan' ? (
            <div
              style={css(
                'flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 12px 12px',
              )}
            >
              <div
                style={css(
                  'flex:none;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap',
                )}
              >
                <div style={css('display:flex;gap:10px;flex-wrap:wrap')}>
                  {STATUS_LEGEND.slice(0, 3).map(([label, colour]) => (
                    <span
                      key={label}
                      className="q-body-sm-default"
                      style={css(
                        'display:flex;align-items:center;gap:5px;color:var(--color-gray)',
                      )}
                    >
                      <span
                        style={css(
                          `width:9px;height:9px;display:inline-block;background:${colour}`,
                        )}
                      />
                      {label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="q-body-sm-caps"
                  onClick={() => setBasemap((b) => !b)}
                  aria-pressed={basemap}
                  style={css(
                    'border:none;background:transparent;color:var(--action);cursor:pointer;padding:0;min-height:32px',
                  )}
                >
                  {basemap ? 'Plan only' : 'Basemap'}
                </button>
              </div>
              <div style={css('flex:1;min-height:0')}>{plan}</div>
            </div>
          ) : (
            <div
              style={css(
                'flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 16px 24px',
              )}
            >
              {pane === 'available' ? availablePane : recordPane}
              <button
                type="button"
                onClick={() => onRunMatcher(sel.district, sel.backward)}
                className="q-body-sm-caps qh-primary"
                style={css(
                  'margin-top:18px;width:100%;min-height:48px;border-radius:9999px;border:none;background:var(--action);color:var(--on-action);cursor:pointer',
                )}
              >
                {runHereLabel}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={css(SHELL)}>
        <div style={css('flex:none;padding:12px 16px 10px')}>
          <h2 className="q-body-base-bold">{title}</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search estate, district or block"
            aria-label="Search estates"
            className="q-body-base-default"
            style={css(
              'margin-top:10px;height:44px;width:100%;border:1px solid var(--color-lightgray);border-radius:4px;padding:0 12px;background:#fff;color:var(--color-darkgray)',
            )}
          />
        </div>
        <div style={css('flex:none;padding:0 16px 8px')}>
          <button
            type="button"
            className="q-body-sm-caps"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            style={css(
              `${filtersOpen || hasFacetFilters ? CHIP_ON_SM : CHIP_OFF_SM};min-height:36px;width:100%`,
            )}
          >
            {hasFacetFilters
              ? `Filter by · ${unitTypes.size + (backwardOnly ? 1 : 0)} on`
              : 'Filter by'}
          </button>
        </div>
        {filtersOpen && <div style={css('flex:none')}>{facetPanel}</div>}
        <div
          style={css(
            'flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:0 16px 10px',
          )}
        >
          <SortSelect value={sort} onChange={setSort} />
          {locationControl}
          <div style={css('display:flex;align-items:center;gap:6px')}>
            <span
              className="q-body-sm-default"
              style={css('color:var(--color-mediumgray)')}
            >
              Area
            </span>
            {unitToggle}
          </div>
        </div>
        <div
          className="q-body-sm-default"
          style={css(
            'flex:none;padding:0 16px 8px;color:var(--color-silvergray)',
          )}
        >
          {filtered.length} of {snapshot.estateCount} estates ·{' '}
          {matchingUnits.toLocaleString('en-IN')} vacant
        </div>
        <div
          style={css(
            'flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-top:1px solid var(--color-lightgray)',
          )}
        >
          {estateList}
        </div>
      </div>
    );
  }

  return (
    <div style={css(SHELL)}>
      {header}

      {/* Search, sorting and display preferences are distinct from filters. */}
      <div
        style={css(
          'flex:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 24px 12px',
        )}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search estate, district or block"
          aria-label="Search estates"
          className="q-body-base-default"
          style={css(
            'height:36px;width:280px;border:1px solid var(--color-lightgray);border-radius:4px;padding:0 12px;background:#fff;color:var(--color-darkgray)',
          )}
        />
        <SortSelect value={sort} onChange={setSort} />
        {locationControl}
        <div style={css('display:flex;align-items:center;gap:7px')}>
          <span
            className="q-body-sm-default"
            style={css('color:var(--color-mediumgray)')}
          >
            Area unit
          </span>
          {unitToggle}
        </div>
        <span
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray);margin-left:auto')}
        >
          {filtered.length} of {snapshot.estateCount} ·{' '}
          {matchingUnits.toLocaleString('en-IN')} vacant · {districts.length}{' '}
          districts · snapshot {snapshot.fetchedAt.slice(0, 10)}
        </span>
      </div>

      {/* ── Panes: list | estate ── */}
      <div
        style={css(
          'flex:1;min-height:0;display:grid;grid-template-columns:minmax(280px,340px) 1fr;border-top:1px solid var(--color-lightgray)',
        )}
      >
        <div
          style={css(
            'min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--color-lightgray)',
          )}
        >
          <div style={css('flex:none')}>{facetPanel}</div>
          <div
            style={css(
              'flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain',
            )}
          >
            {estateList}
          </div>
        </div>

        {/* Selected estate */}
        {sel === null ? (
          <div
            className="q-body-base-default"
            style={css(
              'display:grid;place-items:center;color:var(--color-gray)',
            )}
          >
            No estate selected.
          </div>
        ) : (
          <div
            style={css(
              'min-height:0;display:grid;grid-template-rows:auto 1fr;background:var(--color-paperwhite)',
            )}
          >
            {/* Estate identity + the four figures, on one compact band. */}
            <div
              style={css(
                'flex:none;padding:16px 24px 14px;border-bottom:1px solid var(--color-lightgray);display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap',
              )}
            >
              <div>
                <div
                  style={css(
                    'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap',
                  )}
                >
                  <span className="q-title-lg-dec">{sel.name}</span>
                  {sel.backward && (
                    <span
                      className="q-body-sm-caps"
                      style={css(
                        'padding:2px 10px;border-radius:9999px;background:var(--color-stone);color:var(--color-umber)',
                      )}
                    >
                      {backwardBadge}
                    </span>
                  )}
                </div>
                <div
                  className="q-body-sm-default"
                  style={css('color:var(--color-gray);margin-top:4px')}
                >
                  {[
                    'TANSIDCO',
                    `${sel.district} district`,
                    sel.block === null ? null : `${sel.block} block`,
                    rec?.developedYear === null || rec === null
                      ? null
                      : `developed ${rec.developedYear}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div
                style={css(
                  'display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap',
                )}
              >
                {stats.map(([val, label]) => (
                  <div key={label}>
                    <div className="q-title-md-dec">{val}</div>
                    <div
                      className="q-body-sm-caps"
                      style={css('color:var(--color-mediumgray)')}
                    >
                      {label}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onRunMatcher(sel.district, sel.backward)}
                  className="q-body-sm-caps qh-primary"
                  style={css(
                    'height:38px;padding:0 20px;border-radius:9999px;border:none;background:var(--action);color:var(--on-action);cursor:pointer',
                  )}
                >
                  {runHereLabel}
                </button>
              </div>
            </div>

            {/* Plan | detail — both fill, only the right column scrolls. */}
            <div
              style={css(
                'min-height:0;display:grid;grid-template-columns:1fr minmax(280px,360px);gap:20px;padding:16px 24px 20px',
              )}
            >
              <div
                style={css('min-height:0;display:flex;flex-direction:column')}
              >
                <div
                  style={css(
                    'flex:none;display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px',
                  )}
                >
                  <span
                    className="q-body-sm-caps"
                    style={css('color:var(--color-mediumgray)')}
                  >
                    Surveyed plan
                  </span>
                  <div style={css('display:flex;gap:14px;align-items:center')}>
                    {STATUS_LEGEND.slice(0, 4).map(([label, colour]) => (
                      <span
                        key={label}
                        className="q-body-sm-default"
                        style={css(
                          'display:flex;align-items:center;gap:5px;color:var(--color-gray)',
                        )}
                      >
                        <span
                          style={css(
                            `width:9px;height:9px;display:inline-block;background:${colour}`,
                          )}
                        />
                        {label}
                      </span>
                    ))}
                    <button
                      type="button"
                      className="q-body-sm-caps"
                      onClick={() => setBasemap((b) => !b)}
                      aria-pressed={basemap}
                      style={css(
                        'border:none;background:transparent;color:var(--action);cursor:pointer;padding:0',
                      )}
                    >
                      {basemap ? 'Plan only' : 'Basemap'}
                    </button>
                  </div>
                </div>
                <div style={css('flex:1;min-height:0')}>
                  {sel.polygonCount === 0 ? (
                    <div
                      className="q-body-sm-default"
                      style={css(
                        'height:100%;display:grid;place-items:center;color:var(--color-silvergray);border:1px solid var(--color-lightgray)',
                      )}
                    >
                      TANSIDCO publishes no surveyed plan for this estate.
                    </div>
                  ) : (
                    <PlotMap
                      estateId={sel.id}
                      basemap={basemap}
                      backward={sel.backward}
                      available={listedPlots}
                      areaUnit={areaUnit}
                      selected={selPlot?.key ?? null}
                      onSelect={setSelPlot}
                      onHover={() => undefined}
                    />
                  )}
                </div>
              </div>

              <div
                style={css(
                  'min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:18px;padding-right:4px',
                )}
              >
                <div>{availablePane}</div>

                <div>
                  <div
                    className="q-body-sm-caps"
                    style={css(
                      'color:var(--color-mediumgray);margin-bottom:6px',
                    )}
                  >
                    Estate record
                  </div>
                  {(
                    [
                      ['Saleable area', rec?.saleableAreaAcres, 'area'],
                      ['Open space', rec?.openSpaceAcres, 'area'],
                      ['Road area', rec?.roadAreaAcres, 'area'],
                      ['Road length', rec?.roadLengthM, 'm'],
                      ['Drainage length', rec?.drainageLengthM, 'm'],
                      ['Street lights', rec?.streetLights, ''],
                    ] as [string, number | null | undefined, string][]
                  ).map(([label, value, unit]) => (
                    <div
                      key={label}
                      style={css(
                        'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--color-lightgray)',
                      )}
                    >
                      <span className="q-body-sm-default">{label}</span>
                      <span
                        className="q-body-sm-default"
                        style={css('color:var(--color-gray)')}
                      >
                        {value === null || value === undefined
                          ? '—'
                          : unit === 'area'
                            ? formatArea(value, areaUnit)
                            : `${value.toLocaleString('en-IN')}${unit === '' ? '' : ` ${unit}`}`}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <div
                    className="q-body-sm-caps"
                    style={css(
                      'color:var(--color-mediumgray);margin-bottom:6px',
                    )}
                  >
                    Where to apply
                  </div>
                  <div
                    className="q-body-sm-default"
                    style={css('color:var(--color-gray);text-wrap:pretty')}
                  >
                    {rec?.address ?? 'Branch office not published'}
                  </div>
                  <div
                    className="q-body-sm-default"
                    style={css('color:var(--color-gray);margin-top:3px')}
                  >
                    {[rec?.phone, rec?.email].filter(Boolean).join(' · ') ||
                      '—'}
                  </div>
                  <a
                    className="q-body-sm-caps"
                    href={sel.gisUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={css('display:inline-block;margin-top:8px')}
                  >
                    Open TANSIDCO GIS →
                  </a>
                </div>

                <div
                  className="q-body-sm-default"
                  style={css('color:var(--color-silvergray);text-wrap:pretty')}
                >
                  Approach roads and rail distances are not published in this
                  extract, so none are shown.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
