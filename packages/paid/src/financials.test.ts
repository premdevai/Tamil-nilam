import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { buildDprDocumentModel, renderDeterministicDocx } from './documents';
import {
  buildDprFinancials,
  internalRateOfReturn,
  netPresentValue,
} from './financials';
import { createInputSnapshot, dprFinancialInputSchema } from './index';

const lakh = 100_000;

const needsUnit = dprFinancialInputSchema.parse({
  businessName: 'Kaveri Areca Plates',
  promoterName: 'A. Selvi',
  sector: 'Areca & paper plate unit',
  district: 'Kallakurichi',
  projectCost: 50 * lakh,
  landAndBuildingCost: 15 * lakh,
  plantAndMachineryCost: 22.5 * lakh,
  otherFixedCost: 2.5 * lakh,
  workingCapital: 10 * lakh,
  promoterContribution: 2.5 * lakh,
  termLoan: 47.5 * lakh,
  otherFunding: 0,
  projectedAnnualRevenue: 80 * lakh,
  projectedAnnualOperatingCost: 64 * lakh,
  employment: 8,
  implementationMonths: 9,
  capitalSubsidy: 10 * lakh,
  subsidySchemeName: 'NEEDS',
  interestSubventionPct: 3,
  loanInterestRatePct: 10.5,
  loanTenureYears: 7,
  moratoriumMonths: 12,
  citations: [
    {
      title: 'About NEEDS',
      url: 'https://msmeonline.tn.gov.in/needs/needs_desc.php',
      verifiedOn: '2026-11-21',
    },
  ],
});

describe('DPR financial projections', () => {
  const result = buildDprFinancials(needsUnit);

  it('balances the projected balance sheet every year', () => {
    for (const year of result.years) {
      expect(year.totalAssets).toBeCloseTo(year.totalLiabilities, 4);
    }
  });

  it('repays the whole loan, net of subsidy, within the tenure', () => {
    const principal = result.years.reduce(
      (sum, year) => sum + year.principal + year.subsidyCredited,
      0,
    );
    expect(principal).toBeCloseTo(needsUnit.termLoan, 2);
    expect(result.years[6]?.loanClosing).toBeCloseTo(0, 2);
    expect(result.years[0]?.subsidyCredited).toBeCloseTo(10 * lakh, 2);
  });

  it('applies the moratorium and the interest subvention', () => {
    const first = result.years[0];
    expect(first?.principal).toBe(0);
    expect(first?.dscr).toBeNull();
    expect(first?.subvention).toBeCloseTo(
      (first?.grossInterest ?? 0) * (3 / 10.5),
      4,
    );
  });

  it('reports cover, returns and break-even', () => {
    expect(result.averageDscr).toBeGreaterThan(1);
    expect(result.irrPct).not.toBeNull();
    expect(result.breakEven.breakEvenPct).toBeGreaterThan(0);
    expect(result.sensitivity).toHaveLength(4);
    expect(result.sensitivity[3]?.averageDscr ?? 0).toBeLessThan(
      result.sensitivity[0]?.averageDscr ?? 0,
    );
  });

  it('computes IRR and NPV consistently', () => {
    const flows = [-100, 30, 30, 30, 30, 30];
    const irr = internalRateOfReturn(flows);
    expect(irr).not.toBeNull();
    expect(netPresentValue(flows, irr ?? 0)).toBeCloseTo(0, 4);
    expect(internalRateOfReturn([100, 10])).toBeNull();
  });

  it('keeps older inputs without the optional fields working', () => {
    const {
      capitalSubsidy,
      subsidySchemeName,
      interestSubventionPct,
      ...rest
    } = needsUnit;
    void capitalSubsidy;
    void subsidySchemeName;
    void interestSubventionPct;
    const legacy = buildDprFinancials(dprFinancialInputSchema.parse(rest));
    expect(legacy.years).toHaveLength(7);
    for (const year of legacy.years) {
      expect(year.totalAssets).toBeCloseTo(year.totalLiabilities, 4);
    }
  });
});

describe('bank-style DPR document', () => {
  const generatedAt = '2026-11-21T00:00:00.000Z';
  const model = buildDprDocumentModel(
    createInputSnapshot(needsUnit, generatedAt),
    {
      rulesetVersion: 'tn-2026.11',
      capturedAt: generatedAt,
      rules: [],
      hash: 'b'.repeat(64),
    },
    1,
    generatedAt,
  );

  it('includes the sections a bank appraisal expects', () => {
    const headings = model.sections.map((section) => section.heading);
    for (const expected of [
      'Executive summary',
      'Cost of project',
      'Means of finance',
      'Government scheme benefits',
      'Projected profitability statement',
      'Term loan repayment schedule',
      'Projected cash flow statement',
      'Projected balance sheet',
      'Debt service coverage',
      'Break-even analysis',
      'Sensitivity analysis',
      'Implementation schedule',
    ]) {
      expect(headings.some((heading) => heading.includes(expected))).toBe(true);
    }
    expect(model.cover?.highlights.length).toBeGreaterThan(3);
  });

  it('renders real Word tables, a contents field and a page-number footer', () => {
    const files = unzipSync(renderDeterministicDocx(model));
    const document = strFromU8(files['word/document.xml'] ?? new Uint8Array());
    expect(document).toContain('<w:tbl>');
    expect(document).toContain('TOC \\o');
    expect(strFromU8(files['word/footer1.xml'] ?? new Uint8Array())).toContain(
      ' PAGE ',
    );
  });
});
