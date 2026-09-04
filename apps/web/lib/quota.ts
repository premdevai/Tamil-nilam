import { PLAN_LIMITS, usagePeriodKey, type PaidPlan } from '@nilam/paid';
import type { PoolClient } from 'pg';

import { getDatabase } from './db';
import { hasEntitlement } from './paid-access';

export async function activePlan(userId: string): Promise<PaidPlan | null> {
  if (await hasEntitlement(userId, 'clients:write')) return 'consultant';
  if (await hasEntitlement(userId, 'bulk:run')) return 'pro';
  if (await hasEntitlement(userId, 'dpr:create')) return 'dpr_once';
  return null;
}

export async function planLimitsFor(userId: string) {
  const plan = await activePlan(userId);
  return plan === null ? PLAN_LIMITS.dpr_once : PLAN_LIMITS[plan];
}

export async function consumeUsage(input: {
  client: PoolClient;
  userId: string;
  capability: string;
  quantity: number;
  limit: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<Response | undefined> {
  await input.client.query(
    `select id from users where id = $1::uuid for update`,
    [input.userId],
  );
  const periodKey = usagePeriodKey();
  await input.client.query(
    `insert into usage_ledger
       (user_id, capability, period_key, quantity, idempotency_key, metadata)
     values ($1::uuid, $2, $3, $4, $5, $6::jsonb)
     on conflict (idempotency_key) do nothing`,
    [
      input.userId,
      input.capability,
      periodKey,
      input.quantity,
      input.idempotencyKey,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const used = await input.client.query<{ total: string }>(
    `select coalesce(sum(quantity), 0)::text as total
     from usage_ledger
     where user_id = $1::uuid and capability = $2 and period_key = $3`,
    [input.userId, input.capability, periodKey],
  );
  if (Number(used.rows[0]?.total ?? 0) > input.limit) {
    return Response.json(
      {
        error: 'quota_exceeded',
        capability: input.capability,
        limit: input.limit,
        message:
          'This plan’s usage quota for the current month has been reached.',
      },
      { status: 402 },
    );
  }
  return undefined;
}

export async function countOwned(
  table: 'business_profiles' | 'client_workspaces',
  userId: string,
): Promise<number> {
  const column =
    table === 'business_profiles' ? 'owner_user_id' : 'consultant_user_id';
  const result = await getDatabase().pool.query<{ count: string }>(
    `select count(*)::text as count from ${table} where ${column} = $1::uuid
       ${table === 'client_workspaces' ? 'and archived_at is null' : ''}`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
