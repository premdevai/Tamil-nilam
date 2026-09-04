import { randomBytes } from 'node:crypto';

import { authSessions, users } from '@nilam/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDatabase } from '../../../../lib/db';
import { validBotSecret } from '../../../../lib/telegram-link';

const schema = z
  .object({
    role: z.enum(['user', 'consultant', 'reviewer', 'admin']).default('user'),
    email: z.email().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const expected = process.env.E2E_AUTH_SECRET;
  if (expected === undefined || expected.length < 16) {
    return Response.json({ error: 'not_available' }, { status: 404 });
  }
  if (!validBotSecret(request.headers.get('x-e2e-secret'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_e2e_session' }, { status: 400 });
  }
  const email = parsed.data.email ?? `${parsed.data.role}@e2e.nilam.test`;
  const database = getDatabase().db;
  const now = new Date();
  const existing = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  let userId = existing[0]?.id;
  if (userId === undefined) {
    const [created] = await database
      .insert(users)
      .values({
        email,
        emailVerified: now,
        role: parsed.data.role,
        consentedAt: now,
      })
      .returning({ id: users.id });
    userId = created?.id;
  } else {
    await database
      .update(users)
      .set({
        role: parsed.data.role,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  }
  if (userId === undefined) {
    return Response.json({ error: 'e2e_user_failed' }, { status: 500 });
  }
  const sessionToken = randomBytes(32).toString('hex');
  await database.insert(authSessions).values({
    sessionToken,
    userId,
    expires: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });
  return Response.json(
    { ok: true, role: parsed.data.role, email },
    {
      headers: {
        'set-cookie': `next-auth.session-token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`,
      },
    },
  );
}
