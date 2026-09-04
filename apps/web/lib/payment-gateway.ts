import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { PaidPlan } from '@nilam/paid';

export type CheckoutOrder = {
  provider: 'fake' | 'razorpay';
  providerOrderId: string;
  providerSubscriptionId?: string;
  amountPaise: number;
  currency: 'INR';
  publicKey: string;
};

export type CreateCheckoutInput = {
  userId: string;
  plan: PaidPlan;
  amountPaise: number;
  receipt: string;
  notes: Readonly<Record<string, string>>;
};

export interface PaymentGateway {
  readonly provider: 'fake' | 'razorpay';
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutOrder>;
  cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<void>;
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSubscriptionId?: string;
    signature: string;
  }): boolean;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

export function createPaymentGateway(
  environment:
    NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): PaymentGateway {
  const mode = environment.PAYMENT_GATEWAY_MODE ?? 'fake';
  if (mode === 'disabled') return new DisabledPaymentGateway();
  if (mode === 'fake') {
    return new FakePaymentGateway(
      environment.FAKE_PAYMENT_SECRET ?? 'nilam-safe-fake-payment-secret',
    );
  }
  if (mode !== 'razorpay') {
    throw new Error(`Unsupported payment gateway mode: ${mode}`);
  }
  if (environment.RAZORPAY_ALLOW_LIVE !== 'true') {
    throw new Error(
      'Razorpay live adapter is locked. Set RAZORPAY_ALLOW_LIVE=true only in an approved environment.',
    );
  }
  const keyId = required(environment.RAZORPAY_KEY_ID, 'RAZORPAY_KEY_ID');
  const keySecret = required(
    environment.RAZORPAY_KEY_SECRET,
    'RAZORPAY_KEY_SECRET',
  );
  const webhookSecret = required(
    environment.RAZORPAY_WEBHOOK_SECRET,
    'RAZORPAY_WEBHOOK_SECRET',
  );
  return new RazorpayGateway(keyId, keySecret, webhookSecret, environment);
}

export class FakePaymentGateway implements PaymentGateway {
  readonly provider = 'fake' as const;

  constructor(private readonly secret: string) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutOrder> {
    const stableId = createHmac('sha256', this.secret)
      .update(`${input.userId}:${input.receipt}:${input.plan}`)
      .digest('hex')
      .slice(0, 24);
    return {
      provider: 'fake',
      providerOrderId: `order_fake_${stableId}`,
      ...(input.plan === 'dpr_once'
        ? {}
        : { providerSubscriptionId: `sub_fake_${stableId}` }),
      amountPaise: input.amountPaise,
      currency: 'INR',
      publicKey: 'rzp_test_nilam_fake',
    };
  }

  async cancelSubscription(): Promise<void> {
    await Promise.resolve();
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSubscriptionId?: string;
    signature: string;
  }): boolean {
    const message =
      input.providerSubscriptionId === undefined
        ? `${input.providerOrderId}|${input.providerPaymentId}`
        : `${input.providerPaymentId}|${input.providerSubscriptionId}`;
    return safeSignature(message, input.signature, this.secret);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return safeSignature(rawBody, signature, this.secret);
  }

  signForTest(message: string): string {
    return createHmac('sha256', this.secret).update(message).digest('hex');
  }
}

class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay' as const;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    private readonly environment:
      NodeJS.ProcessEnv | Record<string, string | undefined>,
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutOrder> {
    if (input.plan === 'dpr_once') {
      const result = await this.request<{ id: string; amount: number }>(
        '/orders',
        {
          amount: input.amountPaise,
          currency: 'INR',
          receipt: input.receipt,
          notes: input.notes,
        },
      );
      return {
        provider: 'razorpay',
        providerOrderId: result.id,
        amountPaise: result.amount,
        currency: 'INR',
        publicKey: this.keyId,
      };
    }
    const planId =
      input.plan === 'consultant'
        ? required(
            this.environment.RAZORPAY_CONSULTANT_PLAN_ID,
            'RAZORPAY_CONSULTANT_PLAN_ID',
          )
        : required(
            this.environment.RAZORPAY_PRO_PLAN_ID,
            'RAZORPAY_PRO_PLAN_ID',
          );
    const result = await this.request<{ id: string }>('/subscriptions', {
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: input.notes,
    });
    return {
      provider: 'razorpay',
      providerOrderId: `subscription:${result.id}`,
      providerSubscriptionId: result.id,
      amountPaise: input.amountPaise,
      currency: 'INR',
      publicKey: this.keyId,
    };
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<void> {
    await this.request(`/subscriptions/${providerSubscriptionId}/cancel`, {
      cancel_at_cycle_end: atPeriodEnd ? 1 : 0,
    });
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSubscriptionId?: string;
    signature: string;
  }): boolean {
    const message =
      input.providerSubscriptionId === undefined
        ? `${input.providerOrderId}|${input.providerPaymentId}`
        : `${input.providerPaymentId}|${input.providerSubscriptionId}`;
    return safeSignature(message, input.signature, this.keySecret);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return safeSignature(rawBody, signature, this.webhookSecret);
  }

  private async request<T>(
    path: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<T> {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        'content-type': 'application/json',
        'x-razorpay-idempotency-key': randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Razorpay request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

class DisabledPaymentGateway implements PaymentGateway {
  readonly provider = 'fake' as const;

  createCheckout(): Promise<CheckoutOrder> {
    return Promise.reject(new Error('Paid checkout is disabled.'));
  }

  cancelSubscription(): Promise<void> {
    return Promise.reject(new Error('Paid checkout is disabled.'));
  }

  verifyCheckoutSignature(): boolean {
    return false;
  }

  verifyWebhook(): boolean {
    return false;
  }
}

function safeSignature(
  message: string,
  providedSignature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(message).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(providedSignature, 'hex');
  } catch {
    return false;
  }
  return (
    provided.length === expected.length && timingSafeEqual(expected, provided)
  );
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
