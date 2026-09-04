import {
  accountDataRequests,
  auditRecords,
  consentRecords,
  notificationDeliveries,
  notificationPreferences,
  savedStacks,
  userPlaybookProgress,
  users,
  watchedEstates,
} from '@nilam/db';
import { eq } from 'drizzle-orm';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';

export async function POST() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const database = getDatabase().db;
  const [
    [user],
    consents,
    stacks,
    estates,
    progress,
    [preferences],
    deliveries,
  ] = await Promise.all([
    database.select().from(users).where(eq(users.id, userId)).limit(1),
    database
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, userId)),
    database.select().from(savedStacks).where(eq(savedStacks.userId, userId)),
    database
      .select()
      .from(watchedEstates)
      .where(eq(watchedEstates.userId, userId)),
    database
      .select()
      .from(userPlaybookProgress)
      .where(eq(userPlaybookProgress.userId, userId)),
    database
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1),
    database
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.userId, userId)),
  ]);
  const generatedAt = new Date();
  const [dataRequest] = await database
    .insert(accountDataRequests)
    .values({
      userId,
      kind: 'export',
      status: 'completed',
      completedAt: generatedAt,
    })
    .returning({ id: accountDataRequests.id });
  if (dataRequest === undefined) {
    throw new Error('Failed to record account export');
  }
  await database.insert(auditRecords).values({
    actorId: userId,
    action: 'account.exported',
    targetType: 'account_data_request',
    targetId: dataRequest.id,
  });

  const body = JSON.stringify(
    {
      format: 'nilam-account-export-v1',
      generatedAt: generatedAt.toISOString(),
      account: user,
      consents,
      savedStacks: stacks,
      watchedEstates: estates,
      playbookProgress: progress,
      notificationPreferences: preferences ?? null,
      notificationHistory: deliveries,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="nilam-account-${generatedAt.toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  });
}
