import { accountDataRequests, auditRecords, operationJobs } from '@nilam/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';

const deletionSchema = z.object({ confirmation: z.literal('DELETE') }).strict();

export async function POST(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const parsed = deletionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'confirmation_required' }, { status: 400 });
  }

  const userId = authorization.session.user.id;
  const database = getDatabase().db;
  const [existing] = await database
    .select()
    .from(accountDataRequests)
    .where(
      and(
        eq(accountDataRequests.userId, userId),
        eq(accountDataRequests.kind, 'deletion'),
        inArray(accountDataRequests.status, ['queued', 'processing']),
      ),
    )
    .orderBy(desc(accountDataRequests.createdAt))
    .limit(1);
  if (existing !== undefined) return Response.json(existing, { status: 202 });

  const result = await database.transaction(async (transaction) => {
    const [dataRequest] = await transaction
      .insert(accountDataRequests)
      .values({ userId, kind: 'deletion' })
      .returning();
    if (dataRequest === undefined) {
      throw new Error('Failed to create deletion request');
    }
    await transaction.insert(operationJobs).values({
      task: 'delete_account',
      idempotencyKey: `delete-account:${userId}`,
      payload: { userId, dataRequestId: dataRequest.id },
    });
    await transaction.insert(auditRecords).values({
      actorId: userId,
      action: 'account.deletion_requested',
      targetType: 'account_data_request',
      targetId: dataRequest.id,
    });
    return dataRequest;
  });
  return Response.json(result, { status: 202 });
}
