/**
 * Content of a bank-style Detailed Project Report.
 *
 * Section order follows the layout Indian banks, SIDBI and DICs expect for
 * term-loan appraisal: summary, promoter, project, market, cost and means of
 * finance, scheme benefits, assumptions, projected financials, ratios,
 * sensitivity, risks, implementation, approvals and annexures.
 */

import type { DprDocumentModel, DprSection, DprTable } from './documents';
import {
  DPR_DEFAULTS,
  buildDprFinancials,
  type DprFinancials,
  type ProjectionYear,
} from './financials';
import type { DprSnapshot, RulesetSnapshot } from './index';

export const DPR_DISCLAIMER =
  'This report is directional planning support, not legal, tax, investment, credit or bank-sanction advice. Eligibility, benefits, land availability and financing remain subject to the cited authority and the relevant institution’s independent review. NILAM does not claim government, legal or bank approval.';

/** Rupees → "12.34" lakh with Indian digit grouping. */
export function lakh(value: number): string {
  const lakhs = value / 100_000;
  const fixed = Math.abs(lakhs) < 0.005 ? 0 : lakhs;
  return fixed.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Rupees → "₹12,34,567". */
export function rupees(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

const pct = (value: number | null, digits = 1) =>
  value === null || !Number.isFinite(value)
    ? 'n/a'
    : `${value.toFixed(digits)}%`;
const ratio = (value: number | null) =>
  value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(2);

export function buildDprDocumentModel(
  snapshot: DprSnapshot,
  ruleset: RulesetSnapshot,
  documentVersion: number,
  generatedAt: string,
): DprDocumentModel {
  const { input, warnings } = snapshot;
  const f = buildDprFinancials(input);
  const a = f.assumptions;
  const years = f.years;
  const yearCols = years.map((year) => `Y${year.year}`);
  const preparedOn = generatedAt.slice(0, 10);
  const entity = input.entityKind ?? 'Proprietorship';
  const scheme = input.subsidySchemeName;
  const equity = input.promoterContribution + input.otherFunding;

  const row = (label: string, pick: (year: ProjectionYear) => number) => [
    label,
    ...years.map((year) => lakh(pick(year))),
  ];

  const sections: DprSection[] = [];

  sections.push({
    heading: '1. Executive summary',
    paragraphs: [
      `${input.businessName} is a proposed ${/\bunit$/iu.test(input.sector) ? input.sector.toLowerCase() : `${input.sector.toLowerCase()} unit`} in ${input.district} district, Tamil Nadu, promoted by ${input.promoterName} as a ${entity.toLowerCase()}. The project costs ${rupees(input.projectCost)} (₹${lakh(input.projectCost)} lakh) and seeks a term loan of ${rupees(input.termLoan)}${scheme === undefined ? '' : ` under ${scheme}`}.`,
      input.projectDescription ??
        `The unit will commence commercial operations about ${input.implementationMonths} months after loan sanction and employ ${input.employment} people.`,
      `On the assumptions in Section 9, the project shows an average DSCR of ${ratio(f.averageDscr)}, a project IRR of ${pct(f.irrPct)} and a payback of ${f.paybackYears === null ? 'more than the projection period' : `${f.paybackYears.toFixed(1)} years`}.`,
    ],
    tables: [
      keyValueTable('Project at a glance', [
        ['Name of the unit', input.businessName],
        ['Promoter', input.promoterName],
        ['Constitution', entity],
        ['Activity / sector', input.sector],
        [
          'Location',
          input.location ?? `${input.district} district, Tamil Nadu`,
        ],
        ['Total project cost', `₹${lakh(input.projectCost)} lakh`],
        [
          'Promoter contribution',
          `₹${lakh(input.promoterContribution)} lakh (${pct(f.promoterMarginPct)})`,
        ],
        ['Term loan sought', `₹${lakh(input.termLoan)} lakh`],
        ...(a.capitalSubsidy > 0
          ? ([
              [
                'Capital subsidy expected',
                `₹${lakh(a.capitalSubsidy)} lakh${scheme === undefined ? '' : ` (${scheme})`}`,
              ],
            ] as [string, string][])
          : []),
        ['Employment', `${input.employment} persons`],
        ['Implementation period', `${input.implementationMonths} months`],
        ['Average DSCR', ratio(f.averageDscr)],
        ['Minimum DSCR', ratio(f.minimumDscr)],
        ['Project IRR', pct(f.irrPct)],
        ['NPV @ ' + `${a.discountRatePct}%`, `₹${lakh(f.npv)} lakh`],
        ['Break-even (steady state)', pct(f.breakEven.breakEvenPct)],
        [
          'Payback period',
          f.paybackYears === null
            ? 'Beyond projection period'
            : `${f.paybackYears.toFixed(1)} years`,
        ],
      ]),
    ],
  });

  sections.push({
    heading: '2. Promoter profile',
    paragraphs: [
      input.promoterProfile ??
        `${input.promoterName} is the promoter of the proposed unit. Attach the promoter's educational certificates, experience letters, EDP/training certificate and KYC documents as annexures.`,
      `Constitution of the enterprise: ${entity}.`,
    ],
  });

  sections.push({
    heading: '3. Project description, products and capacity',
    paragraphs: [
      input.productsAndCapacity ??
        `Products / services: ${input.sector}. The unit plans to start at ${a.startUtilisationPct}% capacity utilisation in year 1, rising by ${DPR_DEFAULTS.utilisationStepPct} points a year to ${a.maxUtilisationPct}%.`,
    ],
    tables: [
      {
        caption: 'Capacity utilisation plan',
        columns: ['Year', ...yearCols],
        rows: [
          ['Utilisation', ...years.map((year) => `${year.utilisationPct}%`)],
        ],
      },
    ],
  });

  sections.push({
    heading: '4. Market potential and marketing strategy',
    paragraphs: [
      input.marketAndSales ??
        'Describe the target customers, the local and regional demand, competing suppliers, the pricing approach and the sales channels (direct, dealers, institutional, online). Attach any letters of intent or purchase orders received.',
    ],
  });

  sections.push({
    heading: '5. Location and infrastructure',
    paragraphs: [
      input.location ?? `${input.district} district, Tamil Nadu.`,
      'Confirm availability of power (sanctioned load), water, road access and skilled labour at the site. Attach the land document, lease deed or TANSIDCO allotment order.',
    ],
  });

  sections.push({
    heading: '6. Cost of project',
    paragraphs: [],
    tables: [
      {
        caption: 'Cost of project (₹ lakh)',
        columns: ['Particulars', 'Amount', 'Share'],
        rows: [
          ...(a.landCost > 0
            ? [
                [
                  'Land',
                  lakh(a.landCost),
                  share(a.landCost, input.projectCost),
                ],
                [
                  'Building and civil works',
                  lakh(input.landAndBuildingCost - a.landCost),
                  share(
                    input.landAndBuildingCost - a.landCost,
                    input.projectCost,
                  ),
                ],
              ]
            : [
                [
                  'Land and building',
                  lakh(input.landAndBuildingCost),
                  share(input.landAndBuildingCost, input.projectCost),
                ],
              ]),
          [
            'Plant and machinery',
            lakh(input.plantAndMachineryCost),
            share(input.plantAndMachineryCost, input.projectCost),
          ],
          [
            'Other fixed assets (electrification, furniture, pre-operatives)',
            lakh(input.otherFixedCost),
            share(input.otherFixedCost, input.projectCost),
          ],
          [
            'Working capital margin',
            lakh(input.workingCapital),
            share(input.workingCapital, input.projectCost),
          ],
          ['Total project cost', lakh(input.projectCost), '100.0%'],
        ],
        emphasis: 'last',
      },
    ],
    notes: [
      'Machinery cost should be supported by at least two supplier quotations; building cost by a civil engineer’s estimate.',
    ],
  });

  sections.push({
    heading: '7. Means of finance',
    paragraphs: [
      a.capitalSubsidy > 0
        ? `The capital subsidy of ₹${lakh(a.capitalSubsidy)} lakh is not a source of finance on day one. It is credited to the term-loan account after commercial production starts and is shown as a capital reserve.`
        : 'No capital subsidy has been assumed in the means of finance.',
    ],
    tables: [
      {
        caption: 'Means of finance (₹ lakh)',
        columns: ['Source', 'Amount', 'Share'],
        rows: [
          [
            'Promoter contribution',
            lakh(input.promoterContribution),
            share(input.promoterContribution, input.projectCost),
          ],
          [
            'Term loan from bank / TIIC',
            lakh(input.termLoan),
            share(input.termLoan, input.projectCost),
          ],
          ...(input.otherFunding > 0
            ? [
                [
                  'Other sources',
                  lakh(input.otherFunding),
                  share(input.otherFunding, input.projectCost),
                ],
              ]
            : []),
          ['Total', lakh(input.projectCost), '100.0%'],
        ],
        emphasis: 'last',
      },
      keyValueTable('Capital structure', [
        [
          'Debt : equity',
          f.debtEquity === null ? 'n/a' : `${f.debtEquity.toFixed(2)} : 1`,
        ],
        ['Promoter margin', pct(f.promoterMarginPct)],
      ]),
    ],
  });

  if (
    scheme !== undefined ||
    a.capitalSubsidy > 0 ||
    a.interestSubventionPct > 0
  ) {
    const subventionTotal = years.reduce(
      (sum, year) => sum + year.subvention,
      0,
    );
    sections.push({
      heading: '8. Government scheme benefits',
      paragraphs: [
        `Scheme: ${scheme ?? 'As cited in the annexure'}. Benefits below are as published on the cited source and remain subject to sanction by the District Industries Centre and the lending institution.`,
      ],
      tables: [
        keyValueTable('Benefits assumed in this report', [
          [
            'Capital subsidy',
            a.capitalSubsidy > 0
              ? `₹${lakh(a.capitalSubsidy)} lakh, credited to loan at end of year 1`
              : 'Not assumed',
          ],
          [
            'Interest subvention',
            a.interestSubventionPct > 0
              ? `${a.interestSubventionPct}% a year throughout repayment`
              : 'Not assumed',
          ],
          [
            'Interest saved over the loan',
            a.interestSubventionPct > 0
              ? `₹${lakh(subventionTotal)} lakh`
              : '—',
          ],
        ]),
      ],
    });
  }

  sections.push({
    heading: '9. Key assumptions',
    paragraphs: input.assumptions.length > 0 ? input.assumptions : [],
    tables: [
      keyValueTable('Basis of projections', [
        [
          'Year-1 revenue',
          `₹${lakh(input.projectedAnnualRevenue)} lakh at ${a.startUtilisationPct}% utilisation`,
        ],
        [
          'Year-1 operating cost',
          `₹${lakh(input.projectedAnnualOperatingCost)} lakh (${a.variableCostSharePct}% variable)`,
        ],
        [
          'Utilisation ramp',
          `${a.startUtilisationPct}% rising ${DPR_DEFAULTS.utilisationStepPct} points a year to ${a.maxUtilisationPct}%`,
        ],
        ['Price and cost escalation', `${a.revenueGrowthPct}% a year`],
        [
          'Term loan interest',
          `${a.loanInterestRatePct}% a year, monthly rests`,
        ],
        [
          'Loan tenure',
          `${a.loanTenureYears} years including ${a.moratoriumMonths} months moratorium`,
        ],
        [
          'Repayment',
          'Equal monthly principal instalments after moratorium; interest serviced as charged',
        ],
        [
          'Depreciation',
          'Written-down value: building 10%, plant and machinery 15%, other assets 10%',
        ],
        [
          'Income tax',
          `${a.taxRatePct}% of profit before tax, after setting off carried-forward losses`,
        ],
        ['Discount rate for NPV', `${a.discountRatePct}%`],
        [
          'Projection period',
          `${a.years} years from commencement of commercial production`,
        ],
      ]),
    ],
  });

  sections.push({
    heading: '10. Projected profitability statement',
    paragraphs: [],
    tables: [
      {
        caption: 'Projected profit and loss (₹ lakh)',
        columns: ['Particulars', ...yearCols],
        rows: [
          [
            'Capacity utilisation',
            ...years.map((year) => `${year.utilisationPct}%`),
          ],
          row('Revenue from operations', (year) => year.revenue),
          row('Variable costs', (year) => year.variableCost),
          row('Fixed operating costs', (year) => year.fixedCost),
          row('EBITDA', (year) => year.ebitda),
          row('Depreciation', (year) => year.depreciation),
          row('Interest on term loan', (year) => year.grossInterest),
          row('Less: interest subvention', (year) => year.subvention),
          row('Profit before tax', (year) => year.pbt),
          row('Income tax', (year) => year.tax),
          row('Profit after tax', (year) => year.pat),
          row('Cash accruals (PAT + depreciation)', (year) => year.cashAccrual),
        ],
        emphasis: [4, 10, 11],
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '11. Depreciation schedule',
    paragraphs: [],
    tables: [
      {
        caption: 'Depreciation, written-down value method (₹ lakh)',
        columns: ['Particulars', ...yearCols],
        rows: [
          row('Building (10%)', (year) => year.depreciationBy.building),
          row('Plant and machinery (15%)', (year) => year.depreciationBy.plant),
          row('Other fixed assets (10%)', (year) => year.depreciationBy.other),
          row('Total depreciation', (year) => year.depreciation),
          row(
            'Closing net block',
            (year) =>
              year.netBlock.land +
              year.netBlock.building +
              year.netBlock.plant +
              year.netBlock.other,
          ),
        ],
        emphasis: [3],
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '12. Term loan repayment schedule',
    paragraphs: [],
    tables: [
      {
        caption: 'Repayment schedule (₹ lakh)',
        columns: [
          'Year',
          'Opening',
          'Interest',
          'Subvention',
          'Principal',
          'Subsidy credit',
          'Closing',
        ],
        widths: [0.7, 1, 1, 1, 1, 1, 1],
        rows: years.map((year) => [
          `Y${year.year}`,
          lakh(year.loanOpening),
          lakh(year.grossInterest),
          lakh(year.subvention),
          lakh(year.principal),
          lakh(year.subsidyCredited),
          lakh(year.loanClosing),
        ]),
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '13. Projected cash flow statement',
    paragraphs: [],
    tables: [
      {
        caption: 'Cash flow (₹ lakh)',
        columns: ['Particulars', ...yearCols],
        rows: [
          row('Profit after tax', (year) => year.pat),
          row('Add: depreciation', (year) => year.depreciation),
          row('Add: subsidy credited to loan', (year) => year.subsidyCredited),
          row(
            'Total sources',
            (year) => year.pat + year.depreciation + year.subsidyCredited,
          ),
          row(
            'Loan principal repaid',
            (year) => year.principal + year.subsidyCredited,
          ),
          row('Total uses', (year) => year.principal + year.subsidyCredited),
          row(
            'Net cash flow',
            (year) => year.pat + year.depreciation - year.principal,
          ),
          row('Closing cash and bank', (year) => year.cash),
        ],
        emphasis: [6, 7],
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '14. Projected balance sheet',
    paragraphs: [],
    tables: [
      {
        caption: 'Balance sheet at year end (₹ lakh)',
        columns: ['Particulars', ...yearCols],
        rows: [
          ['Liabilities', ...years.map(() => '')],
          row(
            'Promoter capital',
            () => input.promoterContribution + input.otherFunding,
          ),
          row('Capital reserve (subsidy)', (year) => year.capitalReserve),
          row('Reserves and surplus', (year) => year.reserves),
          row('Term loan outstanding', (year) => year.loanClosing),
          row('Total liabilities', (year) => year.totalLiabilities),
          ['Assets', ...years.map(() => '')],
          row(
            'Net fixed assets',
            (year) =>
              year.netBlock.land +
              year.netBlock.building +
              year.netBlock.plant +
              year.netBlock.other,
          ),
          row('Working capital (current assets)', () => input.workingCapital),
          row('Cash and bank', (year) => year.cash),
          row('Total assets', (year) => year.totalAssets),
        ],
        emphasis: [0, 5, 6, 10],
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '15. Debt service coverage and financial ratios',
    paragraphs: [
      `Average DSCR over the repayment years is ${ratio(f.averageDscr)} (minimum ${ratio(f.minimumDscr)}). Banks generally expect an average of 1.5 or more and no year below 1.2.`,
    ],
    tables: [
      {
        caption: 'Debt service coverage ratio (₹ lakh)',
        columns: ['Particulars', ...yearCols],
        rows: [
          row(
            'PAT + depreciation + interest',
            (year) => year.pat + year.depreciation + year.netInterest,
          ),
          row(
            'Interest + principal due',
            (year) => year.netInterest + year.principal,
          ),
          ['DSCR', ...years.map((year) => ratio(year.dscr))],
        ],
        emphasis: [2],
        numeric: true,
      },
      keyValueTable('Summary ratios', [
        ['Average DSCR', ratio(f.averageDscr)],
        ['Minimum DSCR', ratio(f.minimumDscr)],
        ['Project IRR (post-tax)', pct(f.irrPct)],
        [`NPV at ${a.discountRatePct}%`, `₹${lakh(f.npv)} lakh`],
        [
          'Payback period',
          f.paybackYears === null
            ? 'Beyond projection period'
            : `${f.paybackYears.toFixed(1)} years`,
        ],
        ['Average return on investment', pct(f.averageRoiPct)],
        [
          'Debt : equity',
          f.debtEquity === null ? 'n/a' : `${f.debtEquity.toFixed(2)} : 1`,
        ],
        ['Owners’ funds invested', `₹${lakh(equity)} lakh`],
      ]),
    ],
  });

  sections.push({
    heading: '16. Break-even analysis',
    paragraphs: [
      `Computed for year ${f.breakEven.year} at ${f.breakEven.utilisationPct}% utilisation. Fixed costs include fixed operating costs, depreciation and interest; cash break-even excludes depreciation.`,
    ],
    tables: [
      keyValueTable('Break-even point', [
        [
          'Contribution (revenue − variable cost)',
          `₹${lakh(f.breakEven.contribution)} lakh`,
        ],
        ['Fixed costs', `₹${lakh(f.breakEven.fixedCosts)} lakh`],
        ['Break-even capacity utilisation', pct(f.breakEven.breakEvenPct)],
        ['Cash break-even utilisation', pct(f.breakEven.cashBreakEvenPct)],
      ]),
    ],
  });

  sections.push({
    heading: '17. Sensitivity analysis',
    paragraphs: [
      'The projections are re-run with lower revenue and higher costs to show how much shock the project can absorb before debt service is at risk.',
    ],
    tables: [
      {
        caption: 'Sensitivity of returns and debt cover',
        columns: ['Scenario', 'Average DSCR', 'Minimum DSCR', 'Project IRR'],
        rows: f.sensitivity.map((scenario) => [
          scenario.label,
          ratio(scenario.averageDscr),
          ratio(scenario.minimumDscr),
          pct(scenario.irrPct),
        ]),
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '18. SWOT, risks and mitigation',
    paragraphs: [],
    tables: [
      {
        caption: 'Key risks and mitigation',
        columns: ['Risk', 'Mitigation'],
        rows: [
          [
            'Demand lower than planned',
            'Tie up anchor buyers early; diversify channels; the sensitivity case shows cover at 10% lower revenue.',
          ],
          [
            'Raw material price or supply volatility',
            'Multiple suppliers, seasonal stocking within working-capital limits, escalation clauses with buyers.',
          ],
          [
            'Implementation delay and cost overrun',
            `Fixed-price machinery orders, a ${input.implementationMonths}-month schedule with milestones, contingency within other fixed assets.`,
          ],
          [
            'Working-capital stress',
            'Cash-credit limit sanctioned with the term loan; tight receivable terms.',
          ],
          [
            'Regulatory and approval delays',
            'Apply for consents in parallel with civil works; use single-window portals.',
          ],
        ],
        widths: [1, 2],
      },
    ],
    notes:
      f.warnings.length > 0
        ? f.warnings.map((warning) => `Flag: ${warning}`)
        : [],
  });

  sections.push({
    heading: '19. Implementation schedule',
    paragraphs: [],
    tables: [
      {
        caption: `Implementation plan (${input.implementationMonths} months)`,
        columns: ['Activity', 'From month', 'To month'],
        rows: implementationPlan(input.implementationMonths),
        numeric: true,
      },
    ],
  });

  sections.push({
    heading: '20. Statutory approvals and licences',
    paragraphs: [],
    tables: [
      {
        caption: 'Approvals required',
        columns: ['Approval', 'Authority / portal'],
        rows: [
          ['Udyam registration', 'udyamregistration.gov.in'],
          ['GST registration', 'gst.gov.in'],
          [
            'Consent to establish / operate',
            'Tamil Nadu Pollution Control Board',
          ],
          [
            'Building plan and factory licence',
            'Local body / Directorate of Industrial Safety and Health',
          ],
          ['Power connection', 'TANGEDCO'],
          ...(input.licences ?? []).map((licence) => [
            licence,
            'As applicable',
          ]),
        ],
        widths: [1, 1],
      },
    ],
  });

  sections.push({
    heading: '21. Validation notes',
    paragraphs:
      warnings.length > 0
        ? warnings.map((warning) => `Warning: ${warning}`)
        : ['No automated validation warnings were raised.'],
  });

  sections.push({
    heading: 'Annexure A. Cited scheme sources',
    paragraphs: input.citations.map(
      (citation) =>
        `${citation.title} — verified ${citation.verifiedOn} — ${citation.url}`,
    ),
  });

  sections.push({
    heading: 'Annexure B. Documents to attach',
    paragraphs: [
      'KYC of promoter(s): Aadhaar, PAN, photographs; community certificate where applicable.',
      'Educational and EDP / training certificates; experience proof.',
      'Udyam registration certificate; GST registration once obtained.',
      'Land document, lease deed or allotment order; approved building plan and civil estimate.',
      'Machinery quotations (at least two per major item).',
      'Bank statements for six months; income-tax returns, if any.',
    ],
  });

  sections.push({
    heading: 'Annexure C. Ruleset and reproducibility',
    paragraphs: [
      `Ruleset version: ${ruleset.rulesetVersion}`,
      `Ruleset snapshot hash: ${ruleset.hash}`,
      `Input captured: ${snapshot.capturedAt}`,
      `Ruleset captured: ${ruleset.capturedAt}`,
      ...ruleset.rules.map(
        (rule) =>
          `${rule.schemeSlug} v${rule.version}, verified ${rule.verifiedOn}: ${rule.sourceUrl}`,
      ),
    ],
  });

  sections.push({
    heading: 'Important disclaimer',
    paragraphs: [DPR_DISCLAIMER],
  });

  return {
    title: `Detailed Project Report — ${input.businessName}`,
    documentVersion,
    generatedAt,
    cover: {
      subtitle: `${input.sector} · ${input.district}, Tamil Nadu`,
      preparedFor: input.promoterName,
      preparedOn,
      highlights: [
        ['Project cost', `₹${lakh(input.projectCost)} lakh`],
        ['Term loan', `₹${lakh(input.termLoan)} lakh`],
        ['Promoter contribution', `₹${lakh(input.promoterContribution)} lakh`],
        ['Employment', `${input.employment}`],
        ['Average DSCR', ratio(f.averageDscr)],
        ['Project IRR', pct(f.irrPct)],
      ],
    },
    sections,
  };
}

function share(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—';
}

function keyValueTable(
  caption: string,
  pairs: readonly (readonly [string, string])[],
): DprTable {
  return {
    caption,
    columns: ['Item', 'Detail'],
    rows: pairs.map(([key, value]) => [key, value]),
    widths: [1, 1.4],
    header: false,
  };
}

function implementationPlan(months: number): string[][] {
  const at = (fraction: number) => Math.max(1, Math.round(months * fraction));
  return [
    ['Udyam, DIC application and EDP', '1', String(at(0.15))],
    [
      'Loan sanction and subsidy recommendation',
      String(at(0.1)),
      String(at(0.3)),
    ],
    ['Land / shed possession and approvals', String(at(0.2)), String(at(0.45))],
    ['Civil works and electrification', String(at(0.35)), String(at(0.75))],
    [
      'Machinery order, delivery and installation',
      String(at(0.45)),
      String(at(0.9)),
    ],
    ['Trial run and consent to operate', String(at(0.85)), String(months)],
    ['Commercial production', String(months), String(months)],
  ];
}

export type { DprFinancials };
