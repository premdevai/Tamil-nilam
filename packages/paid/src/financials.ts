/**
 * Bank-style projections for a Detailed Project Report.
 *
 * Everything here is pure arithmetic on the frozen DPR input, so a stored
 * snapshot always reproduces the same report. Optional inputs fall back to
 * the documented defaults in {@link DPR_DEFAULTS}; the report prints every
 * assumption it used so a banker can see and challenge it.
 */

import type { DprFinancialInput } from './index';

export const DPR_DEFAULTS = {
  loanInterestRatePct: 10.5,
  loanTenureYears: 7,
  moratoriumMonths: 12,
  interestSubventionPct: 0,
  revenueGrowthPct: 5,
  startUtilisationPct: 60,
  maxUtilisationPct: 85,
  utilisationStepPct: 10,
  variableCostSharePct: 70,
  taxRatePct: 25,
  discountRatePct: 12,
  /** Income-tax WDV rates: building 10%, plant & machinery 15%, other 10%. */
  depreciation: { building: 0.1, plant: 0.15, other: 0.1 },
} as const;

export type ResolvedAssumptions = {
  readonly loanInterestRatePct: number;
  readonly loanTenureYears: number;
  readonly moratoriumMonths: number;
  readonly interestSubventionPct: number;
  readonly capitalSubsidy: number;
  readonly revenueGrowthPct: number;
  readonly startUtilisationPct: number;
  readonly maxUtilisationPct: number;
  readonly variableCostSharePct: number;
  readonly taxRatePct: number;
  readonly discountRatePct: number;
  readonly landCost: number;
  readonly years: number;
};

export type ProjectionYear = {
  readonly year: number;
  readonly utilisationPct: number;
  readonly revenue: number;
  readonly variableCost: number;
  readonly fixedCost: number;
  readonly ebitda: number;
  readonly depreciation: number;
  readonly grossInterest: number;
  readonly subvention: number;
  readonly netInterest: number;
  readonly pbt: number;
  readonly tax: number;
  readonly pat: number;
  readonly cashAccrual: number;
  readonly principal: number;
  readonly subsidyCredited: number;
  readonly loanOpening: number;
  readonly loanClosing: number;
  readonly dscr: number | null;
  readonly netBlock: {
    readonly land: number;
    readonly building: number;
    readonly plant: number;
    readonly other: number;
  };
  readonly depreciationBy: {
    readonly building: number;
    readonly plant: number;
    readonly other: number;
  };
  readonly cash: number;
  readonly reserves: number;
  readonly capitalReserve: number;
  readonly totalAssets: number;
  readonly totalLiabilities: number;
};

export type BreakEven = {
  readonly year: number;
  readonly utilisationPct: number;
  readonly fixedCosts: number;
  readonly contribution: number;
  readonly breakEvenPct: number | null;
  readonly cashBreakEvenPct: number | null;
};

export type Scenario = {
  readonly label: string;
  readonly averageDscr: number | null;
  readonly minimumDscr: number | null;
  readonly irrPct: number | null;
};

export type DprFinancials = {
  readonly assumptions: ResolvedAssumptions;
  readonly years: readonly ProjectionYear[];
  readonly averageDscr: number | null;
  readonly minimumDscr: number | null;
  readonly breakEven: BreakEven;
  readonly irrPct: number | null;
  readonly npv: number;
  readonly paybackYears: number | null;
  readonly debtEquity: number | null;
  readonly promoterMarginPct: number;
  readonly averageRoiPct: number;
  readonly sensitivity: readonly Scenario[];
  readonly warnings: readonly string[];
};

type Shock = { readonly revenue: number; readonly cost: number };

