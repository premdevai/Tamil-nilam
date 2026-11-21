import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from './proxy';

function navigate(pathname: string): Response {
  return proxy(
    new NextRequest(`http://localhost:3000${pathname}`, {
      headers: {
        'sec-fetch-dest': 'document',
        'x-forwarded-for': `10.0.0.${pathname.length}`,
      },
    }),
  );
}

describe('proxy page allowlist', () => {
  it('lets browsers open the NEEDS guided path', () => {
    expect(navigate('/needs').status).not.toBe(308);
    expect(navigate('/needs/').status).not.toBe(308);
  });

  it('still sends unknown pages home', () => {
    const response = navigate('/not-a-page');
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });
});
