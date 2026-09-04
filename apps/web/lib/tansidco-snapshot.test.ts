import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Invariants on the committed TANSIDCO snapshot.
 *
 * These guard the data the Land Explorer renders directly. The ring test in
 * particular earns its place: the source repeats each parcel's vertices for
 * some estates (`[A,B,C,A,A,B,C,A]`), and a double-traversal still *draws* —
 * it just cannot be hit-tested, so five estates were completely unhoverable
 * while looking perfectly fine. Nothing but a geometry assertion catches that.
 */

type Ring = [number, number][];
type Parcel = {
  no: string;
  ring: Ring;
  acre: number | null;
  status: string | null;
};
type EstateFile = { id: number; name: string; plots: Parcel[] };

const DATA = path.join(process.cwd(), 'data');

const closesAt = (ring: Ring): number | null => {
  const start = ring[0];
  if (start === undefined) return null;
  for (let i = 1; i < ring.length; i++) {
    const v = ring[i];
    if (v !== undefined && v[0] === start[0] && v[1] === start[1]) return i;
  }
  return null;
};

const geometryFiles = async () =>
  (await readdir(path.join(DATA, 'estates'))).filter((f) =>
    f.endsWith('.json'),
  );

const readEstate = async (file: string): Promise<EstateFile> =>
  JSON.parse(
    await readFile(path.join(DATA, 'estates', file), 'utf8'),
  ) as EstateFile;

describe('TANSIDCO snapshot', () => {
  it('has an index covering every district with published vacancy', async () => {
    const snap = JSON.parse(
      await readFile(path.join(DATA, 'tansidco.json'), 'utf8'),
    ) as {
      estates: { id: number; district: string; plots: unknown[] }[];
      districts: string[];
      estateCount: number;
    };
    expect(snap.estates.length).toBe(snap.estateCount);
    expect(snap.estates.length).toBeGreaterThan(50);
    expect(new Set(snap.estates.map((e) => e.district))).toEqual(
      new Set(snap.districts),
    );
    expect(new Set(snap.estates.map((e) => e.id)).size).toBe(
      snap.estates.length,
    );
  });

  it('gives every parcel a ring that closes exactly once', async () => {
    const offenders: string[] = [];
    for (const file of await geometryFiles()) {
      const estate = await readEstate(file);
      for (const p of estate.plots) {
        const at = closesAt(p.ring);
        // A repeat after the closing vertex means a double-traversal, which
        // MapLibre draws but cannot hit-test.
        if (at !== null && at + 1 < p.ring.length) {
          offenders.push(
            `${estate.name} plot ${p.no} (${p.ring.length} vertices)`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('gives every parcel at least a triangle inside Tamil Nadu', async () => {
    const tooFewVertices: string[] = [];
    const outsideState: string[] = [];
    for (const file of await geometryFiles()) {
      const estate = await readEstate(file);
      for (const p of estate.plots) {
        if (p.ring.length < 4) {
          tooFewVertices.push(`${estate.name} plot ${p.no}`);
        }
        for (const [lat, lon] of p.ring) {
          if (lat < 8 || lat > 14 || lon < 76 || lon > 81) {
            outsideState.push(`${estate.name} plot ${p.no} at ${lat},${lon}`);
          }
        }
      }
    }
    expect(tooFewVertices).toEqual([]);
    expect(outsideState).toEqual([]);
  });

  it('never quotes a rental figure as an outright price', async () => {
    const snap = JSON.parse(
      await readFile(path.join(DATA, 'tansidco.json'), 'utf8'),
    ) as {
      estates: {
        name: string;
        plots: { no: string; costRs: number | null; costBasis: string }[];
      }[];
    };
    // The source's cost column mixes sale prices with per-sq.ft monthly rents.
    // Anything implausibly small must be flagged, never labelled outright.
    const mislabelled = snap.estates.flatMap((e) =>
      e.plots
        .filter((p) => p.costBasis === 'outright' && (p.costRs ?? 0) < 10_000)
        .map((p) => `${e.name} plot ${p.no}: ₹${p.costRs}`),
    );
    expect(mislabelled).toEqual([]);
  });
});