export function resolveAssumptions(
  input: DprFinancialInput,
): ResolvedAssumptions {
  const tenure = input.loanTenureYears ?? DPR_DEFAULTS.loanTenureYears;
  const start = input.startUtilisationPct ?? DPR_DEFAULTS.startUtilisationPct;
  return {
    loanInterestRatePct:
      input.loanInterestRatePct ?? DPR_DEFAULTS.loanInterestRatePct,
    loanTenureYears: tenure,
    moratoriumMonths: Math.min(
      input.moratoriumMonths ?? DPR_DEFAULTS.moratoriumMonths,
      tenure * 12 - 1,
    ),
    interestSubventionPct: Math.min(
      input.interestSubventionPct ?? DPR_DEFAULTS.interestSubventionPct,
      input.loanInterestRatePct ?? DPR_DEFAULTS.loanInterestRatePct,
    ),
    capitalSubsidy: Math.min(input.capitalSubsidy ?? 0, input.termLoan),
    revenueGrowthPct: input.revenueGrowthPct ?? DPR_DEFAULTS.revenueGrowthPct,
    startUtilisationPct: start,
    maxUtilisationPct: Math.max(
      start,
      input.maxUtilisationPct ?? DPR_DEFAULTS.maxUtilisationPct,
    ),
    variableCostSharePct:
      input.variableCostSharePct ?? DPR_DEFAULTS.variableCostSharePct,
    taxRatePct: input.taxRatePct ?? DPR_DEFAULTS.taxRatePct,
    discountRatePct: input.discountRatePct ?? DPR_DEFAULTS.discountRatePct,
    landCost: Math.min(input.landCost ?? 0, input.landAndBuildingCost),
    years: Math.min(10, Math.max(7, tenure)),
  };
}

export function buildDprFinancials(input: DprFinancialInput): DprFinancials {
  const assumptions = resolveAssumptions(input);
  const base = project(input, assumptions, { revenue: 1, cost: 1 });
  const repaymentYears = base.filter((year) => year.dscr !== null);
  const dscrs = repaymentYears.map((year) => year.dscr as number);
  const averageDscr = averageDscrOf(base);
  const steady =
    base.find((year) => year.utilisationPct >= assumptions.maxUtilisationPct) ??
    base[base.length - 1];
  const breakEven = breakEvenFor(steady as ProjectionYear);
  const flows = projectCashFlows(input, assumptions, base);
  const irr = internalRateOfReturn(flows);
  const npv = netPresentValue(flows, assumptions.discountRatePct / 100);
  const equity = input.promoterContribution + input.otherFunding;
  const averagePat =
    base.reduce((sum, year) => sum + year.pat, 0) / base.length;
  const sensitivity = (
    [
      ['Base case', { revenue: 1, cost: 1 }],
      ['Revenue 10% lower', { revenue: 0.9, cost: 1 }],
      ['Operating cost 10% higher', { revenue: 1, cost: 1.1 }],
      ['Both shocks together', { revenue: 0.9, cost: 1.1 }],
    ] as const
  ).map(([label, shock]) => {
    const years = project(input, assumptions, shock);
    const cover = years
      .map((year) => year.dscr)
      .filter((value): value is number => value !== null);
    const shockedIrr = internalRateOfReturn(
      projectCashFlows(input, assumptions, years),
    );
    return {
      label,
      averageDscr: averageDscrOf(years),
      minimumDscr: cover.length === 0 ? null : Math.min(...cover),
      irrPct: shockedIrr === null ? null : shockedIrr * 100,
    };
  });

  const warnings: string[] = [];
  if (averageDscr !== null && averageDscr < 1.5) {
    warnings.push(
      `Average DSCR is ${averageDscr.toFixed(2)}; most banks look for 1.5 or more.`,
    );
  }
  if (dscrs.some((value) => value < 1.2)) {
    warnings.push(
      'DSCR falls below 1.2 in at least one year; consider a longer tenure or moratorium.',
    );
  }
  if (base.some((year) => year.cash < 0)) {
    warnings.push(
      'Projected cash turns negative in at least one year; repayments exceed cash accruals.',
    );
  }
  if (base.some((year) => year.pat < 0)) {
    warnings.push('The unit is projected to make a loss in at least one year.');
  }
  if (irr !== null && irr * 100 < assumptions.loanInterestRatePct) {
    warnings.push(
      'Project IRR is below the loan interest rate; the project may not earn its cost of debt.',
    );
  }

  return {
    assumptions,
    years: base,
    averageDscr,
    minimumDscr: dscrs.length === 0 ? null : Math.min(...dscrs),
    breakEven,
    irrPct: irr === null ? null : irr * 100,
    npv,
    paybackYears: payback(input.projectCost, base),
    debtEquity: equity > 0 ? input.termLoan / equity : null,
    promoterMarginPct: (input.promoterContribution / input.projectCost) * 100,
    averageRoiPct: (averagePat / input.projectCost) * 100,
    sensitivity,
    warnings,
  };
}

