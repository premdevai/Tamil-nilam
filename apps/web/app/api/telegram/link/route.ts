import { auditRecords, telegramLinkTokens, users } from '@nilam/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { getDatabase } from '../../../../lib/db';
import {
  hashTelegramLinkToken,
  parseTelegramStartPayload,
  validBotSecret,
} from '../../../../lib/telegram-link';

const requestSchema = z.object({
  chatId: z.string().regex(/^-?\d{1,20}$/),
  startPayload: z.string().max(128),
});

export async function POST(request: Request) {
  const expectedSecret =
    process.env.TELEGRAM_LINK_SECRET ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'nilam-local-telegram-secret');
  if (
    !validBotSecret(request.headers.get('x-nilam-bot-secret'), expectedSecret)
  ) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const token = parseTelegramStartPayload(parsed.data.startPayload);
  if (token === undefined) {
    return Response.json({ error: 'invalid_or_expired_link' }, { status: 400 });
  }

  const database = getDatabase().db;
  const now = new Date();
  try {
    const linkedUserId = await database.transaction(async (transaction) => {
      const [link] = await transaction
        .select()
        .from(telegramLinkTokens)
        .where(
          and(
            eq(telegramLinkTokens.tokenHash, hashTelegramLinkToken(token)),
            isNull(telegramLinkTokens.usedAt),
            gt(telegramLinkTokens.expiresAt, now),
          ),
        )
        .limit(1);
      if (link === undefined) return undefined;

      const consumed = await transaction
        .update(telegramLinkTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(telegramLinkTokens.id, link.id),
            isNull(telegramLinkTokens.usedAt),
          ),
        )
        .returning({ userId: telegramLinkTokens.userId });
      if (consumed.length !== 1) return undefined;

      await transaction
        .update(users)
        .set({ telegramChatId: parsed.data.chatId, updatedAt: now })
        .where(eq(users.id, link.userId));
      await transaction.insert(auditRecords).values({
        actorId: link.userId,
        action: 'telegram.linked',
        targetType: 'user',
        targetId: link.userId,
      });
      return link.userId;
    });

    if (linkedUserId === undefined) {
      return Response.json(
        { error: 'invalid_or_expired_link' },
        { status: 400 },
      );
    }
    return Response.json({ linked: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('users_telegram_chat_idx')
    ) {
      return Response.json(
        { error: 'telegram_account_already_linked' },
        { status: 409 },
      );
    }
    throw error;
  }
}
