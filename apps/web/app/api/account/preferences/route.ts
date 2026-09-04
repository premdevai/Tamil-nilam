import { auditRecords, notificationPreferences, users } from '@nilam/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';

const preferenceSchema = z
  .object({
    emailEnabled: z.boolean(),
    telegramEnabled: z.boolean(),
    deadlineReminders: z.boolean(),
    goChangeAlerts: z.boolean(),
    vacancyAlerts: z.boolean(),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;

  const [preferences] = await getDatabase()
    .db.select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, authorization.session.user.id))
    .limit(1);
  return Response.json(
    preferences ?? {
      emailEnabled: true,
      telegramEnabled: false,
      deadlineReminders: true,
      goChangeAlerts: true,
      vacancyAlerts: true,
    },
  );
}

export async function PUT(request: Request) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const parsed = preferenceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'invalid_preferences' }, { status: 400 });
  }

  const database = getDatabase().db;
  const userId = authorization.session.user.id;
  if (parsed.data.telegramEnabled) {
    const [user] = await database
      .select({ telegramChatId: users.telegramChatId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user?.telegramChatId === null) {
      return Response.json(
        { error: 'link_telegram_before_enabling' },
        { status: 409 },
      );
    }
  }

  const [preferences] = await database
    .insert(notificationPreferences)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  await database.insert(auditRecords).values({
    actorId: userId,
    action: 'notifications.preferences_updated',
    targetType: 'user',
    targetId: userId,
    metadata: parsed.data,
  });
  return Response.json(preferences);
}
