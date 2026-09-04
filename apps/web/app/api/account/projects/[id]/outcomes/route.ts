import { randomUUID } from 'node:crypto';

import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';
import {
  outcomeSchema,
  parseProjectCompanion,
  type ProjectOutcome,
} from '../../../../../../lib/project-companion';
import { recordProjectMilestone } from '../../../../../../lib/project-memory';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = outcomeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_outcome', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const userId = authorization.session.user.id;
  const client = await getDatabase().pool.connect();
  try {
    await client.query('begin');
    const selected = await client.query<{
      resultSnapshot: Record<string, unknown>;
    }>(
      `select result_snapshot as "resultSnapshot" from saved_stacks
       where id = $1::uuid and user_id = $2::uuid for update`,
      [id, userId],
    );
    const row = selected.rows[0];
    if (row === undefined) {
      await client.query('rollback');
      return Response.json({ error: 'project_not_found' }, { status: 404 });
    }
    const companion = parseProjectCompanion(row.resultSnapshot);
    const outcome: ProjectOutcome = {
      ...parsed.data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await client.query(
      `update saved_stacks
       set result_snapshot = jsonb_set(
         jsonb_set(
           result_snapshot,
           '{project}',
           coalesce(result_snapshot -> 'project', '{}'::jsonb),
           true
         ),
         '{project,outcomes}',
         $3::jsonb,
         true
       ), updated_at = now()
       where id = $1::uuid and user_id = $2::uuid`,
      [id, userId, JSON.stringify([...companion.outcomes, outcome])],
    );
    if (
      outcome.status === 'submitted' &&
      !companion.outcomes.some((item) => item.status === 'submitted')
    ) {
      await recordProjectMilestone(client.query.bind(client), {
        userId,
        projectId: id,
        kind: 'submitted',
        metadata: { officialReference: outcome.officialReference },
      });
    } else if (
      ['sanctioned', 'allotted', 'claimed', 'rejected'].includes(outcome.status)
    ) {
      await recordProjectMilestone(client.query.bind(client), {
        userId,
        projectId: id,
        kind: 'official_outcome',
        metadata: {
          status: outcome.status,
          officialReference: outcome.officialReference,
        },
      });
    }
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'project.outcome_recorded', 'saved_stack', $2,
         jsonb_build_object(
           'outcomeId', $3::text,
           'status', $4::text,
           'evidenceUrl', $5::text
         ))`,
      [userId, id, outcome.id, outcome.status, outcome.evidenceUrl],
    );
    await client.query('commit');
    return Response.json(outcome, { status: 201 });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
