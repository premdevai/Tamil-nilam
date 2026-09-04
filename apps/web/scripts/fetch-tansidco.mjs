/**
 * Snapshot TANSIDCO's published vacancy data into a committed JSON fallback.
 *
 *   node scripts/fetch-tansidco.mjs            # refresh the snapshot
 *   node scripts/fetch-tansidco.mjs --dry-run  # parse, report, write nothing
 *
 * Source (public information pages, no auth, no robots.txt restrictions):
 *   index  https://tansidco.org/Home/vacant_chart
 *   detail https://tansidco.org/Home/show_detail_report/<token>
 *   gis    https://tansidco.org/Gidistrict/index/<base64 estate id>
 *
 * The detail token is a fixed salt plus the estate id, so it is derived rather
 * than scraped per row — but the id itself always comes from the index page.
 *
 * Politeness: one request at a time with a delay, a real UA, and a hard cap on
 * retries. On any per-estate failure the previous snapshot's plots are kept, so
 * a partial outage degrades to stale data rather than an empty estate.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const INDEX_URL = 'https://tansidco.org/Home/vacant_chart';
// Any estate's GIS page embeds an `ins_cor` map of estate id → coordinates for
// every estate, so one request yields the whole coordinate table.
const COORDS_URL = 'https://tansidco.org/Gidistrict/index/NDc=';
// A real JSON endpoint behind the GIS viewer: the full estate record plus one
// surveyed polygon per plot. Each vertex in the response repeats every plot
// attribute, so we fold it down to {no, acre, status, ring} — ~50x smaller.
const GIS_API = 'https://tansidco.org/Gis/get_industrial_estate_details/';
const DETAIL_SALT = 'G3252665125525522+ddkjdkkd$sssssssss+ssssssss_';
const OUT = path.resolve('data/tansidco.json');
const GEO_DIR = path.resolve('data/estates');
// ~1 m precision. Plot boundaries do not need the source's 0.1 mm.
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const UA = 'NILAM/0.1 (+public scheme and land information; contact: prem)';
const DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const strip = (h) =>
  h
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll(/\s+/g, ' ')
    .trim();

const rowsOf = (html) =>
  [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((m) => m[1]);
const cellsOf = (row) =>
  [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((m) => strip(m[1]));

async function get(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(attempt * 1200);
    return get(url, attempt + 1);
  }
}

/**
 * The published "Cost of Each Plot / Shed / Module (In Rs)" column mixes two
 * different things: outright sale prices in lakhs/crores, and rental quotes of
 * a few rupees per sq.ft per month for the plug-and-play modules and shops.
 * We cannot tell them apart from the row alone, so magnitude decides and the
 * UI is told to stop claiming a total it cannot stand behind.
 */
const costBasis = (cost, extent) => {
  if (cost === null) return 'unpublished';
  if (cost < 10_000 || (extent !== null && cost < extent)) return 'unclear';
  return 'outright';
};

async function fetchCoords() {
  const html = await get(COORDS_URL);
  const m = /var\s+ins_cor\s*=\s*'(\{.*?\})'\s*;/s.exec(html);
  if (!m) return new Map();
  const raw = JSON.parse(m[1]);
  const out = new Map();
  for (const [id, v] of Object.entries(raw)) {
    const lat = Number(v.lattitude);
    const lon = Number(v.longitude);
    // Tamil Nadu bounding box — rejects the 0,0 and swapped rows in the source.
    if (lat > 7.5 && lat < 14 && lon > 76 && lon < 81) {
      out.set(Number(id), { lat, lon });
    }
  }
  return out;
}