function averageDscrOf(years: readonly ProjectionYear[]): number | null {
  const repaying = years.filter((year) => year.dscr !== null);
  if (repaying.length === 0) return null;
  const available = repaying.reduce(
    (sum, year) => sum + year.pat + year.depreciation + year.netInterest,
    0,
  );
  const service = repaying.reduce(
    (sum, year) => sum + year.netInterest + year.principal,
    0,
  );
  return service > 0 ? available / service : null;
}

/** Year-by-year operations, depreciation, loan and balance sheet. */
function project(
  input: DprFinancialInput,
  a: ResolvedAssumptions,
  shock: Shock,
): ProjectionYear[] {
  const growth = 1 + a.revenueGrowthPct / 100;
  const variableShare = a.variableCostSharePct / 100;
  const variable1 = input.projectedAnnualOperatingCost * variableShare;
  const fixed1 = input.projectedAnnualOperatingCost - variable1;
  const rate = a.loanInterestRatePct / 100;
  const subventionRate = a.interestSubventionPct / 100;
  const totalMonths = a.loanTenureYears * 12;
  const repaymentMonths = Math.max(1, totalMonths - a.moratoriumMonths);

  let building = input.landAndBuildingCost - a.landCost;
  let plant = input.plantAndMachineryCost;
  let other = input.otherFixedCost;
  let loan = input.termLoan;
  let cash = 0;
  let reserves = 0;
  let capitalReserve = 0;
  let lossCarried = 0;
  let monthsRepaid = 0;
  const years: ProjectionYear[] = [];

  for (let year = 1; year <= a.years; year += 1) {
    const utilisation = Math.min(
      a.maxUtilisationPct,
      a.startUtilisationPct + (year - 1) * DPR_DEFAULTS.utilisationStepPct,
    );
    const volume = utilisation / a.startUtilisationPct;
    const price = growth ** (year - 1);
    const revenue =
      input.projectedAnnualRevenue * volume * price * shock.revenue;
    const variableCost = variable1 * volume * price * shock.cost;
    const fixedCost = fixed1 * price * shock.cost;
    const ebitda = revenue - variableCost - fixedCost;

    const depreciationBy = {
      building: building * DPR_DEFAULTS.depreciation.building,
      plant: plant * DPR_DEFAULTS.depreciation.plant,
      other: other * DPR_DEFAULTS.depreciation.other,
    };
    building -= depreciationBy.building;
    plant -= depreciationBy.plant;
    other -= depreciationBy.other;
    const depreciation =
      depreciationBy.building + depreciationBy.plant + depreciationBy.other;

    const loanOpening = loan;
    let grossInterest = 0;
    let principal = 0;
    let subsidyCredited = 0;
    for (let month = 1; month <= 12; month += 1) {
      const absoluteMonth = (year - 1) * 12 + month;
      grossInterest += loan * (rate / 12);
      if (absoluteMonth > a.moratoriumMonths && loan > 0.005) {
        const remaining = Math.max(1, repaymentMonths - monthsRepaid);
        const instalment = Math.min(loan, loan / remaining);
        principal += instalment;
        loan -= instalment;
        monthsRepaid += 1;
      }
      if (year === 1 && month === 12 && a.capitalSubsidy > 0) {
        subsidyCredited = Math.min(loan, a.capitalSubsidy);
        loan -= subsidyCredited;
        capitalReserve += subsidyCredited;
      }
    }
    const subvention = rate > 0 ? grossInterest * (subventionRate / rate) : 0;
    const netInterest = grossInterest - subvention;
    const pbt = ebitda - depreciation - netInterest;
    let taxable = pbt;
    if (taxable > 0 && lossCarried > 0) {
      const used = Math.min(taxable, lossCarried);
      taxable -= used;
      lossCarried -= used;
    } else if (taxable < 0) {
      lossCarried += -taxable;
    }
    const tax = taxable > 0 ? taxable * (a.taxRatePct / 100) : 0;
    const pat = pbt - tax;
    reserves += pat;
    cash += pat + depreciation - principal;
    const service = netInterest + principal;
    const netBlock = { land: a.landCost, building, plant, other };
    const totalAssets =
      netBlock.land + building + plant + other + input.workingCapital + cash;
    const totalLiabilities =
      input.promoterContribution +
      input.otherFunding +
      capitalReserve +
      reserves +
      loan;
    years.push({
      year,
      utilisationPct: utilisation,
      revenue,
      variableCost,
      fixedCost,
      ebitda,
      depreciation,
      grossInterest,
      subvention,
      netInterest,
      pbt,
      tax,
      pat,
      cashAccrual: pat + depreciation,
      principal,
      subsidyCredited,
      loanOpening,
      loanClosing: Math.max(0, loan),
      dscr:
        principal > 0.005 && service > 0
          ? (pat + depreciation + netInterest) / service
          : null,
      netBlock,
      depreciationBy,
      cash,
      reserves,
      capitalReserve,
      totalAssets,
      totalLiabilities,
    });
  }
  return years;
}

