import { PLAN_ENTITLEMENTS, subscriptionHasAccess } from '@nilam/paid';
import type { EntitlementKey, PaidPlan } from '@nilam/paid';
import { and, eq, gt, isNull, or } from 'drizzle-orm';

import { entitlements, subscriptions } from '@nilam/db';

import { getDatabase } from './db';

export async function hasEntitlement(
  userId: string,
  key: EntitlementKey,
  now = new Date(),
): Promise<boolean> {
  const database = getDatabase().db;
  const [explicit, activeSubscriptions] = await Promise.all([
    database
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          eq(entitlements.key, key),
          isNull(entitlements.revokedAt),
          or(isNull(entitlements.endsAt), gt(entitlements.endsAt, now)),
        ),
      )
      .limit(1),
    database
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        gracePeriodEnd: subscriptions.gracePeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId)),
  ]);
  if (explicit.length > 0) return true;
  return activeSubscriptions.some(
    (subscription) =>
      isPaidPlan(subscription.plan) &&
      PLAN_ENTITLEMENTS[subscription.plan].includes(key) &&
      subscriptionHasAccess(
        subscription.status,
        subscription.currentPeriodEnd,
        subscription.gracePeriodEnd,
        now,
      ),
  );
}

export async function authorizeEntitlement(
  userId: string,
  key: EntitlementKey,
) {
  if (await hasEntitlement(userId, key)) return undefined;
  return Response.json(
    {
      error: 'paid_entitlement_required',
      entitlement: key,
      message:
        'This feature requires an active paid entitlement. Grace periods are honoured automatically.',
    },
    { status: 402 },
  );
}

export function isPaidPlan(value: string): value is PaidPlan {
  return value === 'dpr_once' || value === 'pro' || value === 'consultant';
}
