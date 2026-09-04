import {
  auditRecords,
  correctiveVersions,
  publicationOutbox,
  publicationVersions,
} from '@nilam/db';
import { and, eq, sql } from 'drizzle-orm';

import { authorizeRequest } from '../../../../../../lib/authz';
import { getDatabase } from '../../../../../../lib/db';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('publish:write');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const database = getDatabase().db;
  const publication = await database.transaction(async (transaction) => {
    const [correction] = await transaction
      .select({
        correction: correctiveVersions,
        original: publicationVersions,
      })
      .from(correctiveVersions)
      .innerJoin(
        publicationVersions,
        eq(publicationVersions.id, correctiveVersions.publicationId),
      )
      .where(
        and(
          eq(correctiveVersions.id, id),
          eq(correctiveVersions.status, 'pending'),
        ),
      )
      .limit(1);
    if (correction === undefined) return undefined;

    const [latest] = await transaction
      .select({
        version: sql<number>`coalesce(max(${publicationVersions.version}), 0)::int`,
      })
      .from(publicationVersions)
      .where(
        and(
          eq(publicationVersions.entityType, correction.original.entityType),
          eq(publicationVersions.entityKey, correction.original.entityKey),
        ),
      );
    const [created] = await transaction
      .insert(publicationVersions)
      .values({
        reviewItemId: correction.original.reviewItemId,
        entityType: correction.original.entityType,
        entityKey: correction.original.entityKey,
        version: (latest?.version ?? 0) + 1,
        data: correction.correction.proposedData,
        verifier:
          authorization.session.user.email ?? authorization.session.user.id,
        citationUrl: correction.original.citationUrl,
        sourceHash: correction.original.sourceHash,
      })
      .returning();
    if (created === undefined) {
      throw new Error('Failed to publish corrective version');
    }
    await transaction
      .update(correctiveVersions)
      .set({
        status: 'approved',
        reviewedBy: authorization.session.user.id,
        reviewedAt: new Date(),
        replacementPublicationId: created.id,
        updatedAt: new Date(),
      })
      .where(eq(correctiveVersions.id, id));
    await transaction.insert(publicationOutbox).values([
      {
        publicationId: created.id,
        kind: 'search-index',
        payload: { correctionId: id },
      },
      {
        publicationId: created.id,
        kind: 'revalidate',
        payload: { correctionId: id },
      },
      {
        publicationId: created.id,
        kind: 'calculate-impact',
        payload: { correctionId: id },
      },
    ]);
    await transaction.insert(auditRecords).values({
      actorId: authorization.session.user.id,
      action: 'corrective_version.published',
      targetType: 'publication_version',
      targetId: created.id,
      metadata: {
        correctionId: id,
        replacesPublicationId: correction.original.id,
      },
    });
    return created;
  });
  if (publication === undefined) {
    return Response.json(
      { error: 'pending_correction_not_found' },
      { status: 404 },
    );
  }
  return Response.json(publication, { status: 201 });
}