function breakEvenFor(year: ProjectionYear): BreakEven {
  const contribution = year.revenue - year.variableCost;
  const fixedCosts = year.fixedCost + year.depreciation + year.netInterest;
  const cashFixed = year.fixedCost + year.netInterest;
  return {
    year: year.year,
    utilisationPct: year.utilisationPct,
    fixedCosts,
    contribution,
    breakEvenPct:
      contribution > 0
        ? (fixedCosts / contribution) * year.utilisationPct
        : null,
    cashBreakEvenPct:
      contribution > 0
        ? (cashFixed / contribution) * year.utilisationPct
        : null,
  };
}

/** Unlevered project cash flows: outlay at t0, after-tax operating flows, residual value. */
function projectCashFlows(
  input: DprFinancialInput,
  a: ResolvedAssumptions,
  years: readonly ProjectionYear[],
): number[] {
  const tax = a.taxRatePct / 100;
  const flows = [-input.projectCost];
  years.forEach((year, index) => {
    let flow = year.pat + year.depreciation + year.netInterest * (1 - tax);
    if (index === years.length - 1) {
      flow +=
        input.workingCapital +
        year.netBlock.land +
        year.netBlock.building +
        year.netBlock.plant +
        year.netBlock.other;
    }
    flows.push(flow);
  });
  return flows;
}

export function netPresentValue(
  flows: readonly number[],
  rate: number,
): number {
  return flows.reduce((sum, flow, t) => sum + flow / (1 + rate) ** t, 0);
}

/** Bisection IRR; null when the flows never change sign. */
export function internalRateOfReturn(flows: readonly number[]): number | null {
  let low = -0.99;
  let high = 2;
  let npvLow = netPresentValue(flows, low);
  const npvHigh = netPresentValue(flows, high);
  if (npvLow * npvHigh > 0) return null;
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (low + high) / 2;
    const value = netPresentValue(flows, mid);
    if (Math.abs(value) < 1e-6) return mid;
    if (value * npvLow < 0) {
      high = mid;
    } else {
      low = mid;
      npvLow = value;
    }
  }
  return (low + high) / 2;
}

function payback(
  projectCost: number,
  years: readonly ProjectionYear[],
): number | null {
  let recovered = 0;
  for (const year of years) {
    const inflow = year.pat + year.depreciation + year.netInterest;
    if (inflow > 0 && recovered + inflow >= projectCost) {
      return year.year - 1 + (projectCost - recovered) / inflow;
    }
    recovered += inflow;
  }
  return null;
}
