import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';
import { projectDecisionSchema } from '../../../../../../lib/project-companion';
import { recordProjectMilestone } from '../../../../../../lib/project-memory';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = projectDecisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_project_decision' },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const pool = getDatabase().pool;
  const decision = { ...parsed.data, decidedAt: new Date().toISOString() };
  const updated = await pool.query(
    `update saved_stacks
     set result_snapshot = jsonb_set(
       jsonb_set(
         result_snapshot,
         '{project}',
         coalesce(result_snapshot -> 'project', '{}'::jsonb),
         true
       ),
       '{project,decision}',
       $3::jsonb,
       true
     ), updated_at = now()
     where id = $1::uuid and user_id = $2::uuid
     returning id::text`,
    [id, authorization.session.user.id, JSON.stringify(decision)],
  );
  if (updated.rowCount === 0) {
    return Response.json({ error: 'project_not_found' }, { status: 404 });
  }
  await recordProjectMilestone(pool.query.bind(pool), {
    userId: authorization.session.user.id,
    projectId: id,
    kind: 'pursue_skip_decision',
    metadata: { decision: parsed.data.decision },
  });
  return Response.json(decision);
}
