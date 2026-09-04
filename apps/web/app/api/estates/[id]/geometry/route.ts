import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Serves one estate's surveyed plot geometry from the committed TANSIDCO
 * snapshot (`data/estates/<id>.json`, written by scripts/fetch-tansidco.mjs).
 *
 * Per-estate rather than one bundle: the full geometry is ~4 MB across 73
 * estates, and the largest single estate is 435 KB. Nobody needs the other 72.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // The id indexes a file on disk, so it must be digits and nothing else.
  if (!/^\d{1,6}$/.test(id)) {
    return Response.json({ error: 'invalid estate id' }, { status: 400 });
  }

  try {
    const body = await readFile(
      path.join(process.cwd(), 'data', 'estates', `${id}.json`),
      'utf8',
    );
    return new Response(body, {
      headers: {
        'content-type': 'application/json',
        // The snapshot only changes when the fetcher is re-run.
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.json(
      { error: 'no geometry published for this estate' },
      { status: 404 },
    );
  }
}
