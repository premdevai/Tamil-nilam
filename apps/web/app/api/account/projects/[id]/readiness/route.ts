import { MatcherInputSchema } from '@nilam/engine';

import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';
import {
  calculateApplicationReady,
  readinessSchema,
} from '../../../../../../lib/project-companion';
import { getNilamAssumptions } from '../../../../../../lib/nilam-truth';
import { recordProjectMilestone } from '../../../../../../lib/project-memory';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = readinessSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_readiness', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const userId = authorization.session.user.id;
  const client = await getDatabase().pool.connect();
  try {
    await client.query('begin');
    const project = await client.query<{
      inputs: Record<string, unknown>;
      resultSnapshot: Record<string, unknown>;
    }>(
      `select inputs, result_snapshot as "resultSnapshot"
       from saved_stacks
       where id = $1::uuid and user_id = $2::uuid
       for update`,
      [id, userId],
    );
    const row = project.rows[0];
    if (row === undefined) {
      await client.query('rollback');
      return Response.json({ error: 'project_not_found' }, { status: 404 });
    }
    const input = MatcherInputSchema.safeParse(row.inputs);
    const assumptions = input.success ? getNilamAssumptions(input.data) : [];
    const previous =
      typeof row.resultSnapshot.project === 'object' &&
      row.resultSnapshot.project !== null &&
      typeof (row.resultSnapshot.project as Record<string, unknown>)
        .readiness === 'object'
        ? ((row.resultSnapshot.project as Record<string, unknown>)
            .readiness as Record<string, unknown>)
        : undefined;
    const readiness = {
      ...parsed.data,
      applicationReady: calculateApplicationReady(
        parsed.data,
        assumptions.map((assumption) => assumption.field),
      ),
      updatedAt: new Date().toISOString(),
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
         '{project,readiness}',
         $3::jsonb,
         true
       ), updated_at = now()
       where id = $1::uuid and user_id = $2::uuid`,
      [id, userId, JSON.stringify(readiness)],
    );
    const previousConfirmed = Array.isArray(previous?.confirmedAssumptions)
      ? previous.confirmedAssumptions.length
      : 0;
    if (readiness.confirmedAssumptions.length > previousConfirmed) {
      await recordProjectMilestone(client.query.bind(client), {
        userId,
        projectId: id,
        kind: 'assumption_confirmed',
        metadata: {
          confirmedCount: readiness.confirmedAssumptions.length,
          totalAssumptions: assumptions.length,
        },
      });
    }
    if (readiness.applicationReady && previous?.applicationReady !== true) {
      await recordProjectMilestone(client.query.bind(client), {
        userId,
        projectId: id,
        kind: 'application_ready',
      });
    }
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'project.readiness_updated', 'saved_stack', $2,
         jsonb_build_object('applicationReady', $3::boolean))`,
      [userId, id, readiness.applicationReady],
    );
    await client.query('commit');
    return Response.json(readiness);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
