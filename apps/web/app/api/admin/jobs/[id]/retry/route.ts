import { auditRecords, operationJobs } from '@nilam/db';
import { and, eq, lt } from 'drizzle-orm';

import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('publish:write');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const database = getDatabase().db;
  const [job] = await database
    .update(operationJobs)
    .set({
      status: 'queued',
      nextAttemptAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(operationJobs.id, id),
        eq(operationJobs.status, 'failed'),
        lt(operationJobs.attemptCount, operationJobs.maxAttempts),
      ),
    )
    .returning();
  if (job === undefined) {
    return Response.json({ error: 'retryable_job_not_found' }, { status: 404 });
  }
  await database.insert(auditRecords).values({
    actorId: authorization.session.user.id,
    action: 'operation_job.retried',
    targetType: 'operation_job',
    targetId: id,
  });
  return Response.json(job);
}
