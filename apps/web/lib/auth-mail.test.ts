import { afterEach, describe, expect, it, vi } from 'vitest';

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { sendMagicLink } from './auth-mail';
import { peekLocalMagicLink } from './local-magic-link';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('magic-link transport', () => {
  const message = {
    identifier: 'person@example.com',
    url: 'https://localhost/api/auth/callback/email?token=one-time',
    expires: new Date('2026-08-21T00:15:00.000Z'),
  };

  it('uses a credential-free local transport outside production', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const env = {
      NODE_ENV: 'test',
      DOCUMENT_STORAGE_DIR: path.join(
        mkdtempSync(path.join(tmpdir(), 'nilam-mail-')),
        'documents',
      ),
    };
    await sendMagicLink(message, env);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).toContain('"transport":"local-email"');
    expect(
      peekLocalMagicLink(
        message.identifier,
        new Date('2026-08-21T00:00:00.000Z'),
        env,
      ),
    ).toBe(message.url);
  });

  it('fails closed when production SMTP is missing', async () => {
    await expect(
      sendMagicLink(message, { NODE_ENV: 'production' }),
    ).rejects.toThrow('AUTH_SMTP_URL is required in production');
  });
});
