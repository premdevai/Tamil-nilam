import { auditRecords, telegramLinkTokens } from '@nilam/db';
import { and, eq, isNull } from 'drizzle-orm';

import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
  telegramDeepLink,
} from '../../../../lib/telegram-link';

export async function POST() {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;

  const userId = authorization.session.user.id;
  const database = getDatabase().db;
  const now = new Date();
  await database
    .update(telegramLinkTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(telegramLinkTokens.userId, userId),
        isNull(telegramLinkTokens.usedAt),
      ),
    );

  const token = createTelegramLinkToken();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
  await database.insert(telegramLinkTokens).values({
    userId,
    tokenHash: hashTelegramLinkToken(token),
    expiresAt,
  });
  await database.insert(auditRecords).values({
    actorId: userId,
    action: 'telegram.link_requested',
    targetType: 'user',
    targetId: userId,
  });

  return Response.json({
    url: telegramDeepLink(
      process.env.TELEGRAM_BOT_USERNAME ?? 'NilamLocalBot',
      token,
    ),
    expiresAt: expiresAt.toISOString(),
  });
}
