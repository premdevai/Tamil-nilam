import { z } from 'zod';

import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';
import { createPaymentGateway } from '../../../../../lib/payment-gateway';

const schema = z
  .object({
    subscriptionId: z.uuid(),
    atPeriodEnd: z.boolean().default(true),
  })
  .strict();

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_cancellation_request' },
      { status: 400 },
    );
  }
  const pool = getDatabase().pool;
  const existing = await pool.query<{
    providerSubscriptionId: string;
    currentPeriodEnd: Date | null;
  }>(
    `select provider_subscription_id as "providerSubscriptionId",
       current_period_end as "currentPeriodEnd"
     from subscriptions
     where id = $1::uuid and user_id = $2::uuid
       and status in ('pending', 'active', 'past_due')`,
    [parsed.data.subscriptionId, authorization.session.user.id],
  );
  const subscription = existing.rows[0];
  if (subscription === undefined) {
    return Response.json({ error: 'subscription_not_found' }, { status: 404 });
  }
  await createPaymentGateway().cancelSubscription(
    subscription.providerSubscriptionId,
    parsed.data.atPeriodEnd,
  );
  const now = new Date();
  const gracePeriodEnd = parsed.data.atPeriodEnd
    ? subscription.currentPeriodEnd
    : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await pool.query(
    `update subscriptions set
       cancel_at_period_end = $3,
       status = case when $3 then status else 'cancelled'::subscription_status end,
       cancelled_at = case when $3 then cancelled_at else now() end,
       grace_period_end = $4, updated_at = now()
     where id = $1::uuid and user_id = $2::uuid`,
    [
      parsed.data.subscriptionId,
      authorization.session.user.id,
      parsed.data.atPeriodEnd,
      gracePeriodEnd,
    ],
  );
  await pool.query(
    `update entitlements set ends_at = $2, updated_at = now()
     where source_type = 'subscription' and source_id = $1
       and revoked_at is null`,
    [parsed.data.subscriptionId, gracePeriodEnd],
  );
  await pool.query(
    `insert into audit_records
       (actor_id, action, target_type, target_id, metadata)
     values ($1::uuid, 'subscription.cancellation_requested', 'subscription',
       $2, jsonb_build_object('atPeriodEnd', $3::boolean))`,
    [
      authorization.session.user.id,
      parsed.data.subscriptionId,
      parsed.data.atPeriodEnd,
    ],
  );
  return Response.json({
    cancellationScheduled: parsed.data.atPeriodEnd,
    accessUntil: gracePeriodEnd,
  });
}