/** Integer, or null. '18' → 18 · '' → null · '1,20,000' → 120000 */
const num = (v) => {
  if (v === undefined || v === '' || v === '-' || v === '—') return null;
  const n = Number(String(v).replaceAll(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function parseIndex(html) {
  const out = [];
  for (const row of rowsOf(html)) {
    const c = cellsOf(row);
    if (c.length < 10 || c[0] === 'SI.NO' || num(c[0]) === null) continue;
    // The GIS link carries the estate id, base64-encoded.
    const gis = /Gidistrict\/index\/([A-Za-z0-9+/=]+)/.exec(row);
    if (!gis) continue;
    const id = Number(Buffer.from(gis[1], 'base64').toString('utf8'));
    if (!Number.isFinite(id)) continue;
    out.push({
      id,
      district: c[1],
      name: c[2],
      block: c[3] === 'NA' ? null : c[3],
      backward: /^yes$/i.test(c[4] ?? ''),
      vacant: {
        industrialPlot: num(c[5]) ?? 0,
        commercialPlot: num(c[6]) ?? 0,
        shed: num(c[7]) ?? 0,
        module: num(c[8]) ?? 0,
        total: num(c[9]) ?? 0,
      },
    });
  }
  return out;
}

function parsePlots(html) {
  const out = [];
  for (const row of rowsOf(html)) {
    const c = cellsOf(row);
    if (c.length < 7 || c[0] === 'SI.NO' || num(c[0]) === null) continue;
    const extent = num(c[4]);
    const costRs = num(c[6]);
    out.push({
      no: c[3],
      // Units differ by type: acres for plots, sq.m for sheds, sq.ft for modules.
      extent,
      type: c[5],
      costRs,
      costBasis: costBasis(costRs, extent),
    });
  }
  return out;
}

const NA = (v) =>
  v === undefined ||
  v === null ||
  v === 'Not Availabe' ||
  v === '-' ||
  v === '';

/**
 * One revolution of a ring.
 *
 * Some estates list each parcel's vertices more than once — Pidaneri repeats
 * every ring verbatim, so `[A,B,C,A,A,B,C,A]` arrives instead of `[A,B,C,A]`.
 * A double-traversal still draws, which is why this went unnoticed, but it is
 * not a simple polygon and MapLibre cannot hit-test it: the whole estate goes
 * unhoverable. Cut at the first return to the start, and drop any repeated
 * consecutive vertex.
 */
function oneRevolution(ring) {
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const deduped = ring.filter((v, i) => i === 0 || !same(v, ring[i - 1]));
  const start = deduped[0];
  if (start === undefined) return deduped;
  for (let i = 1; i < deduped.length; i++) {
    if (same(deduped[i], start)) return deduped.slice(0, i + 1);
  }
  return deduped;
}

/** Fold the vertex-per-row GIS payload into one ring per plot. */
function parseGis(json) {
  const est = json.industrial_estate ?? {};
  const plots = [];
  let degenerate = 0;
  for (const vertices of Object.values(json.coordinates ?? {})) {
    if (!Array.isArray(vertices) || vertices.length < 3) continue;
    const head = vertices[0] ?? {};
    if (NA(head.plot_no)) continue;
    const ring = oneRevolution(
      vertices
        .map((v) => [r5(Number(v.latitude)), r5(Number(v.longitude))])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)),
    );
    // A few parcels carry only two distinct vertices (`[A,B,A]`) — zero area,
    // so they can neither be drawn nor hit-tested. Counted, not hidden.
    const distinct = new Set(ring.map((v) => v.join(','))).size;
    if (ring.length < 4 || distinct < 3) {
      degenerate += 1;
      continue;
    }
    plots.push({
      no: String(head.plot_no),
      acre: NA(head.acre) ? null : Number(head.acre),
      status: NA(head.vaccant_status) ? null : head.vaccant_status,
      holder: NA(head.company_name) ? null : head.company_name,
      activity: NA(head.line_activity) ? null : head.line_activity,
      ring,
    });
  }
  const pick = (k) => (NA(est[k]) ? null : Number(est[k]));
  return {
    degenerate,
    record: {
      totalAreaAcres: pick('total_area'),
      saleableAreaAcres: pick('total_saleable_area'),
      openSpaceAcres: pick('open_space_area'),
      roadAreaAcres: pick('road_area'),
      roadLengthM: pick('road_length'),
      drainageLengthM: pick('drainage_length'),
      plotCount: pick('no_plots'),
      commercialPlotCount: pick('no_of_cmp_plots'),
      shedCount: pick('no_sheds'),
      moduleCount: pick('no_modules'),
      streetLights: pick('no_street_light'),
      borewells: pick('no_borewell'),
      ohtCapacity: pick('oht_capacity'),
      sumpCapacity: pick('sump_capacity'),
      developedYear: NA(est.year) ? null : String(est.year),
      address: NA(est.address) ? null : est.address,
      phone: NA(est.phone_no) ? null : String(est.phone_no),
      email: NA(est.email_id) ? null : est.email_id,
      backwardBlock: est.is_backward_block === '1',
    },
    geometry: plots,
  };
}

const dryRun = process.argv.includes('--dry-run');
const only = Number(
  process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] ?? 0,
);

