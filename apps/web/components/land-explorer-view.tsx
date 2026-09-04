'use client';

/**
 * Land Explorer, driven by the TANSIDCO snapshot rather than hand-written data.
 *
 * Everything shown here comes from a published source: the vacancy chart, the
 * per-estate detail report, and the GIS estate record. Where the source has
 * nothing — approach roads, sector suitability — this view says so rather than
 * inventing a figure.
 */

import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import { PlotMap, STATUS_LEGEND, type PlotFeatureProps } from './plot-map';
import { useNarrow } from './use-narrow';

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

const rupees = (n: number): string => {
  if (n >= 1e7) return `₹${Math.round((n / 1e7) * 100) / 100}Cr`;
  if (n >= 1e5) return `₹${Math.round((n / 1e5) * 10) / 10}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

/** Only plot rows carry acres; sheds are sq.m and modules sq.ft. */
const isPlotRow = (p: AvailablePlot) => /plot/i.test(p.type);

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
  const [sort, setSort] = useState('default');
  const [backwardOnly, setBackwardOnly] = useState(false);
  const [selId, setSelId] = useState<number | null>(null);
  const [basemap, setBasemap] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  // Phone layout is master → detail rather than two columns: 390px cannot give
  // both a list and a surveyed plan enough room to be usable.
  const narrow = useNarrow();
  const [showDetail, setShowDetail] = useState(false);
  const [pane, setPane] = useState<'plan' | 'available' | 'record'>('plan');
  const [selPlot, setSelPlot] = useState<PlotFeatureProps | null>(null);

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
  const filtered = useMemo(() => {
    const all = snapshot?.estates ?? [];
    const matched = all.filter((e) => {
      if (backwardOnly && !e.backward) return false;
      if (tokens.length === 0) return true;
      const hay = norm(`${e.name} ${e.district} ${e.block ?? ''}`);
      return tokens.every((t) => hay.includes(t));
    });
    const byRate = (e: Estate) => rates.get(e.id) ?? Number.POSITIVE_INFINITY;
    return [...matched].sort((a, b) => {
      if (sort === 'cheapest') return byRate(a) - byRate(b);
      if (sort === 'priciest') {
        const ra = rates.get(a.id) ?? -1;
        const rb = rates.get(b.id) ?? -1;
        return rb - ra;
      }
      if (sort === 'vacancy') return b.vacant.total - a.vacant.total;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, query, sort, backwardOnly, rates]);

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
  const plotRows = (sel?.plots ?? []).filter(isPlotRow);
  const otherRows = (sel?.plots ?? []).filter((p) => !isPlotRow(p));
  const selRate = sel === null ? null : (rates.get(sel.id) ?? null);

  const stats: [string, string][] = [
    [sel === null ? '—' : String(sel.vacant.total), 'Vacant now'],
    [
      rec?.plotCount === null || rec === null ? '—' : String(rec.plotCount),
      'Plots in estate',
    ],
    [
      rec?.totalAreaAcres === null || rec === null
        ? '—'
        : `${rec.totalAreaAcres} ac`,
      'Total area',
    ],
    [selRate === null ? '—' : `${rupees(selRate)}`, 'From, per acre'],
  ];

  const estateList = (
    <>
      {filtered.map((e) => {
        const rate = rates.get(e.id) ?? null;
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
                `${e.vacant.total} vacant`,
                rate === null ? null : `from ${rupees(rate)}/ac`,
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
          Nothing matches “{query.trim()}”. TANSIDCO publishes vacancy in{' '}
          {districts.join(', ')}.
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
        Available now · {plotRows.length} plots
      </div>
      {plotRows.map((p) => (
        <div
          key={`${p.type}-${p.no}`}
          style={css(
            'display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--color-lightgray)',
          )}
        >
          <span className="q-body-sm-default">
            Plot {p.no}
            {p.extent === null ? '' : ` · ${p.extent} ac`}
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
      {plotRows.length === 0 && (
        <div
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray)')}
        >
          No vacant plots — sheds or modules only.
        </div>
      )}
      {otherRows.length > 0 && (
        <div
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray);margin-top:6px')}
        >
          Also {otherRows.length} shed/module unit
          {otherRows.length === 1 ? '' : 's'} vacant.
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
          ['Saleable area', rec?.saleableAreaAcres, 'ac'],
          ['Open space', rec?.openSpaceAcres, 'ac'],
          ['Road area', rec?.roadAreaAcres, 'ac'],
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
        available={sel.plots}
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
        ['available', `Available ${plotRows.length}`],
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
                {[sel.district, `${sel.vacant.total} vacant`]
                  .filter(Boolean)
                  .join(' · ')}
                {sel.backward ? ' · backward block' : ''}
              </div>
            </div>
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
        {/* Filters scroll sideways instead of wrapping into three rows. */}
        <div
          style={css(
            'flex:none;display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;padding:0 16px 10px;scrollbar-width:none',
          )}
        >
          {(
            [
              ['default', 'Published'],
              ['cheapest', 'Cheapest'],
              ['priciest', 'Priciest'],
              ['vacancy', 'Most vacant'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="q-body-sm-caps qh-chip"
              onClick={() => setSort(id)}
              style={css(
                `${sort === id ? CHIP_ON_SM : CHIP_OFF_SM};white-space:nowrap;min-height:36px`,
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="q-body-sm-caps qh-chip"
            aria-pressed={backwardOnly}
            onClick={() => setBackwardOnly((b) => !b)}
            style={css(
              `${backwardOnly ? CHIP_ON_SM : CHIP_OFF_SM};white-space:nowrap;min-height:36px`,
            )}
          >
            Backward only
          </button>
        </div>
        <div
          className="q-body-sm-default"
          style={css(
            'flex:none;padding:0 16px 8px;color:var(--color-silvergray)',
          )}
        >
          {filtered.length} of {snapshot.estateCount} estates ·{' '}
          {districts.length} districts
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

      {/* ── Controls: one row, always visible ── */}
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
        {(
          [
            ['default', 'Published'],
            ['cheapest', 'Cheapest'],
            ['priciest', 'Priciest'],
            ['vacancy', 'Most vacant'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="q-body-sm-caps qh-chip"
            onClick={() => setSort(id)}
            style={css(sort === id ? CHIP_ON_SM : CHIP_OFF_SM)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="q-body-sm-caps qh-chip"
          aria-pressed={backwardOnly}
          onClick={() => setBackwardOnly((b) => !b)}
          style={css(backwardOnly ? CHIP_ON_SM : CHIP_OFF_SM)}
        >
          Backward only
        </button>
        <span
          className="q-body-sm-default"
          style={css('color:var(--color-silvergray);margin-left:auto')}
        >
          {filtered.length} of {snapshot.estateCount} ·{' '}
          {snapshot.plotCount.toLocaleString('en-IN')} vacant plots ·{' '}
          {districts.length} districts · snapshot{' '}
          {snapshot.fetchedAt.slice(0, 10)}
        </span>
      </div>

      {/* ── Panes: list | estate ── */}
      <div
        style={css(
          'flex:1;min-height:0;display:grid;grid-template-columns:minmax(260px,320px) 1fr;border-top:1px solid var(--color-lightgray)',
        )}
      >
        {/* Estate list — the only thing that scrolls on the left. */}
        <div
          style={css(
            'min-height:0;overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--color-lightgray)',
          )}
        >
          {estateList}
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
                      available={sel.plots}
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
                <div>
                  <div
                    className="q-body-sm-caps"
                    style={css(
                      'color:var(--color-mediumgray);margin-bottom:6px',
                    )}
                  >
                    Available now · {plotRows.length} plots
                  </div>
                  {plotRows.map((p) => (
                    <div
                      key={`${p.type}-${p.no}`}
                      style={css(
                        'display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--color-lightgray)',
                      )}
                    >
                      <span className="q-body-sm-default">
                        Plot {p.no}
                        {p.extent === null ? '' : ` · ${p.extent} ac`}
                      </span>
                      <span
                        className="q-body-sm-bold"
                        style={css(
                          p.costBasis === 'outright'
                            ? ''
                            : 'color:var(--color-silvergray)',
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
                  {plotRows.length === 0 && (
                    <div
                      className="q-body-sm-default"
                      style={css('color:var(--color-silvergray)')}
                    >
                      No vacant plots — sheds or modules only.
                    </div>
                  )}
                  {otherRows.length > 0 && (
                    <div
                      className="q-body-sm-default"
                      style={css(
                        'color:var(--color-silvergray);margin-top:6px',
                      )}
                    >
                      Also {otherRows.length} shed/module unit
                      {otherRows.length === 1 ? '' : 's'} vacant.
                    </div>
                  )}
                </div>

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
                      ['Saleable area', rec?.saleableAreaAcres, 'ac'],
                      ['Open space', rec?.openSpaceAcres, 'ac'],
                      ['Road area', rec?.roadAreaAcres, 'ac'],
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
