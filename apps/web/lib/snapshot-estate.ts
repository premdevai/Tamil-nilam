import { agencies, estates, sourceDocuments } from '@nilam/db';
import { eq } from 'drizzle-orm';

import { getDatabase } from './db';
import { getPublicLandEstate } from './tansidco-estates';

export async function ensureWatchedEstate(
  slug: string,
): Promise<{ id: string } | null> {
  const land = getPublicLandEstate(slug);
  if (land === undefined) return null;
  const database = getDatabase().db;
  const [existing] = await database
    .select({ id: estates.id })
    .from(estates)
    .where(eq(estates.slug, land.slug))
    .limit(1);
  if (existing !== undefined) return existing;

  const [agency] = await database
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.slug, land.agency))
    .limit(1);
  if (agency === undefined) return null;

  const [source] = await database
    .insert(sourceDocuments)
    .values({
      agencyId: agency.id,
      title: 'TANSIDCO vacancy snapshot',
      url: land.sourceUrl,
      contentHash: land.sourceSyncedAt,
      publishedOn: land.verifiedOn,
      retrievedAt: new Date(land.sourceSyncedAt),
      mimeType: 'application/json',
      metadata: { kind: 'tansidco-vacancy-snapshot' },
    })
    .onConflictDoNothing()
    .returning({ id: sourceDocuments.id });
  const sourceId =
    source?.id ??
    (
      await database
        .select({ id: sourceDocuments.id })
        .from(sourceDocuments)
        .where(eq(sourceDocuments.url, land.sourceUrl))
        .limit(1)
    )[0]?.id;
  if (sourceId === undefined) return null;

  const [created] = await database
    .insert(estates)
    .values({
      agencyId: agency.id,
      sourceDocumentId: sourceId,
      slug: land.slug,
      name: land.name,
      nameTa: land.nameTa,
      district: land.district,
      block: land.block,
      backwardBlock: land.backward,
      sourceUrl: land.sourceUrl,
      verifiedOn: land.verifiedOn,
    })
    .onConflictDoNothing()
    .returning({ id: estates.id });
  if (created !== undefined) return created;
  const [again] = await database
    .select({ id: estates.id })
    .from(estates)
    .where(eq(estates.slug, land.slug))
    .limit(1);
  return again ?? null;
}
