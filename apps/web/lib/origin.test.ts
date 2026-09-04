import { describe, expect, it } from 'vitest';

import { allowedOrigins, originAllowed } from './origin';

describe('origin checks', () => {
  it('treats localhost and 127.0.0.1 as the same local site', () => {
    expect(allowedOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('allows same-origin mutations and signed webhooks', () => {
    expect(
      originAllowed({
        method: 'POST',
        pathname: '/api/account/deletion',
        origin: 'http://127.0.0.1:3000',
        host: '127.0.0.1:3000',
        secFetchSite: 'same-origin',
        siteUrl: 'http://localhost:3000',
      }),
    ).toBe(true);
    expect(
      originAllowed({
        method: 'POST',
        pathname: '/api/payments/webhook',
        origin: 'https://evil.example',
        host: 'localhost:3000',
        secFetchSite: 'cross-site',
        siteUrl: 'http://localhost:3000',
      }),
    ).toBe(true);
  });

  it('rejects cross-site mutations on cookie-authenticated routes', () => {
    expect(
      originAllowed({
        method: 'POST',
        pathname: '/api/payments/checkout',
        origin: 'https://evil.example',
        host: 'localhost:3000',
        secFetchSite: 'cross-site',
        siteUrl: 'http://localhost:3000',
      }),
    ).toBe(false);
  });
});
