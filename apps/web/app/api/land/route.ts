import { NextResponse, type NextRequest } from 'next/server';

import {
  LandFilterSchema,
  fallbackLandResponse,
} from '../../../lib/land-contract';
import { queryPostgisLand } from '../../../lib/land-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const statuses = search.getAll('status');
  const parsed = LandFilterSchema.safeParse({
    ...(search.get('district') === null
      ? {}
      : { district: search.get('district') }),
    ...(search.get('agency') === null ? {} : { agency: search.get('agency') }),
    ...(statuses.length === 0 ? {} : { status: statuses }),
    ...(search.get('minAreaCents') === null
      ? {}
      : { minAreaCents: search.get('minAreaCents') }),
    ...(search.get('maxAreaCents') === null
      ? {}
      : { maxAreaCents: search.get('maxAreaCents') }),
    ...(search.get('bounds') === null ? {} : { bounds: search.get('bounds') }),
    ...(search.get('limit') === null ? {} : { limit: search.get('limit') }),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid land filter contract.',
        issues: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await queryPostgisLand(parsed.data);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json(fallbackLandResponse(parsed.data), {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      },
    });
  }
}
