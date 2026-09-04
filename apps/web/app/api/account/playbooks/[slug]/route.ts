import { playbooks, userPlaybookProgress } from '@nilam/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';

const progressSchema = z
  .object({
    completed: z.array(z.number().int().min(0).max(200)).max(201),
  })
  .strict();

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const { slug } = await context.params;
  const database = getDatabase().db;
  const [record] = await database
    .select({ completed: userPlaybookProgress.completedStepKeys })
    .from(userPlaybookProgress)
    .innerJoin(playbooks, eq(playbooks.id, userPlaybookProgress.playbookId))
    .where(
      and(
        eq(userPlaybookProgress.userId, authorization.session.user.id),
        eq(playbooks.slug, slug),
      ),
    )
    .limit(1);
  return Response.json({
    completed:
      record?.completed.map((value) => Number.parseInt(value, 10)) ?? [],
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = progressSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'invalid_progress' }, { status: 400 });
  }
  const { slug } = await context.params;
  const database = getDatabase().db;
  const [playbook] = await database
    .select({ id: playbooks.id })
    .from(playbooks)
    .where(eq(playbooks.slug, slug))
    .limit(1);
  if (playbook === undefined) {
    return Response.json({ error: 'playbook_not_found' }, { status: 404 });
  }

  const userId = authorization.session.user.id;
  const [existing] = await database
    .select({ completed: userPlaybookProgress.completedStepKeys })
    .from(userPlaybookProgress)
    .where(
      and(
        eq(userPlaybookProgress.userId, userId),
        eq(userPlaybookProgress.playbookId, playbook.id),
      ),
    )
    .limit(1);
  const completed = [
    ...new Set([
      ...(existing?.completed ?? []),
      ...parsed.data.completed.map(String),
    ]),
  ].sort((left, right) => Number(left) - Number(right));
  await database
    .insert(userPlaybookProgress)
    .values({ userId, playbookId: playbook.id, completedStepKeys: completed })
    .onConflictDoUpdate({
      target: [userPlaybookProgress.userId, userPlaybookProgress.playbookId],
      set: { completedStepKeys: completed, updatedAt: new Date() },
    });
  return Response.json({ completed: completed.map(Number) });
}
