import { describe, expect, it } from 'vitest';

import { serializeLog, shouldLog } from './log';

describe('structured logs', () => {
  it('emits JSON without secret-bearing fields', () => {
    const line = serializeLog({
      level: 'info',
      message: 'checkout created',
      route: '/api/payments/checkout',
      email: 'user@example.com',
      signature: 'abc',
      paymentId: 'pay_1',
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.message).toBe('checkout created');
    expect(parsed.paymentId).toBe('pay_1');
    expect(parsed.email).toBeUndefined();
    expect(parsed.signature).toBeUndefined();
  });

  it('honours LOG_LEVEL thresholds', () => {
    expect(shouldLog('debug', 'info')).toBe(false);
    expect(shouldLog('error', 'info')).toBe(true);
  });
});
