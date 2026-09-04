import { describe, expect, it } from 'vitest';

import { createPaymentGateway, FakePaymentGateway } from './payment-gateway';

describe('payment gateway safety', () => {
  it('creates deterministic fake orders without credentials', async () => {
    const gateway = new FakePaymentGateway('test-secret');
    const input = {
      userId: 'user-1',
      plan: 'dpr_once' as const,
      amountPaise: 149_900,
      receipt: 'receipt-1',
      notes: {},
    };
    expect(await gateway.createCheckout(input)).toEqual(
      await gateway.createCheckout(input),
    );
  });

  it('uses timing-safe HMAC verification semantics', () => {
    const gateway = new FakePaymentGateway('test-secret');
    const message = 'order_1|payment_1';
    expect(
      gateway.verifyCheckoutSignature({
        providerOrderId: 'order_1',
        providerPaymentId: 'payment_1',
        signature: gateway.signForTest(message),
      }),
    ).toBe(true);
    expect(
      gateway.verifyCheckoutSignature({
        providerOrderId: 'order_1',
        providerPaymentId: 'payment_1',
        signature: 'bad',
      }),
    ).toBe(false);
  });

  it('refuses the live adapter without an explicit live unlock', () => {
    expect(() =>
      createPaymentGateway({
        PAYMENT_GATEWAY_MODE: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_live_key',
        RAZORPAY_KEY_SECRET: 'secret-secret-secret',
        RAZORPAY_WEBHOOK_SECRET: 'webhook-secret-secret',
      }),
    ).toThrow(/locked/);
  });
});
