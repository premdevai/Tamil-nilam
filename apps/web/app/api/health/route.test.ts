import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('health endpoint', () => {
  it('returns a non-cacheable healthy response', async () => {
    const response = GET();
    const body = (await response.json()) as { service: string; status: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({ service: 'nilam-web', status: 'ok' });
  });
});
