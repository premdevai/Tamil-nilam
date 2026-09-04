'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  LandFilterSchema,
  fallbackLandResponse,
  type LandResponse,
} from '../lib/land-contract';

const EMPTY_FILTERS = LandFilterSchema.parse({});

function prefersLowBandwidth(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  );
}

function syncAge(value: string): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
  );
  return days === 0
    ? 'synced today'
    : `synced ${days} day${days === 1 ? '' : 's'} ago`;
}

export function LandExplorer({
  initialDistrict,
}: {
  readonly initialDistrict?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [district, setDistrict] = useState(initialDistrict ?? '');
  const [agency, setAgency] = useState('');
  const [status, setStatus] = useState('unknown');
  const [data, setData] = useState<LandResponse>(() =>
    fallbackLandResponse({
      ...EMPTY_FILTERS,
      ...(initialDistrict === undefined ? {} : { district: initialDistrict }),
    }),
  );
  const [mapError, setMapError] = useState('');
  const [loading, setLoading] = useState(false);
  const lowBandwidth = prefersLowBandwidth();
  const latestData = useRef(data);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => {
    if (container.current === null || enabled || lowBandwidth) return;
    const node = container.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          setEnabled(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, lowBandwidth]);

  useEffect(() => {
    if (!enabled || container.current === null || map.current !== null) return;
    let cancelled = false;
    void import('maplibre-gl')
      .then(({ Map, NavigationControl }) => {
        if (cancelled || container.current === null) return;
        const instance = new Map({
          container: container.current,
          center: [78.4, 11.1],
          zoom: 5.4,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
        });
        instance.addControl(new NavigationControl({ showCompass: false }));
        instance.on('load', () => {
          instance.addSource('land', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: latestData.current.features,
            } as never,
            cluster: true,
            clusterRadius: 42,
          });
          instance.addLayer({
            id: 'plot-polygons',
            type: 'fill',
            source: 'land',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': [
                'match',
                ['get', 'status'],
                'vacant',
                '#416447',
                'allotted',
                '#626258',
                'litigation',
                '#8c3b2f',
                '#7a6a12',
              ],
              'fill-opacity': 0.56,
              'fill-outline-color': '#1f211d',
            },
          });
          instance.addLayer({
            id: 'estate-points',
            type: 'circle',
            source: 'land',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': [
                'case',
                ['has', 'point_count'],
                ['step', ['get', 'point_count'], 12, 10, 18, 50, 25],
                8,
              ],
              'circle-color': [
                'case',
                ['has', 'point_count'],
                '#7a6a12',
                '#416447',
              ],
              'circle-stroke-color': '#f4f0e6',
              'circle-stroke-width': 2,
            },
          });
        });
        map.current = instance;
      })
      .catch(() => {
        setMapError(
          'The interactive map could not load. The accessible evidence list remains available.',
        );
      });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    const source = map.current.getSource('land') as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: data.features,
    } as never);
  }, [data]);

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (district !== '') params.set('district', district);
    if (agency !== '') params.set('agency', agency);
    if (status !== '') params.set('status', status);
    window.history.replaceState(null, '', `/land?${params.toString()}`);
    setLoading(true);
    try {
      const response = await fetch(`/api/land?${params.toString()}`);
      const body = (await response.json()) as LandResponse & {
        readonly error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? 'Land query failed');
      setData(body);
      setMapError('');
    } catch (error) {
      setMapError(
        error instanceof Error
          ? error.message
          : 'The land query could not be completed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="land-explorer">
      <form
        className="land-filters"
        onSubmit={(event) => void applyFilters(event)}
      >
        <label>
          District
          <input
            value={district}
            placeholder="e.g. Coimbatore"
            onChange={(event) => setDistrict(event.currentTarget.value)}
          />
        </label>
        <label>
          Agency
          <select
            value={agency}
            onChange={(event) => setAgency(event.currentTarget.value)}
          >
            <option value="">All agencies</option>
            <option value="tansidco">TANSIDCO</option>
            <option value="sipcot">SIPCOT</option>
          </select>
        </label>
        <label>
          Plot status
          <select
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value)}
          >
            <option value="">All statuses</option>
            <option value="vacant">Vacant (published records only)</option>
            <option value="unknown">Unknown</option>
            <option value="allotted">Allotted</option>
            <option value="reserved">Reserved</option>
            <option value="litigation">Litigation</option>
            <option value="pending_cancel">Pending cancellation</option>
          </select>
        </label>
        <button disabled={loading} type="submit">
          {loading ? 'Filtering…' : 'Apply filters'}
        </button>
      </form>

      <div className="map-status" role="status">
        <span
          className={`status-badge ${data.mode === 'postgis' ? 'status-published' : 'status-pending-review'}`}
        >
          {data.mode === 'postgis'
            ? 'PostGIS verified records'
            : 'Safe fallback · availability unknown'}
        </span>
        <p>{data.notice}</p>
      </div>

      {mapError === '' ? null : (
        <p className="alert alert-error" role="alert">
          {mapError}
        </p>
      )}
      {lowBandwidth ? (
        <p className="notice" role="status">
          Map tiles were skipped on a low-bandwidth connection. The evidence
          list remains available.
        </p>
      ) : null}
      <div
        ref={container}
        className="map-canvas"
        aria-label="Industrial land map. Use the evidence list below for an accessible alternative."
      >
        {enabled ? null : (
          <p>
            {lowBandwidth
              ? 'Map skipped to save data.'
              : 'Map loads only when it enters view.'}
          </p>
        )}
      </div>

      <section className="land-list" aria-labelledby="land-list-title">
        <div className="section-heading">
          <p className="eyebrow">{data.features.length} mapped records</p>
          <h2 id="land-list-title">Evidence-first results</h2>
        </div>
        {data.features.length === 0 ? (
          <p>No published records match these filters.</p>
        ) : (
          data.features.map(({ properties }) => (
            <article key={properties.id}>
              <div>
                <span className={`plot-dot plot-${properties.status}`} />
                <span>{properties.status.replaceAll('_', ' ')}</span>
              </div>
              <h3>{properties.estateName}</h3>
              {properties.estateNameTa === null ? null : (
                <p lang="ta">{properties.estateNameTa}</p>
              )}
              <p>
                {properties.district} · {properties.agency.toUpperCase()}
                {properties.plotNumber === null
                  ? ''
                  : ` · Plot ${properties.plotNumber}`}
              </p>
              <p>
                {properties.areaCents === null
                  ? 'Area not asserted'
                  : `${properties.areaCents} cents`}{' '}
                · {syncAge(properties.sourceSyncedAt)}
              </p>
              <div className="card-actions">
                <a href={properties.sourceUrl} target="_blank" rel="noreferrer">
                  Official source
                </a>
                <Link
                  href={`/?district=${encodeURIComponent(properties.district)}&estate=${encodeURIComponent(properties.estateSlug)}`}
                >
                  Prefill Matcher
                </Link>
                <Link href={`/estates/${properties.estateSlug}`}>
                  Estate details
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
