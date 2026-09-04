import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, secretsKey } from './secrets';

describe('encrypted secrets', () => {
  const environment = {
    SECRETS_ENCRYPTION_KEY: 'ab'.repeat(32),
    NODE_ENV: 'test',
  } as NodeJS.ProcessEnv;

  it('round-trips a secret with AES-256-GCM', () => {
    const sealed = encryptSecret('telegram-bot-token', environment);
    expect(sealed.startsWith('nilam-secret:v1.')).toBe(true);
    expect(decryptSecret(sealed, environment)).toBe('telegram-bot-token');
  });

  it('refuses production without a 32-byte key', () => {
    expect(() =>
      secretsKey({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });
});
