import {
  auditRecords,
  correctiveVersions,
  publicationVersions,
} from '@nilam/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';

const correctionSchema = z
  .object({
    publicationId: z.uuid(),
    reason: z.string().trim().min(10).max(2_000),
    proposedData: z.record(z.string(), z.unknown()),
  })
  .strict();

export async function POST(request: Request) {
  const authorization = await authorizeRequest('review:write');
  if (!authorization.ok) return authorization.response;
  const parsed = correctionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'invalid_correction' }, { status: 400 });
  }
  const database = getDatabase().db;
  const original = await database
    .select({ id: publicationVersions.id })
    .from(publicationVersions)
    .where(eq(publicationVersions.id, parsed.data.publicationId))
    .limit(1);
  if (original.length === 0) {
    return Response.json({ error: 'publication_not_found' }, { status: 404 });
  }
  const [correction] = await database
    .insert(correctiveVersions)
    .values({
      ...parsed.data,
      requestedBy: authorization.session.user.id,
    })
    .returning();
  if (correction === undefined) {
    throw new Error('Failed to create corrective version');
  }
  await database.insert(auditRecords).values({
    actorId: authorization.session.user.id,
    action: 'corrective_version.requested',
    targetType: 'corrective_version',
    targetId: correction.id,
    metadata: { publicationId: parsed.data.publicationId },
  });
  return Response.json(correction, { status: 201 });
}
