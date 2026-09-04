import { CURRENT_RULESET_VERSION, MatcherInputSchema } from '@nilam/engine';
import {
  createRulesetSnapshot,
  hashSnapshot,
  printableReportInputSchema,
} from '@nilam/paid';
import { z } from 'zod';

import { authorizeRequest } from '../../../lib/authz';
import { getDatabase } from '../../../lib/db';
import {
  evaluateMatcherSurface,
  prepareReportSource,
} from '../../../lib/matcher-surfaces';
import { authorizeEntitlement } from '../../../lib/paid-access';
import { SITE_URL } from '../../../lib/public-data';
import { ownedWorkspaceId } from '../../../lib/workspace';

const requestSchema = printableReportInputSchema
  .extend({
    idempotencyKey: z.string().trim().min(12).max(120),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const entitlementError = await authorizeEntitlement(
    authorization.session.user.id,
    'reports:print',
  );
  if (entitlementError !== undefined) return entitlementError;
  const result = await getDatabase().pool.query(
    `select id::text, status, expires_at as "expiresAt", error,
       created_at as "createdAt"
     from printable_reports
     where user_id = $1::uuid
     order by created_at desc limit 50`,
    [authorization.session.user.id],
  );
  return Response.json({ reports: result.rows });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const entitlementError = await authorizeEntitlement(userId, 'reports:print');
  if (entitlementError !== undefined) return entitlementError;
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'invalid_report_input' }, { status: 400 });
  }
  const matcher = MatcherInputSchema.safeParse(parsed.data.matcherInput);
  if (!matcher.success) {
    return Response.json({ error: 'invalid_matcher_input' }, { status: 400 });
  }
  const pool = getDatabase().pool;
  const workspaceError = await ownedWorkspaceId(
    pool,
    parsed.data.clientWorkspaceId,
    userId,
  );
  if (workspaceError !== undefined) return workspaceError;
  const existing = await pool.query<{ id: string; status: string }>(
    `select id::text, status from printable_reports
     where user_id = $1::uuid and idempotency_key = $2`,
    [userId, parsed.data.idempotencyKey],
  );
  if (existing.rows[0] !== undefined) {
    return Response.json({ ...existing.rows[0], replayed: true });
  }
  const evaluation = evaluateMatcherSurface(
    matcher.data,
    parsed.data.rulesetVersion,
    parsed.data.asOf,
  );
  const capturedAt = new Date().toISOString();
  const source = prepareReportSource({
    result: evaluation,
    input: matcher.data,
    ...(parsed.data.title === undefined ? {} : { title: parsed.data.title }),
    generatedAt: capturedAt,
    siteUrl: SITE_URL,
  });
  const rulesetSnapshot = createRulesetSnapshot(
    evaluation.eligible.map((scheme) => ({
      schemeSlug: scheme.schemeId,
      version: 1,
      verifiedOn: scheme.citations[0]?.verifiedOn ?? parsed.data.asOf,
      sourceUrl:
        scheme.citations[0]?.url ?? `${SITE_URL}/schemes/${scheme.schemeId}`,
    })),
    capturedAt,
  );
  const inputHash = hashSnapshot(source);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const created = await client.query<{ id: string }>(
      `insert into printable_reports
         (user_id, client_workspace_id, status, idempotency_key,
          input_snapshot, ruleset_snapshot, input_hash, ruleset_hash)
       values ($1::uuid, $2::uuid, 'queued', $3, $4::jsonb, $5::jsonb, $6, $7)
       returning id::text`,
      [
        userId,
        parsed.data.clientWorkspaceId ?? null,
        parsed.data.idempotencyKey,
        JSON.stringify(source),
        JSON.stringify(rulesetSnapshot),
        inputHash,
        rulesetSnapshot.hash,
      ],
    );
    const reportId = created.rows[0]?.id;
    if (reportId === undefined)
      throw new Error('Printable report was not created.');
    await client.query(
      `insert into operation_jobs
         (task, idempotency_key, payload, max_attempts)
       values ('generate_printable_report', $1,
         jsonb_build_object('reportId', $2::text), 3)
       on conflict (idempotency_key) do nothing`,
      [`printable-report:${reportId}:v1`, reportId],
    );
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'report.queued', 'printable_report', $2,
         jsonb_build_object('rulesetVersion', $3::text))`,
      [userId, reportId, evaluation.rulesetVersion],
    );
    await client.query('commit');
    return Response.json(
      {
        id: reportId,
        status: 'queued',
        rulesetVersion: evaluation.rulesetVersion || CURRENT_RULESET_VERSION,
        inputHash,
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
