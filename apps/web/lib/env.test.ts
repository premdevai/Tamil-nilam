import { describe, expect, it } from 'vitest';

import { publicEnvSchema, resolveNilamHomeMode, serverEnvSchema } from './env';

describe('web environment', () => {
  it('accepts a complete local environment', () => {
    expect(
      serverEnvSchema.parse({
        DATABASE_URL: 'postgresql://nilam:nilam@localhost:5432/nilam',
        MEILI_HOST: 'http://localhost:7700',
        MEILI_MASTER_KEY: 'a-secure-local-key',
      }),
    ).toMatchObject({
      NODE_ENV: 'development',
      NILAM_HOME_MODE: 'rich',
      RAZORPAY_ALLOW_LIVE: 'false',
      PAYMENT_GATEWAY_MODE: 'disabled',
    });
  });

  it('accepts the verified safe home fallback', () => {
    expect(
      serverEnvSchema.parse({
        DATABASE_URL: 'postgresql://nilam:nilam@localhost:5432/nilam',
        MEILI_HOST: 'http://localhost:7700',
        MEILI_MASTER_KEY: 'a-secure-local-key',
        NILAM_HOME_MODE: 'safe',
      }).NILAM_HOME_MODE,
    ).toBe('safe');
    expect(resolveNilamHomeMode('safe')).toBe('safe');
    expect(resolveNilamHomeMode('prototype')).toBe('rich');
  });

  it('rejects invalid public URLs', () => {
    expect(() =>
      publicEnvSchema.parse({ NEXT_PUBLIC_SITE_URL: 'localhost' }),
    ).toThrow();
  });
});
