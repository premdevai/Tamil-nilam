import { describe, expect, it } from 'vitest';

import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
  parseTelegramStartPayload,
  telegramDeepLink,
  validBotSecret,
} from './telegram-link';

describe('Telegram account linking', () => {
  it('creates opaque deep-link tokens and stores only their hash', () => {
    const token = createTelegramLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(hashTelegramLinkToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(telegramDeepLink('NilamLocalBot', token)).toBe(
      `https://t.me/NilamLocalBot?start=nilam_link_${token}`,
    );
    expect(parseTelegramStartPayload(`nilam_link_${token}`)).toBe(token);
  });

  it('rejects malformed payloads and mismatched bot secrets', () => {
    expect(parseTelegramStartPayload('other_payload')).toBeUndefined();
    expect(validBotSecret('correct', 'correct')).toBe(true);
    expect(validBotSecret('wrong', 'correct')).toBe(false);
    expect(validBotSecret(null, 'correct')).toBe(false);
  });
});
