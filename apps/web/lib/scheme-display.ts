export type SchemeDisplay = {
  readonly shortName?: string;
  readonly line: string;
  readonly summary: string;
};

export const SCHEME_DISPLAY = {
  needs: {
    shortName: 'NEEDS',
    line: 'Capital-subsidy support for eligible first-generation Tamil Nadu entrepreneurs.',
    summary:
      'The New Entrepreneur-cum-Enterprise Development Scheme supports eligible first-generation founders through a cited capital-subsidy rule and an application path through the District Industries Centre.',
  },
  uyegp: {
    shortName: 'UYEGP',
    line: 'Margin-money support for eligible new trading and business projects.',
    summary:
      'The Unemployed Youth Employment Generation Programme supports qualifying Tamil Nadu promoters starting a small trading or business enterprise.',
  },
  pmegp: {
    shortName: 'PMEGP',
    line: 'Central margin-money support for qualifying new micro enterprises.',
    summary:
      'The Prime Minister’s Employment Generation Programme provides a cited margin-money subsidy for eligible new enterprises, subject to category, location and project conditions.',
  },
  pmfme: {
    shortName: 'PMFME',
    line: 'Credit-linked capital support for eligible existing micro food units.',
    summary:
      'PMFME supports the formalisation of qualifying existing micro food-processing enterprises through a temporary, cited credit-linked subsidy window.',
  },
  aif: {
    shortName: 'AIF',
    line: 'Interest-cost support for qualifying agriculture infrastructure credit.',
    summary:
      'The Agriculture Infrastructure Fund can reduce borrowing cost for eligible infrastructure projects. The engine does not turn its loan-schedule-dependent support into a cash estimate.',
  },
  cgtmse: {
    shortName: 'CGTMSE',
    line: 'Eligible lenders can seek government guarantee cover for qualifying credit.',
    summary:
      'CGTMSE is lender-claimed credit-guarantee access, not a cash grant to the enterprise. Final cover remains subject to lender appraisal and scheme terms.',
  },
  mudra: {
    shortName: 'MUDRA',
    line: 'Institutional credit access for qualifying micro enterprises.',
    summary:
      'MUDRA provides a route to collateral-free institutional credit within the applicable tier. It is financing access rather than subsidy income.',
  },
  'tiic-general': {
    shortName: 'TIIC term loan',
    line: 'Tamil Nadu term-loan access for qualifying enterprises.',
    summary:
      'TIIC offers term-loan access to eligible enterprises. Sanction quantum, security and pricing depend on TIIC appraisal and are not estimated as subsidy.',
  },
  'zed-certification': {
    shortName: 'ZED certification',
    line: 'Certification-cost support for qualifying Udyam-registered MSMEs.',
    summary:
      'The ZED programme offsets specified certification costs for eligible MSMEs. Limited-purpose support is not represented as unrestricted cash.',
  },
} as const satisfies Readonly<Record<string, SchemeDisplay>>;

export function schemeDisplay(schemeId: string): SchemeDisplay | undefined {
  return (SCHEME_DISPLAY as Readonly<Record<string, SchemeDisplay>>)[schemeId];
}
