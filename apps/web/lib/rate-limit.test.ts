import { describe, expect, it } from 'vitest';

import {
  clientKey,
  consumeRateLimit,
  rateLimitBudget,
  rateLimitClass,
} from './rate-limit';

describe('rate limits', () => {
  it('classifies sensitive routes more tightly than public pages', () => {
    expect(rateLimitClass('/api/auth/signin')).toBe('auth');
    expect(rateLimitBudget('auth').limit).toBeLessThan(
      rateLimitBudget('api').limit,
    );
    expect(rateLimitBudget('payments').limit).toBeLessThan(
      rateLimitBudget('page').limit,
    );
  });

  it('blocks a key after its window budget is exhausted', () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    const key = clientKey('/api/auth/signin', '203.0.113.10');
    const now = 1_000;
    for (let index = 0; index < 10; index += 1) {
      expect(consumeRateLimit(key, now, store).ok).toBe(true);
    }
    expect(consumeRateLimit(key, now, store)).toEqual({
      ok: false,
      retryAfterSeconds: 60,
    });
    expect(consumeRateLimit(key, now + 60_000, store).ok).toBe(true);
  });

  it('isolates budgets for different routes behind the same address', () => {
    expect(clientKey('/api/dprs', '203.0.113.10')).not.toBe(
      clientKey('/api/clients', '203.0.113.10'),
    );
  });
});
