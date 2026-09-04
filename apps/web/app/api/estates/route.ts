import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The TANSIDCO estate index: every estate with published vacancy, its block and
 * backward-block flag, per-type vacancy counts, the estate record and the
 * available-plot rows.
 *
 * Served from the committed snapshot rather than imported, so it stays out of
 * the client bundle — the home page shouldn't pay for it until someone opens
 * the Land Explorer.
 */
export async function GET() {
  try {
    const body = await readFile(
      path.join(process.cwd(), 'data', 'tansidco.json'),
      'utf8',
    );
    return new Response(body, {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.json({ error: 'snapshot unavailable' }, { status: 503 });
  }
}
