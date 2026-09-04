import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  createDownloadSignature,
  createInputSnapshot,
  createRulesetSnapshot,
  dprFinancialInputSchema,
  parseBulkStackCsv,
  quotaRemaining,
  subscriptionHasAccess,
  usagePeriodKey,
  verifyDownloadSignature,
} from './index';
import {
  buildDprDocumentModel,
  persistGeneratedDocuments,
  removeStoredDocuments,
  renderDeterministicDocx,
  renderDeterministicPdf,
} from './documents';
import { buildPrintableReportModel } from './reports';

const input = dprFinancialInputSchema.parse({
  businessName: 'Kaveri Foods',
  promoterName: 'A. Selvi',
  sector: 'Food processing',
  district: 'Thanjavur',
  projectCost: 1_000_000,
  landAndBuildingCost: 200_000,
  plantAndMachineryCost: 500_000,
  otherFixedCost: 100_000,
  workingCapital: 200_000,
  promoterContribution: 250_000,
  termLoan: 750_000,
  otherFunding: 0,
  projectedAnnualRevenue: 1_500_000,
  projectedAnnualOperatingCost: 1_100_000,
  employment: 12,
  implementationMonths: 8,
  assumptions: ['Sales volume reaches 70% capacity in year one.'],
  citations: [
    {
      title: 'Verified scheme source',
      url: 'https://example.gov.in/scheme',
      verifiedOn: '2026-08-20',
      schemeSlug: 'example-scheme',
    },
  ],
});

const generatedAt = '2026-08-21T00:00:00.000Z';
const model = buildDprDocumentModel(
  createInputSnapshot(input, generatedAt),
  {
    rulesetVersion: 'tn-2026.08',
    capturedAt: generatedAt,
    rules: [
      {
        schemeSlug: 'example-scheme',
        version: 2,
        verifiedOn: '2026-08-20',
        sourceUrl: 'https://example.gov.in/scheme',
      },
    ],
    hash: 'a'.repeat(64),
  },
  1,
  generatedAt,
);

describe('paid product rules', () => {
  it('rejects unbalanced project costs and funding', () => {
    expect(() =>
      dprFinancialInputSchema.parse({ ...input, termLoan: 700_000 }),
    ).toThrow(/Funding sources/);
  });

  it('honours only active or in-grace subscriptions', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    expect(
      subscriptionHasAccess(
        'cancelled',
        new Date('2026-08-20T00:00:00.000Z'),
        new Date('2026-08-22T00:00:00.000Z'),
        now,
      ),
    ).toBe(true);
    expect(subscriptionHasAccess('expired', null, null, now)).toBe(false);
  });

  it('parses quoted bulk rows and enforces limits', () => {
    expect(
      parseBulkStackCsv(
        'businessName,sector,district,projectCost\n"Kaveri, Foods",food,Thanjavur,1000000',
        1,
      ),
    ).toEqual([
      {
        businessName: 'Kaveri, Foods',
        sector: 'food',
        district: 'Thanjavur',
        projectCost: '1000000',
      },
    ]);
  });
});

describe('deterministic documents', () => {
  it('creates a stable DOCX containing citations and disclaimers', () => {
    const first = renderDeterministicDocx(model);
    const second = renderDeterministicDocx(model);
    expect(first).toEqual(second);
    const documentXml = strFromU8(
      unzipSync(first)['word/document.xml'] ?? new Uint8Array(),
    );
    expect(documentXml).toContain('https://example.gov.in/scheme');
    expect(documentXml).toContain('does not claim government');
  });

  it('creates a stable PDF with a real PDF signature', async () => {
    const first = await renderDeterministicPdf(model);
    const second = await renderDeterministicPdf(model);
    expect(first).toEqual(second);
    expect(strFromU8(first.slice(0, 8))).toContain('%PDF-');
  });

  it('writes frozen documents under a storage root', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'nilam-docs-'));
    try {
      const stored = await persistGeneratedDocuments({
        documentId: '11111111-1111-4111-8111-111111111111',
        version: 1,
        model,
        storageDir: directory,
      });
      const pdf = await readFile(path.join(directory, stored.pdfStorageKey));
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      await expect(
        removeStoredDocuments(
          [stored.pdfStorageKey, stored.docxStorageKey],
          directory,
        ),
      ).resolves.toEqual([stored.pdfStorageKey, stored.docxStorageKey]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('downloads, quotas and printable reports', () => {
  it('rejects expired or tampered download signatures', () => {
    const secret = 'a'.repeat(32);
    const claims = {
      userId: 'user-1',
      documentId: 'doc-1',
      format: 'pdf' as const,
      expiresAt: Math.floor(
        new Date('2026-08-22T00:00:00.000Z').getTime() / 1000,
      ),
    };
    const signature = createDownloadSignature(claims, secret);
    expect(
      verifyDownloadSignature(
        claims,
        signature,
        secret,
        new Date('2026-08-21T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      verifyDownloadSignature(
        claims,
        signature,
        secret,
        new Date('2026-08-22T00:00:01.000Z'),
      ),
    ).toBe(false);
    expect(
      verifyDownloadSignature(
        claims,
        'ab',
        secret,
        new Date('2026-08-21T00:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('keeps quota remaining non-negative and uses UTC period keys', () => {
    expect(quotaRemaining(600, 500)).toBe(0);
    expect(usagePeriodKey(new Date('2026-08-21T00:00:00.000Z'))).toBe(
      '2026-08',
    );
  });

  it('freezes ruleset hashes and printable disclaimers', () => {
    const ruleset = createRulesetSnapshot(
      [
        {
          schemeSlug: 'example-scheme',
          version: 2,
          verifiedOn: '2026-08-20',
          sourceUrl: 'https://example.gov.in/scheme',
        },
      ],
      generatedAt,
    );
    expect(ruleset.hash).toHaveLength(64);
    const report = buildPrintableReportModel({
      title: 'Pro report',
      generatedAt,
      documentVersion: 1,
      asOf: '2026-08-21',
      rulesetVersion: '2026.08',
      rulesetHash: ruleset.hash,
      district: 'Thanjavur',
      sector: 'food-processing',
      totalLakhs: 12,
      eligible: [
        { schemeId: 'example-scheme', name: 'Example', totalLakhs: 12 },
      ],
      warnings: [],
      citations: [
        {
          title: 'Verified scheme source',
          url: 'https://example.gov.in/scheme',
          verifiedOn: '2026-08-20',
        },
      ],
    });
    const xml = strFromU8(
      unzipSync(renderDeterministicDocx(report))['word/document.xml'] ??
        new Uint8Array(),
    );
    expect(xml).toContain('does not claim government');
    expect(xml).toContain(ruleset.hash);
  });
});
