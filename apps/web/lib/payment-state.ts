import { createHash } from 'node:crypto';

import { PLAN_ENTITLEMENTS } from '@nilam/paid';
import type { PaidPlan } from '@nilam/paid';
import type { PoolClient } from 'pg';

export type ProviderEvent = {
  id: string;
  event: string;
  created_at?: number | undefined;
  payload?:
    | {
        payment?: { entity?: Record<string, unknown> | undefined } | undefined;
        subscription?:
          { entity?: Record<string, unknown> | undefined } | undefined;
      }
    | undefined;
};

export const PLAN_PRICES: Readonly<Record<PaidPlan, number>> = {
  dpr_once: 149_900,
  pro: 99_900,
  consultant: 249_900,
};

export function providerEventId(event: ProviderEvent, rawBody: string): string {
  if (event.id.length > 0) return event.id;
  return createHash('sha256')
    .update(`${event.event}:${event.created_at ?? 0}:${rawBody}`)
    .digest('hex');
}

export async function processProviderEvent(
  client: PoolClient,
  event: ProviderEvent,
): Promise<void> {
  const payment = event.payload?.payment?.entity;
  const subscription = event.payload?.subscription?.entity;
  const eventAt = new Date((event.created_at ?? Date.now() / 1000) * 1000);

  if (event.event.startsWith('payment.') && payment !== undefined) {
    await processPayment(client, event.event, payment, eventAt);
  }
  if (event.event.startsWith('subscription.') && subscription !== undefined) {
    await processSubscription(client, event.event, subscription, eventAt);
  }
}

async function processPayment(
  client: PoolClient,
  eventType: string,
  entity: Record<string, unknown>,
  eventAt: Date,
) {
  const paymentId = stringValue(entity.id);
  const orderId = optionalString(entity.order_id);
  const subscriptionId = optionalString(entity.subscription_id);
  if (paymentId === undefined)
    throw new Error('Payment event has no payment id.');
  const status =
    eventType === 'payment.captured'
      ? 'captured'
      : eventType === 'payment.authorized'
        ? 'authorized'
        : eventType === 'payment.failed'
          ? 'failed'
          : undefined;
  if (status === undefined) return;

  const updated = await client.query<{
    id: string;
    userId: string;
    subscriptionId: string | null;
  }>(
    `update payments p set provider_payment_id = $1,
         status = $2::payment_status,
         paid_at = case when $2 = 'captured' then $3 else paid_at end,
         raw_payload = $4::jsonb, updated_at = now()
       where (p.provider_order_id = $5 or exists (
         select 1 from subscriptions s where s.id = p.subscription_id
           and s.provider_subscription_id = $6
       )) and p.status <> 'refunded'
       returning p.id::text, p.user_id::text as "userId",
         p.subscription_id::text as "subscriptionId"`,
    [
      paymentId,
      status,
      eventAt,
      JSON.stringify(entity),
      orderId ?? '',
      subscriptionId ?? '',
    ],
  );
  const record = updated.rows[0];
  if (record === undefined || status !== 'captured') return;
  await client.query(
    `insert into payment_receipts
       (payment_id, receipt_number, provider_receipt_url, metadata)
     values ($1::uuid, $2, $3, $4::jsonb)
     on conflict (payment_id) do nothing`,
    [
      record.id,
      `NILAM-${eventAt.toISOString().slice(0, 10).replaceAll('-', '')}-${record.id.slice(0, 8).toUpperCase()}`,
      optionalString(entity.invoice_id) === undefined
        ? null
        : `https://dashboard.razorpay.com/app/invoices/${String(entity.invoice_id)}`,
      JSON.stringify({ providerPaymentId: paymentId }),
    ],
  );
  if (record.subscriptionId === null) {
    await grantEntitlements(
      client,
      record.userId,
      'dpr_once',
      'payment',
      record.id,
      null,
    );
  }
}

async function processSubscription(
  client: PoolClient,
  eventType: string,
  entity: Record<string, unknown>,
  eventAt: Date,
) {
  const providerSubscriptionId = stringValue(entity.id);
  if (providerSubscriptionId === undefined) {
    throw new Error('Subscription event has no subscription id.');
  }
  const status = subscriptionStatusForEvent(eventType);
  if (status === undefined) return;
  const periodEnd = epochDate(entity.current_end);
  const gracePeriodEnd =
    status === 'past_due'
      ? new Date(eventAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : status === 'cancelled'
        ? periodEnd
        : null;
  const result = await client.query<{
    id: string;
    userId: string;
    plan: string;
  }>(
    `update subscriptions set status = $2::subscription_status,
       current_period_end = coalesce($3, current_period_end),
       grace_period_end = $4,
       cancelled_at = case when $2 = 'cancelled' then $5 else cancelled_at end,
       cancel_at_period_end = case when $2 = 'cancelled' then false else cancel_at_period_end end,
       last_provider_event_at = $5, updated_at = now()
     where provider_subscription_id = $1
       and (last_provider_event_at is null or last_provider_event_at <= $5)
     returning id::text, user_id::text as "userId", plan`,
    [providerSubscriptionId, status, periodEnd, gracePeriodEnd, eventAt],
  );
  const subscription = result.rows[0];
  if (subscription === undefined || !isRecurringPlan(subscription.plan)) return;
  if (status === 'active') {
    await grantEntitlements(
      client,
      subscription.userId,
      subscription.plan,
      'subscription',
      subscription.id,
      periodEnd,
    );
  } else if (status === 'expired') {
    await client.query(
      `update entitlements set revoked_at = now(), updated_at = now()
       where source_type = 'subscription' and source_id = $1
         and revoked_at is null`,
      [subscription.id],
    );
  } else {
    await client.query(
      `update entitlements set ends_at = $2, updated_at = now()
       where source_type = 'subscription' and source_id = $1
         and revoked_at is null`,
      [subscription.id, gracePeriodEnd],
    );
  }
}

async function grantEntitlements(
  client: PoolClient,
  userId: string,
  plan: PaidPlan,
  sourceType: 'payment' | 'subscription',
  sourceId: string,
  endsAt: Date | null,
) {
  for (const key of PLAN_ENTITLEMENTS[plan]) {
    await client.query(
      `insert into entitlements
         (user_id, key, source_type, source_id, ends_at)
       values ($1::uuid, $2, $3, $4, $5)
       on conflict (user_id, key, source_type, source_id)
       do update set ends_at = excluded.ends_at, revoked_at = null,
         updated_at = now()`,
      [userId, key, sourceType, sourceId, endsAt],
    );
  }
}

export function webhookReplayDecision(
  record:
    | {
        processedAt: Date | null;
        payloadHash: string;
      }
    | undefined,
  payloadHash: string,
): 'missing' | 'mismatch' | 'replayed' | 'process' {
  if (record === undefined) return 'missing';
  if (record.payloadHash !== payloadHash) return 'mismatch';
  if (record.processedAt !== null) return 'replayed';
  return 'process';
}

export function subscriptionStatusForEvent(eventType: string) {
  if (
    eventType === 'subscription.activated' ||
    eventType === 'subscription.charged' ||
    eventType === 'subscription.resumed'
  ) {
    return 'active';
  }
  if (
    eventType === 'subscription.pending' ||
    eventType === 'subscription.halted'
  ) {
    return 'past_due';
  }
  if (eventType === 'subscription.cancelled') return 'cancelled';
  if (eventType === 'subscription.completed') return 'expired';
  return undefined;
}

function isRecurringPlan(value: string): value is 'pro' | 'consultant' {
  return value === 'pro' || value === 'consultant';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return stringValue(value);
}

function epochDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000)
    : null;
}
