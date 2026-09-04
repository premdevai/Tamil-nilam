import {
  createInputSnapshot,
  createRulesetSnapshot,
  dprFinancialInputSchema,
  hashSnapshot,
} from '@nilam/paid';
import { z } from 'zod';

import { authorizeRequest } from '../../../lib/authz';
import { getDatabase } from '../../../lib/db';
import { authorizeEntitlement } from '../../../lib/paid-access';

const requestSchema = z
  .object({
    input: dprFinancialInputSchema,
    idempotencyKey: z.string().trim().min(12).max(120),
    clientWorkspaceId: z.uuid().optional(),
    businessProfileId: z.uuid().optional(),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const result = await getDatabase().pool.query(
    `select id::text, status, document_version as "documentVersion",
       validation_warnings as "validationWarnings",
       expires_at as "expiresAt", error, created_at as "createdAt"
     from generated_dprs where user_id = $1::uuid
     order by created_at desc limit 100`,
    [authorization.session.user.id],
  );
  return Response.json({ dprs: result.rows });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const entitlementError = await authorizeEntitlement(userId, 'dpr:create');
  if (entitlementError !== undefined) return entitlementError;
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error: 'invalid_dpr_input',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  const pool = getDatabase().pool;
  if (parsed.data.clientWorkspaceId !== undefined) {
    const workspace = await pool.query(
      `select 1 from client_workspaces
       where id = $1::uuid and consultant_user_id = $2::uuid
         and archived_at is null`,
      [parsed.data.clientWorkspaceId, userId],
    );
    if (workspace.rowCount === 0) {
      return Response.json({ error: 'client_not_found' }, { status: 404 });
    }
  }
  if (parsed.data.businessProfileId !== undefined) {
    const profile = await pool.query(
      `select 1 from business_profiles
       where id = $1::uuid and owner_user_id = $2::uuid`,
      [parsed.data.businessProfileId, userId],
    );
    if (profile.rowCount === 0) {
      return Response.json({ error: 'profile_not_found' }, { status: 404 });
    }
  }

  const existing = await pool.query<{ id: string; status: string }>(
    `select id::text, status from generated_dprs
     where user_id = $1::uuid and idempotency_key = $2`,
    [userId, parsed.data.idempotencyKey],
  );
  if (existing.rows[0] !== undefined) {
    return Response.json({ ...existing.rows[0], replayed: true });
  }

  const capturedAt = new Date().toISOString();
  const rules = await pool.query<{
    schemeSlug: string;
    version: number;
    verifiedOn: string;
    sourceUrl: string;
  }>(
    `select s.slug as "schemeSlug", rv.version,
       rv.verified_on::text as "verifiedOn", gr.url as "sourceUrl"
     from rule_versions rv
     join schemes s on s.id = rv.scheme_id
     join go_references gr on gr.id = rv.go_reference_id
     where rv.effective_from <= current_date
       and (rv.effective_to is null or rv.effective_to >= current_date)
     order by s.slug, rv.version`,
  );
  const inputSnapshot = createInputSnapshot(parsed.data.input, capturedAt);
  const rulesetSnapshot = createRulesetSnapshot(rules.rows, capturedAt);
  const inputHash = hashSnapshot(inputSnapshot);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const dpr = await client.query<{ id: string }>(
      `insert into generated_dprs
         (user_id, client_workspace_id, business_profile_id, status,
          idempotency_key, input_snapshot, ruleset_snapshot, input_hash,
          ruleset_hash, validation_warnings)
       values ($1::uuid, $2::uuid, $3::uuid, 'queued', $4, $5::jsonb,
         $6::jsonb, $7, $8, $9::jsonb)
       returning id::text`,
      [
        userId,
        parsed.data.clientWorkspaceId ?? null,
        parsed.data.businessProfileId ?? null,
        parsed.data.idempotencyKey,
        JSON.stringify(inputSnapshot),
        JSON.stringify(rulesetSnapshot),
        inputHash,
        rulesetSnapshot.hash,
        JSON.stringify(inputSnapshot.warnings),
      ],
    );
    const dprId = dpr.rows[0]?.id;
    if (dprId === undefined) throw new Error('DPR was not created.');
    await client.query(
      `insert into operation_jobs
         (task, idempotency_key, payload, max_attempts)
       values ('generate_dpr', $1, jsonb_build_object('dprId', $2::text), 3)
       on conflict (idempotency_key) do nothing`,
      [`generate-dpr:${dprId}:v1`, dprId],
    );
    await client.query(
      `with consumable as (
         select id from entitlements
         where user_id = $1::uuid and key = 'dpr:create'
           and source_type = 'payment' and revoked_at is null
           and (ends_at is null or ends_at > now())
         order by starts_at for update skip locked limit 1
       )
       update entitlements set revoked_at = now(), updated_at = now()
       where id in (select id from consumable)`,
      [userId],
    );
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'dpr.queued', 'generated_dpr', $2,
         jsonb_build_object('inputHash', $3::text, 'rulesetHash', $4::text))`,
      [userId, dprId, inputHash, rulesetSnapshot.hash],
    );
    await client.query('commit');
    return Response.json(
      {
        id: dprId,
        status: 'queued',
        validationWarnings: inputSnapshot.warnings,
        inputHash,
        rulesetHash: rulesetSnapshot.hash,
      },
      { status: 202 },
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
