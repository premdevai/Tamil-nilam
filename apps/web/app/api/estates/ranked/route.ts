import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalizeDistrict, districtsMatch } from '@nilam/engine';

import { estateSlug } from '../../../../lib/tansidco-estates';

type Estate = {
  id: number;
  name: string;
  district: string;
  block: string | null;
  backward: boolean;
  vacant: { total: number };
  plots: {
    no: string;
    extent: number | null;
    type: string;
    costRs: number | null;
    costBasis: string;
  }[];
};

/**
 * Top matching estates for a Matcher profile, ranked server-side so the home
 * page never downloads the 361 KB estate index just to show three rows.
 *
 * Ranking is the same shape the prototype used — district first, then whether
 * the backward-block status matches what the user selected, then vacancy — but
 * over the real TANSIDCO snapshot.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const district = url.searchParams.get('district') ?? '';
  const backward = url.searchParams.get('backward') === '1';

  let estates: Estate[];
  let fetchedAt: string | null;
  try {
    const raw = await readFile(
      path.join(process.cwd(), 'data', 'tansidco.json'),
      'utf8',
    );
    const snapshot = JSON.parse(raw) as {
      estates: Estate[];
      fetchedAt?: string;
    };
    estates = snapshot.estates;
    fetchedAt = snapshot.fetchedAt ?? null;
  } catch {
    return Response.json({ error: 'snapshot unavailable' }, { status: 503 });
  }

  const cheapestPerAcre = (e: Estate): number | null => {
    const rates = e.plots
      .filter(
        (p) =>
          /plot/i.test(p.type) &&
          p.costBasis === 'outright' &&
          p.costRs !== null &&
          p.extent !== null &&
          p.extent > 0,
      )
      .map((p) => (p.costRs as number) / (p.extent as number));
    return rates.length === 0 ? null : Math.min(...rates);
  };

  const ranked = estates
    .map((e) => ({
      e,
      score:
        (districtsMatch(e.district, district) ? 4 : 0) +
        (e.backward === backward ? 2 : 0) +
        Math.min(e.vacant.total / 6, 2),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ e }) => ({
      id: e.id,
      slug: estateSlug(e.name, canonicalizeDistrict(e.district) ?? e.district),
      name: e.name,
      district: e.district,
      block: e.block,
      backward: e.backward,
      vacant: e.vacant.total,
      fromPerAcre: cheapestPerAcre(e),
    }));

  // The Matcher's district dropdown is driven by this too, so it can only
  // offer districts we actually hold estates for.
  const districts = [...new Set(estates.map((e) => e.district))].sort();

  return Response.json(
    { district, backward, ranked, districts, fetchedAt },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
