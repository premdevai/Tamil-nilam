import { randomUUID } from 'node:crypto';

import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';
import {
  executionTaskSchema,
  parseProjectCompanion,
  type ProjectTask,
} from '../../../../../../lib/project-companion';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = executionTaskSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_execution_task', issues: parsed.error.issues },
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
    const task: ProjectTask = {
      ...parsed.data,
      id: randomUUID(),
      proofUrl: '',
      completedAt: null,
      queryLog: [],
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
         '{project,tasks}',
         $3::jsonb,
         true
       ), updated_at = now()
       where id = $1::uuid and user_id = $2::uuid`,
      [id, userId, JSON.stringify([...companion.tasks, task])],
    );
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'project.task_created', 'saved_stack', $2,
         jsonb_build_object('taskId', $3::text, 'officialUrl', $4::text))`,
      [userId, id, task.id, task.officialUrl],
    );
    await client.query('commit');
    return Response.json(task, { status: 201 });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
