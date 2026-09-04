import {
  DOCUMENT_DOWNLOAD_TTL_SECONDS,
  buildPrintableReportModel,
  dprSnapshotSchema,
  hashSnapshot,
  rulesetSnapshotSchema,
} from '@nilam/paid';
import {
  persistGeneratedDocuments,
  buildDprDocumentModel,
} from '@nilam/paid/documents';
import type { JobHelpers } from 'graphile-worker';
import { z } from 'zod';

const dprPayloadSchema = z.object({ dprId: z.uuid() }).strict();
const reportPayloadSchema = z.object({ reportId: z.uuid() }).strict();

export async function generateDprDocument(
  payload: unknown,
  helpers: JobHelpers,
): Promise<void> {
  const { dprId } = dprPayloadSchema.parse(payload);
  const claimed = await helpers.query<{
    id: string;
    documentVersion: number;
    inputSnapshot: unknown;
    rulesetSnapshot: unknown;
    inputHash: string;
    rulesetHash: string;
    generationAttempts: number;
  }>(
    `update generated_dprs
     set status = 'generating',
       generation_attempts = generation_attempts + 1,
       error = null, updated_at = now()
     where id = $1::uuid and status in ('queued', 'failed')
     returning id::text, document_version as "documentVersion",
       input_snapshot as "inputSnapshot", ruleset_snapshot as "rulesetSnapshot",
       input_hash as "inputHash", ruleset_hash as "rulesetHash",
       generation_attempts as "generationAttempts"`,
    [dprId],
  );
  const dpr = claimed.rows[0];
  if (dpr === undefined) return;
  const snapshot = dprSnapshotSchema.parse(dpr.inputSnapshot);
  const ruleset = rulesetSnapshotSchema.parse(dpr.rulesetSnapshot);
  assertSnapshotHash(snapshot, dpr.inputHash);
  const { hash: rulesetHash, ...rulesetCore } = ruleset;
  assertSnapshotHash(rulesetCore, rulesetHash);
  assertSnapshotHash(rulesetCore, dpr.rulesetHash);
  const generatedAt = new Date().toISOString();
  const model = buildDprDocumentModel(
    snapshot,
    ruleset,
    dpr.documentVersion,
    generatedAt,
  );
  const stored = await persistGeneratedDocuments({
    documentId: dpr.id,
    version: dpr.documentVersion,
    model,
  });
  const expiresAt = new Date(
    Date.now() + DOCUMENT_DOWNLOAD_TTL_SECONDS * 1_000,
  );
  await helpers.query(
    `update generated_dprs
     set status = 'ready', docx_storage_key = $2, pdf_storage_key = $3,
       expires_at = $4, error = null, updated_at = now()
     where id = $1::uuid`,
    [dpr.id, stored.docxStorageKey, stored.pdfStorageKey, expiresAt],
  );
}

export async function generatePrintableReport(
  payload: unknown,
  helpers: JobHelpers,
): Promise<void> {
  const { reportId } = reportPayloadSchema.parse(payload);
  const claimed = await helpers.query<{
    id: string;
    documentVersion: number;
    inputSnapshot: unknown;
    rulesetSnapshot: unknown;
  }>(
    `update printable_reports
     set status = 'generating',
       generation_attempts = generation_attempts + 1,
       error = null, updated_at = now()
     where id = $1::uuid and status in ('queued', 'failed')
     returning id::text, document_version as "documentVersion",
       input_snapshot as "inputSnapshot", ruleset_snapshot as "rulesetSnapshot"`,
    [reportId],
  );
  const report = claimed.rows[0];
  if (report === undefined) return;
  const source = printableSourceSchema.parse(report.inputSnapshot);
  const ruleset = rulesetSnapshotSchema.parse(report.rulesetSnapshot);
  const model = buildPrintableReportModel({
    ...source,
    documentVersion: report.documentVersion,
    rulesetHash: ruleset.hash,
  });
  const stored = await persistGeneratedDocuments({
    documentId: report.id,
    version: report.documentVersion,
    model,
  });
  const expiresAt = new Date(
    Date.now() + DOCUMENT_DOWNLOAD_TTL_SECONDS * 1_000,
  );
  await helpers.query(
    `update printable_reports
     set status = 'ready', docx_storage_key = $2, pdf_storage_key = $3,
       expires_at = $4, error = null, updated_at = now()
     where id = $1::uuid`,
    [report.id, stored.docxStorageKey, stored.pdfStorageKey, expiresAt],
  );
}

export function assertSnapshotHash(value: unknown, expected: string): void {
  if (hashSnapshot(value) !== expected) {
    throw new Error('Stored snapshot hash does not match the frozen payload.');
  }
}

const printableSourceSchema = z
  .object({
    title: z.string().min(2).max(160),
    generatedAt: z.iso.datetime(),
    asOf: z.iso.date(),
    rulesetVersion: z.string().min(1),
    district: z.string().min(1),
    sector: z.string().min(1),
    totalLakhs: z.number(),
    eligible: z.array(
      z.object({
        schemeId: z.string(),
        name: z.string(),
        totalLakhs: z.number(),
      }),
    ),
    warnings: z.array(z.string()),
    citations: z.array(
      z.object({
        title: z.string(),
        url: z.url(),
        verifiedOn: z.iso.date(),
      }),
    ),
  })
  .strict();
