import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const LINK_PREFIX = 'nilam_link_';

export function createTelegramLinkToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashTelegramLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function telegramDeepLink(botUsername: string, token: string): string {
  if (!/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) {
    throw new Error('Invalid Telegram bot username');
  }
  return `https://t.me/${botUsername}?start=${LINK_PREFIX}${token}`;
}

export function parseTelegramStartPayload(payload: string): string | undefined {
  if (!payload.startsWith(LINK_PREFIX)) return undefined;
  const token = payload.slice(LINK_PREFIX.length);
  return /^[A-Za-z0-9_-]{32}$/.test(token) ? token : undefined;
}

export function validBotSecret(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (provided === null || expected === undefined) return false;
  const actual = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
