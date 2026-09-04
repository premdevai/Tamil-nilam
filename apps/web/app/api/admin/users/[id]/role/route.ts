import { auditRecords, users } from '@nilam/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';

const roleSchema = z
  .object({
    role: z.enum(['user', 'consultant', 'reviewer', 'admin']),
  })
  .strict();

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('roles:write');
  if (!authorization.ok) return authorization.response;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_role' }, { status: 400 });
  }
  const { id } = await context.params;
  if (id === authorization.session.user.id && parsed.data.role !== 'admin') {
    return Response.json(
      { error: 'cannot_demote_current_admin' },
      { status: 409 },
    );
  }
  const database = getDatabase().db;
  const [user] = await database
    .update(users)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id, role: users.role });
  if (user === undefined) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }
  await database.insert(auditRecords).values({
    actorId: authorization.session.user.id,
    action: 'user.role_updated',
    targetType: 'user',
    targetId: id,
    metadata: { role: parsed.data.role },
  });
  return Response.json(user);
}
