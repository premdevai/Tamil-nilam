import { readFileSync } from 'node:fs';

import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  auditRecords,
  estates,
  notificationDeliveries,
  operationJobs,
  payments,
  publicationVersions,
  rawSourceSnapshots,
  ruleVersions,
  stagedReviewActions,
  stagedReviewQueue,
} from './schema/index.js';

describe('citation and verification foundations', () => {
  it('requires citations and verification dates for rule benefits', () => {
    const columns = getTableColumns(ruleVersions);

    expect(columns.goReferenceId.notNull).toBe(true);
    expect(columns.verifiedOn.notNull).toBe(true);
  });

  it('requires a source and verification date for estate rate data', () => {
    const columns = getTableColumns(estates);

    expect(columns.sourceDocumentId.notNull).toBe(true);
    expect(columns.verifiedOn.notNull).toBe(true);
  });

  it('stores payment amounts as positive integer paise', () => {
    const columns = getTableColumns(payments);

    expect(columns.amountPaise.notNull).toBe(true);
    expect(columns.amountPaise.dataType).toBe('number');
  });

  it('retains immutable raw source bytes and their content hash', () => {
    const columns = getTableColumns(rawSourceSnapshots);

    expect(columns.rawBody.notNull).toBe(true);
    expect(columns.contentHash.notNull).toBe(true);
    expect(columns.mimeType.notNull).toBe(true);
  });

  it('requires a human review record and citation for every publication', () => {
    const reviewColumns = getTableColumns(stagedReviewQueue);
    const actionColumns = getTableColumns(stagedReviewActions);
    const publicationColumns = getTableColumns(publicationVersions);

    expect(reviewColumns.contentHash.notNull).toBe(true);
    expect(actionColumns.actor.notNull).toBe(true);
    expect(actionColumns.note.notNull).toBe(true);
    expect(publicationColumns.reviewItemId.notNull).toBe(true);
    expect(publicationColumns.verifier.notNull).toBe(true);
    expect(publicationColumns.citationUrl.notNull).toBe(true);
  });

  it('guards publishing and denies scraper production access in SQL', () => {
    const migration = readFileSync(
      new URL('../drizzle/0001_cuddly_sleeper.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toContain(
      'only an approved review item can be published',
    );
    expect(migration).toContain('publication_versions are append-only');
    expect(migration).toContain(
      'REVOKE ALL ON SCHEMA public FROM nilam_scraper',
    );
    expect(migration).not.toContain(
      'GRANT INSERT ON publication_versions TO nilam_scraper',
    );

    const auditMigration = readFileSync(
      new URL('../drizzle/0002_foamy_gunslinger.sql', import.meta.url),
      'utf8',
    );
    expect(auditMigration).toContain('review_actions are append-only');
  });

  it('persists idempotent delivery and append-only account audit controls', () => {
    const deliveryColumns = getTableColumns(notificationDeliveries);
    const jobColumns = getTableColumns(operationJobs);
    const auditColumns = getTableColumns(auditRecords);

    expect(deliveryColumns.idempotencyKey.notNull).toBe(true);
    expect(jobColumns.idempotencyKey.notNull).toBe(true);
    expect(auditColumns.action.notNull).toBe(true);

    const accountMigration = readFileSync(
      new URL('../drizzle/0004_square_logan.sql', import.meta.url),
      'utf8',
    );
    expect(accountMigration).toContain(
      'notification_deliveries_idempotency_idx',
    );
    expect(accountMigration).toContain('audit_records_append_only');
    expect(accountMigration).toContain('consent_records_append_only');
  });

  it('records paid product receipts, entitlements and frozen DPR hashes', () => {
    const paidMigration = readFileSync(
      new URL('../drizzle/0006_paid_product.sql', import.meta.url),
      'utf8',
    );
    expect(paidMigration).toContain('payment_webhook_events');
    expect(paidMigration).toContain('payment_receipts');
    expect(paidMigration).toContain('entitlements');
    expect(paidMigration).toContain('client_workspaces');
    expect(paidMigration).toContain('usage_ledger');
    expect(paidMigration).toContain('input_hash');

    const reportMigration = readFileSync(
      new URL('../drizzle/0007_printable_reports.sql', import.meta.url),
      'utf8',
    );
    expect(reportMigration).toContain('printable_reports');
    expect(reportMigration).toContain('generated_dprs_idempotency_idx');
  });
});
