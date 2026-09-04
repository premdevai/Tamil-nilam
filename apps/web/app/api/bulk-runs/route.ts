import { CURRENT_RULESET_VERSION } from '@nilam/engine';
import { parseBulkStackCsv } from '@nilam/paid';
import { z } from 'zod';

import { authorizeRequest } from '../../../lib/authz';
import { getDatabase } from '../../../lib/db';
import { authorizeEntitlement } from '../../../lib/paid-access';
import { consumeUsage, planLimitsFor } from '../../../lib/quota';
import { ownedWorkspaceId } from '../../../lib/workspace';

const schema = z
  .object({
    csv: z.string().min(10).max(2_000_000),
    rulesetVersion: z.string().min(1).max(40).default(CURRENT_RULESET_VERSION),
    idempotencyKey: z.string().trim().min(12).max(120),
    clientWorkspaceId: z.uuid().optional(),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const entitlementError = await authorizeEntitlement(
    authorization.session.user.id,
    'bulk:run',
  );
  if (entitlementError !== undefined) return entitlementError;
  const result = await getDatabase().pool.query(
    `select id::text, status, row_count as "rowCount",
       ruleset_version as "rulesetVersion", error, created_at as "createdAt"
     from bulk_stack_runs
     where owner_user_id = $1::uuid
     order by created_at desc limit 50`,
    [authorization.session.user.id],
  );
  return Response.json({ runs: result.rows });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const entitlementError = await authorizeEntitlement(userId, 'bulk:run');
  if (entitlementError !== undefined) return entitlementError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_bulk_import' }, { status: 400 });
  }
  const limits = await planLimitsFor(userId);
  let rows;
  try {
    rows = parseBulkStackCsv(parsed.data.csv, limits.bulkRowsPerMonth);
  } catch (error) {
    return Response.json(
      {
        error: 'invalid_csv',
        message:
          error instanceof Error ? error.message : 'CSV could not be parsed.',
      },
      { status: 400 },
    );
  }
  const pool = getDatabase().pool;
  const workspaceError = await ownedWorkspaceId(
    pool,
    parsed.data.clientWorkspaceId,
    userId,
  );
  if (workspaceError !== undefined) return workspaceError;
  const existing = await pool.query<{ id: string; status: string }>(
    `select id::text, status from bulk_stack_runs
     where owner_user_id = $1::uuid
       and id in (
         select (payload ->> 'runId')::uuid from operation_jobs
         where idempotency_key = $2
       )`,
    [userId, `bulk-run:${userId}:${parsed.data.idempotencyKey}`],
  );
  if (existing.rows[0] !== undefined) {
    return Response.json({ ...existing.rows[0], replayed: true });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const quotaError = await consumeUsage({
      client,
      userId,
      capability: 'bulk:run',
      quantity: rows.length,
      limit: limits.bulkRowsPerMonth,
      idempotencyKey: `bulk:${userId}:${parsed.data.idempotencyKey}`,
    });
    if (quotaError !== undefined) {
      await client.query('rollback');
      return quotaError;
    }
    const created = await client.query<{ id: string }>(
      `insert into bulk_stack_runs
         (owner_user_id, client_workspace_id, status, input_rows, row_count,
          ruleset_version)
       values ($1::uuid, $2::uuid, 'queued', $3::jsonb, $4, $5)
       returning id::text`,
      [
        userId,
        parsed.data.clientWorkspaceId ?? null,
        JSON.stringify(rows),
        rows.length,
        parsed.data.rulesetVersion,
      ],
    );
    const runId = created.rows[0]?.id;
    if (runId === undefined) throw new Error('Bulk run was not created.');
    await client.query(
      `insert into operation_jobs
         (task, idempotency_key, payload, max_attempts)
       values ('run_bulk_stack', $1, jsonb_build_object('runId', $2::text), 3)
       on conflict (idempotency_key) do nothing`,
      [`bulk-run:${userId}:${parsed.data.idempotencyKey}`, runId],
    );
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'bulk.queued', 'bulk_stack_run', $2,
         jsonb_build_object('rowCount', $3::int))`,
      [userId, runId, rows.length],
    );
    await client.query('commit');
    return Response.json(
      { id: runId, status: 'queued', rowCount: rows.length },
      { status: 202 },
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
