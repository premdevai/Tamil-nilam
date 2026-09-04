import {
  auditRecords,
  publicationOutbox,
  publicationVersions,
  stagedReviewQueue,
} from '@nilam/db';
import { and, eq, sql } from 'drizzle-orm';

import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';
import {
  canPublishReview,
  nextPublicationVersion,
  publicationSideEffects,
} from '../../../../../lib/publish';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('publish:write');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const database = getDatabase().db;
  const publication = await database.transaction(async (transaction) => {
    const [review] = await transaction
      .select()
      .from(stagedReviewQueue)
      .where(
        and(
          eq(stagedReviewQueue.id, id),
          eq(stagedReviewQueue.status, 'approved'),
        ),
      )
      .limit(1);
    if (review === undefined || !canPublishReview(review.status)) {
      return undefined;
    }
    const [existing] = await transaction
      .select({
        version: sql<number>`coalesce(max(${publicationVersions.version}), 0)::int`,
      })
      .from(publicationVersions)
      .where(
        and(
          eq(publicationVersions.entityType, review.entityType),
          eq(publicationVersions.entityKey, review.entityKey),
        ),
      );
    const [created] = await transaction
      .insert(publicationVersions)
      .values({
        reviewItemId: review.id,
        entityType: review.entityType,
        entityKey: review.entityKey,
        version: nextPublicationVersion(existing?.version),
        data: review.reviewedData ?? review.proposedData,
        verifier:
          authorization.session.user.email ?? authorization.session.user.id,
        citationUrl: review.sourceUrl,
        sourceHash: review.contentHash,
      })
      .returning();
    if (created === undefined) {
      throw new Error('Failed to create publication version');
    }
    await transaction.insert(publicationOutbox).values(
      publicationSideEffects(created.entityType, created.entityKey).map(
        (effect) => ({
          publicationId: created.id,
          kind: effect.kind,
          payload: effect.payload,
        }),
      ),
    );
    await transaction.insert(auditRecords).values({
      actorId: authorization.session.user.id,
      action: 'publication.published',
      targetType: 'publication_version',
      targetId: created.id,
      metadata: { version: created.version, reviewItemId: review.id },
    });
    return created;
  });
  if (publication === undefined) {
    return Response.json(
      { error: 'approved_review_not_found' },
      { status: 404 },
    );
  }
  return Response.json(publication, { status: 201 });
}
