import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const pool = getDatabase().pool;
  const existing = await pool.query<{
    status: string;
    generationAttempts: number;
  }>(
    `select status, generation_attempts as "generationAttempts"
     from generated_dprs
     where id = $1::uuid and user_id = $2::uuid`,
    [id, authorization.session.user.id],
  );
  const dpr = existing.rows[0];
  if (dpr === undefined) {
    return Response.json({ error: 'dpr_not_found' }, { status: 404 });
  }
  if (dpr.status !== 'failed') {
    return Response.json(
      { error: 'retry_not_available', status: dpr.status },
      { status: 409 },
    );
  }
  const attempt = dpr.generationAttempts + 1;
  await pool.query(
    `update generated_dprs
     set status = 'queued', error = null, updated_at = now()
     where id = $1::uuid`,
    [id],
  );
  await pool.query(
    `insert into operation_jobs
       (task, idempotency_key, payload, max_attempts)
     values ('generate_dpr', $1, jsonb_build_object('dprId', $2::text), 3)
     on conflict (idempotency_key) do nothing`,
    [`generate-dpr:${id}:retry-${attempt}`, id],
  );
  return Response.json({ id, status: 'queued' });
}
