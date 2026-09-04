import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { peekLocalMagicLink, rememberLocalMagicLink } from './local-magic-link';

describe('local magic-link inbox', () => {
  const env = {
    NODE_ENV: 'test',
    DOCUMENT_STORAGE_DIR: path.join(
      mkdtempSync(path.join(tmpdir(), 'nilam-mail-')),
      'documents',
    ),
  };

  it('stores a clickable link outside production when SMTP is unset', () => {
    const expires = new Date(Date.now() + 60_000);
    rememberLocalMagicLink(
      'Person@example.com',
      'https://localhost/api/auth/callback/email?token=one',
      expires,
      env,
    );
    expect(peekLocalMagicLink('person@example.com', new Date(), env)).toBe(
      'https://localhost/api/auth/callback/email?token=one',
    );
  });

  it('stays closed in production and when SMTP is configured', () => {
    const expires = new Date(Date.now() + 60_000);
    rememberLocalMagicLink('a@b.co', 'https://localhost/x', expires, {
      NODE_ENV: 'production',
    });
    expect(
      peekLocalMagicLink('a@b.co', new Date(), { NODE_ENV: 'production' }),
    ).toBe(null);
    rememberLocalMagicLink('a@b.co', 'https://localhost/x', expires, {
      NODE_ENV: 'development',
      AUTH_SMTP_URL: 'smtp://localhost:25',
      DOCUMENT_STORAGE_DIR: env.DOCUMENT_STORAGE_DIR,
    });
    expect(
      peekLocalMagicLink('a@b.co', new Date(), {
        NODE_ENV: 'development',
        AUTH_SMTP_URL: 'smtp://localhost:25',
        DOCUMENT_STORAGE_DIR: env.DOCUMENT_STORAGE_DIR,
      }),
    ).toBe(null);
  });
});
