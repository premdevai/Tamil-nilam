import { auditRecords, savedStacks } from '@nilam/db';
import { and, eq } from 'drizzle-orm';

import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const database = getDatabase().db;
  const deleted = await database
    .delete(savedStacks)
    .where(
      and(
        eq(savedStacks.id, id),
        eq(savedStacks.userId, authorization.session.user.id),
      ),
    )
    .returning({ id: savedStacks.id });
  if (deleted.length === 0) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  await database.insert(auditRecords).values({
    actorId: authorization.session.user.id,
    action: 'saved_stack.deleted',
    targetType: 'saved_stack',
    targetId: id,
  });
  return new Response(null, { status: 204 });
}
