import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';

import { GET } from './route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe('land endpoint', () => {
  it('returns the safe fallback when PostGIS is unavailable', async () => {
    delete process.env.DATABASE_URL;
    const response = await GET(
      new NextRequest(
        'http://localhost/api/land?district=Coimbatore&status=unknown',
      ),
    );
    const body = (await response.json()) as {
      mode: string;
      features: Array<{ properties: { status: string } }>;
    };

    expect(response.status).toBe(200);
    expect(body.mode).toBe('fallback');
    expect(
      body.features.every(({ properties }) => properties.status === 'unknown'),
    ).toBe(true);
  });

  it('rejects filters outside the bounded public contract', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/land?minAreaCents=500&maxAreaCents=20',
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid land filter contract.',
    });
  });
});
