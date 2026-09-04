import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('readiness endpoint', () => {
  it('reports Razorpay live as locked when the unlock flag is absent', async () => {
    const previous = process.env.RAZORPAY_ALLOW_LIVE;
    delete process.env.RAZORPAY_ALLOW_LIVE;
    const response = await GET();
    const body = (await response.json()) as {
      checks: { razorpayLiveLocked: boolean; paymentGateway: string };
    };
    if (previous === undefined) {
      delete process.env.RAZORPAY_ALLOW_LIVE;
    } else {
      process.env.RAZORPAY_ALLOW_LIVE = previous;
    }
    expect(body.checks.razorpayLiveLocked).toBe(true);
    expect(body.checks.paymentGateway).toBe(
      process.env.PAYMENT_GATEWAY_MODE ?? 'disabled',
    );
  });
});
