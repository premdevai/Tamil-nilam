import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('database access rules', () => {
  const publication = readFileSync(
    new URL('../drizzle/0001_cuddly_sleeper.sql', import.meta.url),
    'utf8',
  );
  const paid = readFileSync(
    new URL('../drizzle/0006_paid_product.sql', import.meta.url),
    'utf8',
  );
  const reports = readFileSync(
    new URL('../drizzle/0007_printable_reports.sql', import.meta.url),
    'utf8',
  );

  it('keeps scrapers out of publication and paid tables', () => {
    expect(publication).toContain(
      'REVOKE ALL ON SCHEMA public FROM nilam_scraper',
    );
    expect(publication).not.toContain(
      'GRANT INSERT ON publication_versions TO nilam_scraper',
    );
    expect(paid).not.toContain('GRANT ALL ON payments TO nilam_scraper');
    expect(reports).not.toContain(
      'GRANT ALL ON printable_reports TO nilam_scraper',
    );
  });

  it('makes printable reports owner-scoped and idempotent', () => {
    expect(reports).toContain('printable_reports_user_id_users_id_fk');
    expect(reports).toContain('printable_reports_idempotency_idx');
    expect(reports).toContain('generated_dprs_idempotency_idx');
  });
});
