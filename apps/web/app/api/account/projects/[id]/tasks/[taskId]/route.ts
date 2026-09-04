import { authorizeRequest } from '../../../../../../../lib/authz';
import { getDatabase } from '../../../../../../../lib/db';
import {
  completeProjectTask,
  parseProjectCompanion,
  taskUpdateSchema,
} from '../../../../../../../lib/project-companion';
import { recordProjectMilestone } from '../../../../../../../lib/project-memory';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = taskUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_task_update', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id, taskId } = await context.params;
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
    const task = companion.tasks.find((item) => item.id === taskId);
    if (task === undefined) {
      await client.query('rollback');
      return Response.json({ error: 'task_not_found' }, { status: 404 });
    }
    let updatedTask;
    try {
      updatedTask = completeProjectTask(task, parsed.data);
    } catch {
      await client.query('rollback');
      return Response.json(
        { error: 'completion_proof_required' },
        { status: 400 },
      );
    }
    const tasks = companion.tasks.map((item) =>
      item.id === taskId ? updatedTask : item,
    );
    await client.query(
      `update saved_stacks
       set result_snapshot = jsonb_set(
         result_snapshot,
         '{project,tasks}',
         $3::jsonb,
         true
       ), updated_at = now()
       where id = $1::uuid and user_id = $2::uuid`,
      [id, userId, JSON.stringify(tasks)],
    );
    const firstCompletion =
      task.completedAt === null &&
      updatedTask.completedAt !== null &&
      !companion.tasks.some(
        (item) => item.id !== taskId && item.completedAt !== null,
      );
    if (firstCompletion) {
      await recordProjectMilestone(client.query.bind(client), {
        userId,
        projectId: id,
        kind: 'first_next_action_completed',
        metadata: { taskId, proofUrl: updatedTask.proofUrl },
      });
    }
    await client.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'project.task_updated', 'saved_stack', $2,
         jsonb_build_object('taskId', $3::text, 'completed', $4::boolean))`,
      [userId, id, taskId, updatedTask.completedAt !== null],
    );
    await client.query('commit');
    return Response.json(updatedTask);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
