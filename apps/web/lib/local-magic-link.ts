import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type StoredLink = {
  readonly url: string;
  readonly expires: string;
};

function storePath(env: NodeJS.ProcessEnv = process.env): string {
  const root =
    env.DOCUMENT_STORAGE_DIR === undefined
      ? path.join(process.cwd(), '.data')
      : path.dirname(path.resolve(env.DOCUMENT_STORAGE_DIR));
  return path.join(root, 'local-magic-links.json');
}

function readStore(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, StoredLink> {
  try {
    return JSON.parse(readFileSync(storePath(env), 'utf8')) as Record<
      string,
      StoredLink
    >;
  } catch {
    return {};
  }
}

export function rememberLocalMagicLink(
  email: string,
  url: string,
  expires: Date,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === 'production' || env.AUTH_SMTP_URL !== undefined) {
    return;
  }
  const file = storePath(env);
  mkdirSync(path.dirname(file), { recursive: true });
  const store = readStore(env);
  store[email.trim().toLowerCase()] = {
    url,
    expires: expires.toISOString(),
  };
  writeFileSync(file, JSON.stringify(store), 'utf8');
}

export function peekLocalMagicLink(
  email: string,
  now = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.NODE_ENV === 'production' || env.AUTH_SMTP_URL !== undefined) {
    return null;
  }
  const row = readStore(env)[email.trim().toLowerCase()];
  if (row === undefined || Date.parse(row.expires) <= now.getTime()) {
    return null;
  }
  return row.url;
}
