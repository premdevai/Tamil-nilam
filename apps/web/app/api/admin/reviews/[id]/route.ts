import {
  auditRecords,
  stagedReviewActions,
  stagedReviewQueue,
} from '@nilam/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';

const reviewSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'needs_changes']),
    note: z.string().trim().min(1).max(2_000),
    reviewedData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('review:write');
  if (!authorization.ok) return authorization.response;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_review' }, { status: 400 });
  }
  const { id } = await context.params;
  const actor =
    authorization.session.user.email ?? authorization.session.user.id;
  const database = getDatabase().db;
  const reviewed = await database.transaction(async (transaction) => {
    const [item] = await transaction
      .update(stagedReviewQueue)
      .set({
        status: parsed.data.status,
        reviewer: actor,
        reviewNote: parsed.data.note,
        reviewedData: parsed.data.reviewedData,
        reviewedAt: new Date(),
      })
      .where(eq(stagedReviewQueue.id, id))
      .returning();
    if (item === undefined) return undefined;
    await transaction.insert(stagedReviewActions).values({
      reviewItemId: id,
      action: parsed.data.status,
      actor,
      note: parsed.data.note,
      reviewedData: parsed.data.reviewedData,
    });
    await transaction.insert(auditRecords).values({
      actorId: authorization.session.user.id,
      action: `review.${parsed.data.status}`,
      targetType: 'staging_review_item',
      targetId: id,
    });
    return item;
  });
  if (reviewed === undefined) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json(reviewed);
}
