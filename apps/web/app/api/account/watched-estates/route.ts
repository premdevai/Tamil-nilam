import { auditRecords, estates, watchedEstates } from '@nilam/db';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import { ensureWatchedEstate } from '../../../../lib/snapshot-estate';

const watchSchema = z
  .object({
    estateId: z.uuid().optional(),
    estateSlug: z.string().min(1).max(160).optional(),
    vacancyAlerts: z.boolean().default(true),
  })
  .strict()
  .refine(
    ({ estateId, estateSlug }) =>
      (estateId === undefined) !== (estateSlug === undefined),
    'Provide exactly one estate identifier',
  );

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const records = await getDatabase()
    .db.select({
      estateId: watchedEstates.estateId,
      estateName: estates.name,
      estateSlug: estates.slug,
      vacancyAlerts: watchedEstates.vacancyAlerts,
      createdAt: watchedEstates.createdAt,
    })
    .from(watchedEstates)
    .innerJoin(estates, eq(estates.id, watchedEstates.estateId))
    .where(eq(watchedEstates.userId, authorization.session.user.id))
    .orderBy(desc(watchedEstates.createdAt));
  return Response.json({ watchedEstates: records });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = watchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_estate_watch' }, { status: 400 });
  }

  const database = getDatabase().db;
  const userId = authorization.session.user.id;
  const estate =
    parsed.data.estateId === undefined
      ? await ensureWatchedEstate(parsed.data.estateSlug ?? '')
      : (
          await database
            .select({ id: estates.id })
            .from(estates)
            .where(eq(estates.id, parsed.data.estateId))
            .limit(1)
        )[0];
  if (estate === undefined || estate === null) {
    return Response.json({ error: 'estate_not_found' }, { status: 404 });
  }
  const [record] = await database
    .insert(watchedEstates)
    .values({
      userId,
      estateId: estate.id,
      vacancyAlerts: parsed.data.vacancyAlerts,
    })
    .onConflictDoUpdate({
      target: [watchedEstates.userId, watchedEstates.estateId],
      set: { vacancyAlerts: parsed.data.vacancyAlerts },
    })
    .returning();
  await database.insert(auditRecords).values({
    actorId: userId,
    action: 'estate.watched',
    targetType: 'estate',
    targetId: estate.id,
  });
  return Response.json(record, { status: 201 });
}
