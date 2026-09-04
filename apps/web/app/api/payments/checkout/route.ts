import { randomUUID } from 'node:crypto';

import type { PaidPlan } from '@nilam/paid';
import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import { createPaymentGateway } from '../../../../lib/payment-gateway';
import { PLAN_PRICES } from '../../../../lib/payment-state';

const checkoutSchema = z
  .object({
    plan: z.enum(['dpr_once', 'pro', 'consultant']),
    idempotencyKey: z.string().trim().min(12).max(120),
  })
  .strict();

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const parsed = checkoutSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_checkout_request' },
      { status: 400 },
    );
  }
  const { idempotencyKey, plan } = parsed.data;
  const userId = authorization.session.user.id;
  const pool = getDatabase().pool;
  const existing = await pool.query<{
    paymentId: string;
    providerOrderId: string | null;
    providerSubscriptionId: string | null;
    amountPaise: number;
    provider: string;
  }>(
    `select p.id::text as "paymentId",
       p.provider_order_id as "providerOrderId",
       s.provider_subscription_id as "providerSubscriptionId",
       p.amount_paise as "amountPaise", p.provider
     from payments p left join subscriptions s on s.id = p.subscription_id
     where p.user_id = $1::uuid and p.idempotency_key = $2`,
    [userId, idempotencyKey],
  );
  const prior = existing.rows[0];
  if (prior !== undefined) {
    return Response.json({ ...prior, replayed: true });
  }

  const amountPaise = PLAN_PRICES[plan];
  const receipt = `nilam-${idempotencyKey.slice(0, 32)}`;
  let checkout;
  try {
    checkout = await createPaymentGateway().createCheckout({
      userId,
      plan,
      amountPaise,
      receipt,
      notes: {
        nilam_user_id: userId,
        nilam_plan: plan,
        nilam_idempotency_key: idempotencyKey,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'checkout_unavailable',
        message:
          error instanceof Error ? error.message : 'Checkout is unavailable.',
      },
      { status: 503 },
    );
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    let subscriptionId: string | null = null;
    if (checkout.providerSubscriptionId !== undefined) {
      const subscription = await client.query<{ id: string }>(
        `insert into subscriptions
           (user_id, provider_subscription_id, provider, plan, status)
         values ($1::uuid, $2, $3, $4, 'pending')
         on conflict (provider_subscription_id) do update
           set updated_at = now()
         returning id::text`,
        [userId, checkout.providerSubscriptionId, checkout.provider, plan],
      );
      subscriptionId = subscription.rows[0]?.id ?? null;
    }
    const payment = await client.query<{ id: string }>(
      `insert into payments
         (user_id, subscription_id, provider_payment_id, provider_order_id,
          provider, idempotency_key, amount_paise, currency, status, raw_payload)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'INR', 'created',
         jsonb_build_object('plan', $8::text))
       on conflict (idempotency_key) do update set updated_at = now()
       returning id::text`,
      [
        userId,
        subscriptionId,
        `pending:${randomUUID()}`,
        checkout.providerOrderId,
        checkout.provider,
        idempotencyKey,
        amountPaise,
        plan satisfies PaidPlan,
      ],
    );
    const paymentId = payment.rows[0]?.id;
    if (paymentId === undefined)
      throw new Error('Payment record was not created.');
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'payment.checkout_created', 'payment', $2,
         jsonb_build_object('plan', $3::text, 'provider', $4::text))`,
      [userId, paymentId, plan, checkout.provider],
    );
    await client.query('commit');
    return Response.json(
      {
        paymentId,
        ...checkout,
        plan,
        testMode: checkout.provider === 'fake',
      },
      { status: 201 },
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
