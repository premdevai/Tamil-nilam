import { dprFinancialInputSchema } from '@nilam/paid';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NEEDS_BUSINESS,
  NEEDS_BUSINESSES,
  NEEDS_LIMITS,
  NEEDS_ROADMAP,
  clampProjectLakhs,
  dprPrefillQuery,
  formatLakhs,
  getNeedsBusiness,
  needsEligibility,
  needsFundingPlan,
} from './needs-path';

const evenSplit = {
  landAndBuilding: 0.3,
  plantAndMachinery: 0.45,
  otherFixed: 0.05,
  workingCapital: 0.2,
};

describe('needsFundingPlan', () => {
  it('asks a special-category founder for 5% of a ₹1 crore project', () => {
    const plan = needsFundingPlan(100, 'special', evenSplit);
    expect(plan.yourContributionLakhs).toBe(5);
    expect(plan.bankLoanLakhs).toBe(95);
  });

  it('asks a general-category founder for 10%', () => {
    const plan = needsFundingPlan(100, 'general', evenSplit);
    expect(plan.yourContributionLakhs).toBe(10);
    expect(plan.bankLoanLakhs).toBe(90);
  });

  it('pays 25% of capital cost, not of working capital', () => {
    const plan = needsFundingPlan(100, 'general', evenSplit);
    expect(plan.capitalCostLakhs).toBe(80);
    expect(plan.subsidyLakhs).toBe(20);
    expect(plan.subsidyCapped).toBe(false);
    expect(plan.loanAfterSubsidyLakhs).toBe(70);
  });

  it('caps the subsidy at ₹75 lakh', () => {
    const plan = needsFundingPlan(500, 'general', evenSplit);
    expect(plan.subsidyLakhs).toBe(NEEDS_LIMITS.subsidyCapLakhs);
    expect(plan.subsidyCapped).toBe(true);
  });

  it('keeps itemised costs equal to the project cost', () => {
    for (const business of NEEDS_BUSINESSES) {
      const plan = needsFundingPlan(
        business.typicalLakhs,
        'general',
        business.split,
      );
      const sum =
        plan.costs.landAndBuilding +
        plan.costs.plantAndMachinery +
        plan.costs.otherFixed +
        plan.costs.workingCapital;
      expect(sum).toBeCloseTo(plan.projectLakhs, 2);
    }
  });

  it('clamps project cost to the ₹10 lakh – ₹5 crore band', () => {
    expect(clampProjectLakhs(4)).toBe(10);
    expect(clampProjectLakhs(900)).toBe(500);
    expect(clampProjectLakhs(Number.NaN)).toBe(10);
  });
});

describe('business catalogue', () => {
  it('only lists presets inside the NEEDS cost band with splits that sum to 1', () => {
    for (const business of NEEDS_BUSINESSES) {
      expect(business.minLakhs).toBeGreaterThanOrEqual(
        NEEDS_LIMITS.minProjectLakhs,
      );
      expect(business.maxLakhs).toBeLessThanOrEqual(
        NEEDS_LIMITS.maxProjectLakhs,
      );
      expect(business.typicalLakhs).toBeGreaterThanOrEqual(business.minLakhs);
      expect(business.typicalLakhs).toBeLessThanOrEqual(business.maxLakhs);
      const { landAndBuilding, plantAndMachinery, otherFixed, workingCapital } =
        business.split;
      expect(
        landAndBuilding + plantAndMachinery + otherFixed + workingCapital,
      ).toBeCloseTo(1, 6);
    }
  });

  it('has unique ids', () => {
    const ids = NEEDS_BUSINESSES.map((business) => business.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getNeedsBusiness('cold-pressed-oil')?.name).toBe(
      'Cold-pressed oil mill',
    );
  });
});

describe('needsEligibility', () => {
  const base = {
    name: 'Test',
    age: 30,
    category: 'general' as const,
    education: 'degree' as const,
    firstGeneration: true,
    tnResident3Years: true,
    district: 'Kallakurichi',
  };

  it('passes a typical first-generation graduate', () => {
    expect(
      needsEligibility(base).every((check) => check.status === 'pass'),
    ).toBe(true);
  });

  it('allows special-category founders up to 55', () => {
    const general = needsEligibility({ ...base, age: 50 });
    const special = needsEligibility({ ...base, age: 50, category: 'special' });
    expect(general.find((check) => check.id === 'age')?.status).toBe('fail');
    expect(special.find((check) => check.id === 'age')?.status).toBe('pass');
  });

  it('marks unknown answers as needing a check rather than failing', () => {
    const checks = needsEligibility({
      ...base,
      age: null,
      firstGeneration: null,
    });
    expect(checks.find((check) => check.id === 'age')?.status).toBe('check');
    expect(
      checks.find((check) => check.id === 'first-generation')?.status,
    ).toBe('check');
  });
});

describe('roadmap', () => {
  it('runs from business choice to production', () => {
    expect(NEEDS_ROADMAP[0]?.id).toBe('pick');
    expect(NEEDS_ROADMAP.at(-1)?.id).toBe('production');
    expect(NEEDS_ROADMAP.some((step) => step.id === 'udyam')).toBe(true);
  });
});

describe('formatLakhs', () => {
  it('formats lakh and crore amounts', () => {
    expect(formatLakhs(5)).toBe('₹5 lakh');
    expect(formatLakhs(100)).toBe('₹1 crore');
    expect(formatLakhs(150)).toBe('₹1.5 crore');
    expect(formatLakhs(0.45)).toBe('₹45,000');
  });
});

describe('dprPrefillQuery', () => {
  it('produces inputs the DPR schema accepts', () => {
    const business = DEFAULT_NEEDS_BUSINESS;
    const plan = needsFundingPlan(
      business.typicalLakhs,
      'special',
      business.split,
    );
    const query = new URLSearchParams(
      dprPrefillQuery({
        business,
        plan,
        promoterName: 'Prem Kumar',
        district: 'Kallakurichi',
      }),
    );
    const number = (key: string) => Number(query.get(key));
    const parsed = dprFinancialInputSchema.safeParse({
      businessName: query.get('businessName'),
      promoterName: query.get('promoterName'),
      sector: query.get('sector'),
      district: query.get('district'),
      projectCost: number('projectCost'),
      landAndBuildingCost: number('landAndBuildingCost'),
      plantAndMachineryCost: number('plantAndMachineryCost'),
      otherFixedCost: number('otherFixedCost'),
      workingCapital: number('workingCapital'),
      promoterContribution: number('promoterContribution'),
      termLoan: number('termLoan'),
      otherFunding: 0,
      projectedAnnualRevenue: 4_000_000,
      projectedAnnualOperatingCost: 3_000_000,
      employment: number('employment'),
      implementationMonths: 8,
      citations: [
        {
          title: query.get('citationTitle'),
          url: query.get('citationUrl'),
          verifiedOn: query.get('citationVerifiedOn'),
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
