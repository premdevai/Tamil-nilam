import { PLAN_ENTITLEMENTS } from '@nilam/paid';

import { authorizeRequest } from '../../../lib/authz';
import { getDatabase } from '../../../lib/db';
import { activePlan } from '../../../lib/quota';
import { hasEntitlement, isPaidPlan } from '../../../lib/paid-access';

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const pool = getDatabase().pool;
  const [subscriptions, entitlements, receipts] = await Promise.all([
    pool.query(
      `select id::text, plan, status, current_period_end as "currentPeriodEnd",
         grace_period_end as "gracePeriodEnd", cancel_at_period_end as "cancelAtPeriodEnd"
       from subscriptions where user_id = $1::uuid
       order by created_at desc limit 20`,
      [userId],
    ),
    pool.query(
      `select key, source_type as "sourceType", ends_at as "endsAt"
       from entitlements
       where user_id = $1::uuid and revoked_at is null
       order by starts_at desc`,
      [userId],
    ),
    pool.query(
      `select r.receipt_number as "receiptNumber", r.issued_at as "issuedAt",
         p.amount_paise as "amountPaise", p.status
       from payment_receipts r join payments p on p.id = r.payment_id
       where p.user_id = $1::uuid
       order by r.issued_at desc limit 20`,
      [userId],
    ),
  ]);
  const plan = await activePlan(userId);
  const keys =
    plan === null || !isPaidPlan(plan) ? [] : PLAN_ENTITLEMENTS[plan];
  const printable = await hasEntitlement(userId, 'reports:print');
  return Response.json({
    plan,
    entitlements: keys,
    printable,
    subscriptions: subscriptions.rows,
    ledger: entitlements.rows,
    receipts: receipts.rows,
    disclaimer:
      'NILAM never claims legal, tax, investment or bank approval. Paid documents are directional planning support only.',
  });
}