const previous = await readFile(OUT, 'utf8')
  .then((t) => JSON.parse(t))
  .catch(() => ({ estates: [] }));
const previousPlots = new Map(previous.estates.map((e) => [e.id, e.plots]));
const previousGis = new Map(
  previous.estates.map((e) => [
    e.id,
    { record: e.record, geometry: e.geometry },
  ]),
);

console.log(`fetching ${COORDS_URL} (coordinate table)`);
const coords = await fetchCoords();
console.log(`  ${coords.size} estates with coordinates`);

console.log(`fetching ${INDEX_URL}`);
let estates = parseIndex(await get(INDEX_URL));
if (only > 0) estates = estates.slice(0, only);
if (estates.length === 0)
  throw new Error('index parsed to zero estates — markup changed?');
console.log(`  ${estates.length} estates`);

let ok = 0;
let stale = 0;
for (const e of estates) {
  await sleep(DELAY_MS);
  const url = `https://tansidco.org/Home/show_detail_report/${b64(DETAIL_SALT + e.id)}`;
  try {
    e.plots = parsePlots(await get(url));
    ok += 1;
  } catch (error) {
    e.plots = previousPlots.get(e.id) ?? [];
    e.plotsStale = true;
    stale += 1;
    console.warn(
      `  ! ${e.district}/${e.name}: ${error.message} — kept ${e.plots.length} cached`,
    );
  }
  e.gisUrl = `https://tansidco.org/Gidistrict/index/${b64(e.id)}`;
  e.coords = coords.get(e.id) ?? null;

  await sleep(DELAY_MS);
  try {
    const gis = parseGis(JSON.parse(await get(GIS_API + e.id)));
    e.record = gis.record;
    e.geometry = gis.geometry;
    e.degenerateParcels = gis.degenerate;
  } catch (error) {
    const prior = previousGis.get(e.id);
    e.record = prior?.record ?? null;
    e.geometry = prior?.geometry ?? [];
    e.geometryStale = true;
    console.warn(`  ! gis ${e.district}/${e.name}: ${error.message}`);
  }
  process.stdout.write(`\r  plots ${ok + stale}/${estates.length}`);
}
process.stdout.write('\n');

const snapshot = {
  source: 'TANSIDCO — https://tansidco.org/Home/vacant_chart',
  fetchedAt: new Date().toISOString(),
  note:
    'The source chart lists only estates that currently have vacancy, so this ' +
    'is a vacancy register rather than a complete estate registry.',
  estateCount: estates.length,
  plotCount: estates.reduce((a, e) => a + e.plots.length, 0),
  withCoords: estates.filter((e) => e.coords !== null).length,
  polygonCount: estates.reduce((a, e) => a + (e.geometry?.length ?? 0), 0),
  degenerateParcelsDropped: estates.reduce(
    (a, e) => a + (e.degenerateParcels ?? 0),
    0,
  ),
  districts: [...new Set(estates.map((e) => e.district))].sort(),
  estates,
};

console.log(
  `${snapshot.estateCount} estates · ${snapshot.plotCount} plots · ` +
    `${snapshot.districts.length} districts · ${stale} stale`,
);

if (dryRun) {
  console.log('--dry-run: not writing');
} else {
  await mkdir(GEO_DIR, { recursive: true });
  let geoBytes = 0;
  for (const e of estates) {
    const geometry = e.geometry ?? [];
    delete e.geometry;
    e.polygonCount = geometry.length;
    if (geometry.length === 0) continue;
    const body = JSON.stringify({
      id: e.id,
      name: e.name,
      district: e.district,
      centre: e.coords,
      fetchedAt: snapshot.fetchedAt,
      plots: geometry,
    });
    geoBytes += body.length;
    await writeFile(path.join(GEO_DIR, `${e.id}.json`), `${body}\n`);
  }
  await writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `wrote ${OUT} and ${GEO_DIR}/*.json ` +
      `(${Math.round(geoBytes / 1024)} KB of geometry)`,
  );
}
