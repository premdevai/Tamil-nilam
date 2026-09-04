import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const result = await getDatabase().pool.query(
    `select id::text, status, row_count as "rowCount",
       result_snapshot as "resultSnapshot", ruleset_version as "rulesetVersion",
       error, created_at as "createdAt"
     from bulk_stack_runs
     where id = $1::uuid and owner_user_id = $2::uuid`,
    [id, authorization.session.user.id],
  );
  const run = result.rows[0];
  if (run === undefined) {
    return Response.json({ error: 'bulk_run_not_found' }, { status: 404 });
  }
  return Response.json(run);
}
