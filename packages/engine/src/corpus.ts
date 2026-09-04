import {
  hasEducationAtLeast,
  isSpecialCategory,
  money,
  namedPredicate,
} from './predicates';
import type {
  Citation,
  ConflictPair,
  MatcherInput,
  PublishedSchemeRule,
  SchemeRecord,
} from './types';

const VERIFIED_ON = '2026-08-21';

function citation(
  id: string,
  title: string,
  issuingAuthority: string,
  url: string,
  documentDate?: string,
  locator?: string,
): Citation {
  return {
    id,
    title,
    issuingAuthority,
    url,
    verifiedOn: VERIFIED_ON,
    primary: true,
    ...(documentDate === undefined ? {} : { documentDate }),
    ...(locator === undefined ? {} : { locator }),
  };
}

const sources = {
  needs: citation(
    'tn-needs-portal',
    'New Entrepreneur-cum-Enterprise Development Scheme (NEEDS)',
    'Tamil Nadu Micro, Small and Medium Enterprises Department',
    'http://www.msmeonline.tn.gov.in/index_tamil.php',
    '2012-10-29',
    'NEEDS section; cites G.O. (Standing) No.49, MSME (D2)',
  ),
  uyegp: citation(
    'tn-uyegp-current',
    'UYEGP eligibility and assistance',
    'Tamil Nadu Micro, Small and Medium Enterprises Department',
    'https://msmeonline.tn.gov.in/uyegp/uyegp_desc.php',
    undefined,
    'Check your eligibility — UYEGP',
  ),
  pmegp: citation(
    'goi-pmegp-2023',
    'Revised PMEGP Guidelines',
    'Ministry of Micro, Small and Medium Enterprises, Government of India',
    'https://msme.gov.in/sites/default/files/Revisedguidelines07.12.2023.pdf',
    '2023-12-07',
    'Eligibility, project ceilings, beneficiary contribution and subsidy table',
  ),
  pmfme: citation(
    'mofpi-pmfme-guidelines',
    'PMFME Scheme Guidelines',
    'Ministry of Food Processing Industries, Government of India',
    'https://www.mofpi.gov.in/sites/default/files/pmfme_guidelines_english.pdf',
    '2020-06-29',
    'Section 4.1 and section 13.1',
  ),
  pmfmeExtension: citation(
    'mofpi-pmfme-extension-2026',
    'PMFME Connect, May 2026',
    'Ministry of Food Processing Industries, Government of India',
    'https://pmfme.mofpi.gov.in/pmfme/newsletters/PMFME_Connect_Monthly_Newsletter_May_2026.pdf',
    undefined,
    'Temporary extension through 30 September 2026',
  ),
  aif: citation(
    'goi-aif-2023',
    'Revised Scheme Guidelines for Agriculture Infrastructure Fund',
    'Department of Agriculture & Farmers Welfare, Government of India',
    'https://agriinfra.dac.gov.in/Content/DocAttachment/FINALSchemeGuidelinesAIF.pdf',
    undefined,
    'Interest subvention and eligible-project provisions',
  ),
  cgtmse: citation(
    'cgtmse-cgs1-2025',
    'Credit Guarantee Scheme-I, updated 1 April 2025',
    'Credit Guarantee Fund Trust for Micro and Small Enterprises',
    'https://cgtmse.in/Default/ViewFile/?id=1743176302611_CGTMSE+-+Scheme+Document+CGS+I_updated+as+on+Apr+1+2025.pdf&path=Page',
    '2025-04-01',
    'Eligible credit facilities and maximum coverage',
  ),
  cgtmseOld: citation(
    'cgtmse-circular-250',
    'Circular No.250/2024-25',
    'Credit Guarantee Fund Trust for Micro and Small Enterprises',
    'https://www.cgtmse.in/Default/ViewFile/?id=1742382157365_Circular+No.+2502024-25+5cr+to+10+cr.pdf&path=Circular',
    '2025-03-18',
    'Records the prior ₹5 crore ceiling and its increase to ₹10 crore',
  ),
  mudra: citation(
    'dfs-pmmy-current',
    'Pradhan Mantri MUDRA Yojana',
    'Department of Financial Services, Ministry of Finance',
    'https://financialservices.gov.in/pradhan-mantri-mudra-yojana-pmmy',
    '2024-10-24',
    'Current Shishu, Kishore, Tarun and Tarun Plus categories',
  ),
  tiic: citation(
    'tiic-general-current',
    'General Scheme for New and Existing Entrepreneurs',
    'Tamil Nadu Industrial Investment Corporation Limited',
    'https://www.tiic.org/general-scheme/',
    undefined,
    'Objective, eligible constitution and quantum of loan',
  ),
  zed: citation(
    'msme-zed-current',
    'Subsidy on Cost of ZED Certification',
    'Ministry of Micro, Small and Medium Enterprises, Government of India',
    'https://zed.msme.gov.in/subsidy-on-cost-of-certification',
    undefined,
    'Eligibility, certification subsidy and joining reward',
  ),
  aabcs: citation(
    'tn-aabcs-portal',
    'Annal Ambedkar Business Champions Scheme portal',
    'Tamil Nadu Micro, Small and Medium Enterprises Department',
    'http://www.msmeonline.tn.gov.in/aabcs/index.php',
    undefined,
    'Current scheme dashboard; detailed operative order still required',
  ),
  tnCapital: citation(
    'tn-capital-subsidy-portal',
    'Guidelines for Availing Capital Subsidy',
    'Tamil Nadu Micro, Small and Medium Enterprises Department',
    'https://msmeonline.tn.gov.in/incentives/html_cye_CS.php',
    undefined,
    'Benefit headline and eligible-enterprise section',
  ),
  ltpt: citation(
    'tn-ltpt-portal',
    'Guidelines for Availing Low Tension Power Tariff Subsidy',
    'Tamil Nadu Micro, Small and Medium Enterprises Department',
    'https://msmeonline.tn.gov.in/incentives/html_cye_ltpt.php',
    undefined,
    'Eligibility certificate and claims procedure',
  ),
  incentives: citation(
    'tn-incentives-portal',
    'Tamil Nadu MSME incentives portal',
    'Tamil Nadu Micro, Small and Medium Enterprises Department',
    'http://www.msmeonline.tn.gov.in/incentives/index.php',
    undefined,
    'Current incentive categories and processing dashboard',
  ),
  agriValue: citation(
    'tn-agri-budget-2025',
    'Tamil Nadu Agriculture Budget Speech 2025-26',
    'Government of Tamil Nadu',
    'https://tnhorticulture.tn.gov.in/tnhorticulture/site_assets/site-pdfs/budget_speech/TN-Agri-Budget-Speech-2025-26-ENGLISH-Full-Book.pdf',
    undefined,
    'Paragraph 47: special scheme for 100 value-addition units',
  ),
  tnapexRamp: citation(
    'tnapex-ramp-current',
    'RAMP — Sectoral Transformation: Food Processing Sector',
    'Tamil Nadu Food Processing and Agri Export Promotion Corporation',
    'https://www.tnapex.tn.gov.in/ords/r/wstnapex/tnapex173136/ramp',
    undefined,
    'Programme period and supported activities',
  ),
  cefppc: citation(
    'mofpi-cefppc-2025',
    'CEFPPC Scheme Guidelines',
    'Ministry of Food Processing Industries, Government of India',
    'https://www.mofpi.gov.in/en/announcements/scheme-guidelines-creation-expansion-food-processing-preservation-capacities-dated-0',
    '2025-01-22',
    'Guideline publication; applications are EOI-bound',
  ),
  mseCdp: citation(
    'msme-mse-cdp-current',
    'Micro and Small Enterprises Cluster Development Programme',
    'Ministry of Micro, Small and Medium Enterprises, Government of India',
    'https://msme.gov.in/schemes/infrastructure-development-program',
    undefined,
    'Common Facility Centre and infrastructure interventions',
  ),
  sfurti: citation(
    'msme-sfurti-2022',
    'Revised SFURTI Guidelines',
    'Ministry of Micro, Small and Medium Enterprises, Government of India',
    'https://sfurti.msme.gov.in/WriteReadData/Circular/SFURTI_NEW.pdf',
    '2022-09-09',
    'Current guidelines linked by official SFURTI portal',
  ),
  standup: citation(
    'dfs-standup-status',
    'Stand-Up India Scheme',
    'Department of Financial Services, Ministry of Finance',
    'https://financialservices.gov.in/stand-india-scheme-supi',
    undefined,
    'Official end date and announced successor',
  ),
  tniamp: citation(
    'tn-tniamp-agri-entrepreneur',
    'TNIAMP Agri Entrepreneurship Scheme',
    'Tamil Nadu Department of Agricultural Marketing and Agri Business',
    'https://www.agrimark.tn.gov.in/index.php/scheme/view/5',
    undefined,
    'Official implementation period and assistance',
  ),
  mofpiSchemes: citation(
    'mofpi-pmksy-overview',
    'PMKSY component schemes and assistance',
    'Ministry of Food Processing Industries, Government of India',
    'https://www.mofpi.gov.in/sites/default/files/mofpi_schemes.pdf',
    undefined,
    'Restructured PMKSY period and component overview',
  ),
  tiicRates: citation(
    'tiic-rates-2026',
    'Revision in Lending Rate with effect from 1 July 2026',
    'Tamil Nadu Industrial Investment Corporation Limited',
    'https://www.tiic.org/wp-content/uploads/Revision-in-lending-Rate-02072026.pdf',
    '2026-07-01',
    'Machinery Finance Scheme and current prime lending rate',
  ),
} as const;

const steps = {
  udyam: {
    id: 'udyam-registration',
    title: 'Complete Udyam registration where required',
    organisation: 'Ministry of MSME',
    citationIds: [] as const,
    requires: [] as const,
  },
};

function pmegpRate(input: MatcherInput): number {
  if (isSpecialCategory(input)) {
    return input.locationClass === 'rural' ? 0.35 : 0.25;
  }
  return input.locationClass === 'rural' ? 0.25 : 0.15;
}

function makePublishedRules(options: {
  readonly pmfmeDeadline: string;
  readonly cgtmseLimitLakhs: number;
  readonly mudraLimitLakhs: number;
}): readonly PublishedSchemeRule[] {
  const needs: PublishedSchemeRule = {
    status: 'published',
    id: 'needs',
    name: 'New Entrepreneur-cum-Enterprise Development Scheme',
    nameTa: 'புதிய தொழில்முனைவோர் மற்றும் தொழில் நிறுவன மேம்பாட்டுத் திட்டம்',
    level: 'state',
    department: 'Tamil Nadu MSME Department',
    citations: [sources.needs],
    conflictGroup: 'state-capital',
    deadline: null,
    eligibility: [
      namedPredicate(
        'first-generation',
        'First-generation entrepreneur',
        [sources.needs.id],
        (input) => input.firstGeneration,
      ),
      namedPredicate(
        'age',
        'Age 21–45, or up to 55 for a special category',
        [sources.needs.id],
        (input) => ({
          passed:
            input.age >= 21 &&
            input.age <= (isSpecialCategory(input) ? 55 : 45),
          actual: `Age ${input.age}`,
        }),
      ),
      namedPredicate(
        'activity',
        'Manufacturing or service enterprise',
        [sources.needs.id],
        (input) =>
          ['food-processing', 'manufacturing', 'services'].includes(
            input.sector,
          ),
      ),
      namedPredicate(
        'project-cost',
        'Project cost from ₹10 lakh through ₹5 crore',
        [sources.needs.id],
        (input) => ({
          passed: input.projectCostLakhs >= 10 && input.projectCostLakhs <= 500,
          actual: `₹${input.projectCostLakhs} lakh`,
        }),
      ),
    ],
    benefits: (input) => [
      {
        id: 'needs-capital-subsidy',
        kind: 'capital-subsidy',
        amountLakhs: money(Math.min(input.eligibleCapitalCostLakhs * 0.25, 75)),
        label: '25% of user-supplied eligible capital cost, capped at ₹75 lakh',
        citationIds: [sources.needs.id],
        calculation: 'exact-input-formula',
      },
    ],
    steps: [
      {
        id: 'needs-apply',
        title: 'Submit the NEEDS application and project report',
        organisation: 'District Industries Centre / MSME online portal',
        citationIds: [sources.needs.id],
        requires: [],
      },
      {
        id: 'needs-bank-sanction',
        title: 'Obtain a NEEDS-tagged bank sanction',
        organisation: 'Participating bank or TIIC',
        citationIds: [sources.needs.id],
        requires: ['needs-apply'],
      },
    ],
    caveats: [
      'The estimate uses eligible capital cost supplied by the user; the sanctioning authority determines final eligibility and eligible cost.',
    ],
  };

  const uyegp: PublishedSchemeRule = {
    status: 'published',
    id: 'uyegp',
    name: 'Unemployed Youth Employment Generation Programme',
    nameTa: 'வேலையில்லா இளைஞர்களுக்கான வேலைவாய்ப்பு உருவாக்கும் திட்டம்',
    level: 'state',
    department: 'Tamil Nadu MSME Department',
    citations: [sources.uyegp],
    conflictGroup: 'state-capital',
    deadline: null,
    eligibility: [
      namedPredicate(
        'activity',
        'Trading or business project',
        [sources.uyegp.id],
        (input) => input.sector === 'trading',
      ),
      namedPredicate(
        'project-cost',
        'Project cost no more than ₹15 lakh',
        [sources.uyegp.id],
        (input) => input.projectCostLakhs <= 15,
      ),
      namedPredicate(
        'education',
        'At least eighth standard',
        [sources.uyegp.id],
        (input) => hasEducationAtLeast(input, 'eighth'),
      ),
      namedPredicate(
        'family-income',
        'Annual family income below ₹8 lakh',
        [sources.uyegp.id],
        (input) => input.annualFamilyIncomeLakhs < 8,
      ),
      namedPredicate(
        'age',
        'Age 18–45, or up to 55 for a special category',
        [sources.uyegp.id],
        (input) => input.age <= (isSpecialCategory(input) ? 55 : 45),
      ),
    ],
    benefits: (input) => [
      {
        id: 'uyegp-margin-money',
        kind: 'margin-money-subsidy',
        amountLakhs: money(Math.min(input.projectCostLakhs * 0.25, 3.75)),
        label: '25% of project cost, capped at ₹3.75 lakh',
        citationIds: [sources.uyegp.id],
        calculation: 'exact-input-formula',
      },
    ],
    steps: [
      {
        id: 'uyegp-apply',
        title: 'Submit the UYEGP application',
        organisation: 'District Industries Centre / MSME online portal',
        citationIds: [sources.uyegp.id],
        requires: [],
      },
      {
        id: 'uyegp-bank',
        title: 'Complete task-force and bank appraisal',
        organisation: 'District Industries Centre and participating bank',
        citationIds: [sources.uyegp.id],
        requires: ['uyegp-apply'],
      },
    ],
    caveats: [
      'The official portal currently describes UYEGP as limited to trading/business projects.',
    ],
  };

  const pmegp: PublishedSchemeRule = {
    status: 'published',
    id: 'pmegp',
    name: "Prime Minister's Employment Generation Programme",
    nameTa: 'பிரதமரின் வேலைவாய்ப்பு உருவாக்கும் திட்டம்',
    level: 'central',
    department: 'Ministry of MSME / KVIC',
    citations: [sources.pmegp],
    conflictGroup: 'central-capital',
    deadline: null,
    eligibility: [
      namedPredicate(
        'new-unit',
        'New enterprise',
        [sources.pmegp.id],
        (input) => input.enterpriseStage === 'new',
      ),
      namedPredicate(
        'no-prior-subsidy',
        'Has not already availed another government capital subsidy',
        [sources.pmegp.id],
        (input) => !input.priorGovernmentCapitalSubsidy,
      ),
      namedPredicate(
        'project-cost',
        'Within the ₹50 lakh manufacturing or ₹20 lakh service/business ceiling',
        [sources.pmegp.id],
        (input) => {
          const manufacturing = [
            'food-processing',
            'manufacturing',
            'traditional-industry',
          ].includes(input.sector);
          return input.projectCostLakhs <= (manufacturing ? 50 : 20);
        },
      ),
      namedPredicate(
        'education',
        'Eighth standard for larger projects; otherwise no minimum',
        [sources.pmegp.id],
        (input) => {
          const manufacturing = [
            'food-processing',
            'manufacturing',
            'traditional-industry',
          ].includes(input.sector);
          const threshold = manufacturing ? 10 : 5;
          return (
            input.projectCostLakhs <= threshold ||
            hasEducationAtLeast(input, 'eighth')
          );
        },
      ),
    ],
    benefits: (input) => {
      const rate = pmegpRate(input);
      return [
        {
          id: 'pmegp-margin-money',
          kind: 'margin-money-subsidy',
          amountLakhs: money(input.projectCostLakhs * rate),
          label: `${rate * 100}% margin-money subsidy for the supplied category and location`,
          citationIds: [sources.pmegp.id],
          calculation: 'exact-input-formula',
        },
      ];
    },
    steps: [
      {
        id: 'pmegp-apply',
        title: 'Submit a new-unit application on the PMEGP portal',
        organisation: 'KVIC / KVIB / District Industries Centre',
        citationIds: [sources.pmegp.id],
        requires: [],
      },
      {
        id: 'pmegp-bank',
        title: 'Complete bank appraisal and sanction',
        organisation: 'Participating bank',
        citationIds: [sources.pmegp.id],
        requires: ['pmegp-apply'],
      },
    ],
    caveats: [
      'Trading eligibility is restricted by the detailed guidelines; this matcher does not replace the activity-level negative list.',
    ],
  };

  const pmfme: PublishedSchemeRule = {
    status: 'published',
    id: 'pmfme',
    name: 'PM Formalisation of Micro Food Processing Enterprises',
    nameTa:
      'நுண் உணவு பதப்படுத்தும் நிறுவனங்களை முறைப்படுத்தும் பிரதமர் திட்டம்',
    level: 'central',
    department: 'Ministry of Food Processing Industries',
    citations: [sources.pmfme, sources.pmfmeExtension],
    conflictGroup: 'central-capital',
    deadline: options.pmfmeDeadline,
    eligibility: [
      namedPredicate(
        'food',
        'Food-processing activity',
        [sources.pmfme.id],
        (input) => input.sector === 'food-processing',
      ),
      namedPredicate(
        'micro',
        'Micro enterprise',
        [sources.pmfme.id],
        (input) => input.enterpriseSize === 'micro',
      ),
      namedPredicate(
        'existing',
        'Existing micro food-processing unit',
        [sources.pmfme.id],
        (input) => input.enterpriseStage === 'existing',
      ),
    ],
    benefits: (input) => [
      {
        id: 'pmfme-credit-linked-subsidy',
        kind: 'capital-subsidy',
        amountLakhs: money(Math.min(input.eligibleCapitalCostLakhs * 0.35, 10)),
        label: '35% of user-supplied eligible project cost, capped at ₹10 lakh',
        citationIds: [sources.pmfme.id],
        calculation: 'exact-input-formula',
      },
    ],
    steps: [
      {
        id: 'pmfme-apply',
        title: 'Prepare the DPR and submit the PMFME application',
        organisation: 'State nodal agency / PMFME portal',
        citationIds: [sources.pmfme.id],
        requires: [],
      },
      {
        id: 'pmfme-bank',
        title: 'Obtain credit sanction for the eligible project',
        organisation: 'Participating bank',
        citationIds: [sources.pmfme.id],
        requires: ['pmfme-apply'],
      },
    ],
    caveats: [
      'The extension through 30 September 2026 is temporary and must be re-verified before relying on this rule after that date.',
    ],
  };

  const aif: PublishedSchemeRule = {
    status: 'published',
    id: 'aif',
    name: 'Agriculture Infrastructure Fund',
    nameTa: 'வேளாண் உள்கட்டமைப்பு நிதி',
    level: 'central',
    department: 'Department of Agriculture & Farmers Welfare',
    citations: [sources.aif],
    deadline: null,
    eligibility: [
      namedPredicate(
        'activity',
        'Eligible agriculture infrastructure activity',
        [sources.aif.id],
        (input) =>
          ['agri-infrastructure', 'food-processing'].includes(input.sector),
      ),
      namedPredicate(
        'loan',
        'Positive loan requirement',
        [sources.aif.id],
        (input) => input.requestedLoanLakhs > 0,
      ),
    ],
    benefits: () => [
      {
        id: 'aif-interest-subvention',
        kind: 'interest-subvention',
        amountLakhs: null,
        label:
          '3% p.a. interest subvention on outstanding eligible credit up to ₹2 crore, for at most seven years',
        citationIds: [sources.aif.id],
        calculation: 'official-limit-only',
      },
    ],
    steps: [
      {
        id: 'aif-bank-sanction',
        title:
          'Obtain lender appraisal for the eligible infrastructure project',
        organisation: 'Participating lending institution',
        citationIds: [sources.aif.id],
        requires: [],
      },
      {
        id: 'aif-tag',
        title: 'Register and tag the sanctioned loan under AIF',
        organisation: 'AIF portal and participating lender',
        citationIds: [sources.aif.id],
        requires: ['aif-bank-sanction'],
      },
    ],
    caveats: [
      'No rupee estimate is calculated because subvention depends on the actual outstanding-loan schedule.',
    ],
  };

  const cgtmse: PublishedSchemeRule = {
    status: 'published',
    id: 'cgtmse',
    name: 'Credit Guarantee Scheme for Micro and Small Enterprises',
    nameTa: 'குறு மற்றும் சிறு நிறுவனங்களுக்கான கடன் உத்தரவாதத் திட்டம்',
    level: 'central',
    department: 'CGTMSE / Ministry of MSME / SIDBI',
    citations:
      options.cgtmseLimitLakhs === 1_000
        ? [sources.cgtmse]
        : [sources.cgtmseOld],
    deadline: null,
    eligibility: [
      namedPredicate(
        'mse',
        'Micro or small enterprise',
        [
          options.cgtmseLimitLakhs === 1_000
            ? sources.cgtmse.id
            : sources.cgtmseOld.id,
        ],
        (input) => ['micro', 'small'].includes(input.enterpriseSize),
      ),
      namedPredicate(
        'credit-limit',
        `Requested credit no more than ₹${options.cgtmseLimitLakhs / 100} crore`,
        [
          options.cgtmseLimitLakhs === 1_000
            ? sources.cgtmse.id
            : sources.cgtmseOld.id,
        ],
        (input) => input.requestedLoanLakhs <= options.cgtmseLimitLakhs,
      ),
    ],
    benefits: () => [
      {
        id: 'cgtmse-guarantee-access',
        kind: 'credit-access',
        amountLakhs: null,
        label: `Eligible collateral-free credit can be covered up to ₹${options.cgtmseLimitLakhs / 100} crore, subject to lender and scheme terms`,
        citationIds: [
          options.cgtmseLimitLakhs === 1_000
            ? sources.cgtmse.id
            : sources.cgtmseOld.id,
        ],
        calculation: 'non-monetary',
      },
    ],
    steps: [
      steps.udyam,
      {
        id: 'cgtmse-request',
        title: 'Ask the member lender to seek CGTMSE cover',
        organisation: 'CGTMSE member lending institution',
        citationIds: [
          options.cgtmseLimitLakhs === 1_000
            ? sources.cgtmse.id
            : sources.cgtmseOld.id,
        ],
        requires: ['udyam-registration'],
      },
    ],
    caveats: [
      'CGTMSE is a lender-claimed guarantee, not a cash grant to the borrower.',
    ],
  };

  const mudra: PublishedSchemeRule = {
    status: 'published',
    id: 'mudra',
    name: 'Pradhan Mantri MUDRA Yojana',
    nameTa: 'பிரதம மந்திரி முத்ரா யோஜனா',
    level: 'central',
    department: 'Department of Financial Services',
    citations: [sources.mudra],
    deadline: null,
    eligibility: [
      namedPredicate(
        'micro',
        'Micro enterprise',
        [sources.mudra.id],
        (input) => input.enterpriseSize === 'micro',
      ),
      namedPredicate(
        'loan-limit',
        `Requested credit no more than ₹${options.mudraLimitLakhs} lakh`,
        [sources.mudra.id],
        (input) => input.requestedLoanLakhs <= options.mudraLimitLakhs,
      ),
      namedPredicate(
        'tarun-plus-history',
        'Loans above ₹10 lakh require a successfully repaid Tarun loan',
        [sources.mudra.id],
        (input) => input.requestedLoanLakhs <= 10 || input.repaidMudraTarun,
      ),
    ],
    benefits: () => [
      {
        id: 'mudra-credit-access',
        kind: 'credit-access',
        amountLakhs: null,
        label: `Collateral-free institutional credit within the applicable MUDRA tier, up to ₹${options.mudraLimitLakhs} lakh`,
        citationIds: [sources.mudra.id],
        calculation: 'non-monetary',
      },
    ],
    steps: [
      {
        id: 'mudra-apply',
        title: 'Apply through a MUDRA member lending institution',
        organisation: 'Bank, NBFC or MFI',
        citationIds: [sources.mudra.id],
        requires: [],
      },
    ],
    caveats: [
      'Credit access is subject to lender appraisal; it is not a subsidy.',
    ],
  };

  const tiic: PublishedSchemeRule = {
    status: 'published',
    id: 'tiic-general',
    name: 'TIIC General Term Loan Scheme',
    nameTa: 'டிஐஐசி பொதுக் காலக்கடன் திட்டம்',
    level: 'state',
    department: 'Tamil Nadu Industrial Investment Corporation Limited',
    citations: [sources.tiic],
    deadline: null,
    eligibility: [
      namedPredicate(
        'activity',
        'Manufacturing, processing or service activity',
        [sources.tiic.id],
        (input) =>
          ['food-processing', 'manufacturing', 'services'].includes(
            input.sector,
          ),
      ),
      namedPredicate(
        'constitution',
        'Eligible legal constitution',
        [sources.tiic.id],
        (input) =>
          ['proprietorship', 'partnership', 'company'].includes(
            input.entityKind,
          ),
      ),
      namedPredicate(
        'loan-quantum',
        'Within the published constitution ceiling',
        [sources.tiic.id],
        (input) => {
          const limits = {
            proprietorship: 3_100,
            partnership: 3_900,
            company: 5_900,
          } as const;
          const limit =
            input.entityKind in limits
              ? limits[input.entityKind as keyof typeof limits]
              : 0;
          return input.requestedLoanLakhs <= limit;
        },
      ),
    ],
    benefits: () => [
      {
        id: 'tiic-term-loan-access',
        kind: 'credit-access',
        amountLakhs: null,
        label: 'Term-loan access subject to TIIC appraisal and security norms',
        citationIds: [sources.tiic.id],
        calculation: 'non-monetary',
      },
    ],
    steps: [
      {
        id: 'tiic-apply',
        title: 'Submit the TIIC term-loan application and project report',
        organisation: 'TIIC branch',
        citationIds: [sources.tiic.id],
        requires: [],
      },
    ],
    caveats: [
      'The engine does not estimate interest or sanction quantum; both depend on TIIC appraisal and the live rate schedule.',
    ],
  };

  const zed: PublishedSchemeRule = {
    status: 'published',
    id: 'zed-certification',
    name: 'MSME Sustainable (ZED) Certification',
    nameTa: 'எம்எஸ்எம்இ நிலைத்தன்மை (ZED) சான்றிதழ்',
    level: 'central',
    department: 'Ministry of MSME',
    citations: [sources.zed],
    deadline: null,
    eligibility: [
      namedPredicate(
        'udyam',
        'Udyam-registered MSME',
        [sources.zed.id],
        (input) => input.udyamRegistered && input.enterpriseSize !== 'not-msme',
      ),
    ],
    benefits: () => [
      {
        id: 'zed-certification-support',
        kind: 'certification-support',
        amountLakhs: null,
        label:
          'Certification-cost subsidy varies by enterprise size; the ₹10,000 joining reward is a limited-purpose credit, not cash',
        citationIds: [sources.zed.id],
        calculation: 'official-limit-only',
      },
    ],
    steps: [
      steps.udyam,
      {
        id: 'zed-pledge',
        title: 'Take the ZED pledge and select a certification level',
        organisation: 'MSME Sustainable ZED portal',
        citationIds: [sources.zed.id],
        requires: ['udyam-registration'],
      },
    ],
    caveats: [
      'No cash-equivalent amount is added to the stack total because support offsets specified certification costs.',
    ],
  };

  return [needs, uyegp, pmegp, pmfme, aif, cgtmse, mudra, tiic, zed];
}

function makeNonCalculatingRecords(): readonly SchemeRecord[] {
  return [
    {
      status: 'pending-review',
      id: 'aabcs',
      name: 'Annal Ambedkar Business Champions Scheme',
      nameTa: 'அண்ணல் அம்பேத்கர் தொழில் முன்னோடிகள் திட்டம்',
      level: 'state',
      department: 'Tamil Nadu MSME Department',
      citations: [sources.aabcs],
      deadline: null,
      reviewReason:
        'The live official dashboard confirms operation, but the operative G.O. and complete eligibility/base-cost text have not been captured from a primary document.',
    },
    {
      status: 'pending-review',
      id: 'tn-capital-subsidy',
      name: 'Tamil Nadu MSME Capital Subsidy',
      nameTa: 'தமிழ்நாடு எம்எஸ்எம்இ மூலதன மானியம்',
      level: 'state',
      department: 'Tamil Nadu MSME Department',
      citations: [sources.tnCapital],
      deadline: null,
      reviewReason:
        'The current portal states the headline rate, but location/activity exclusions and the governing G.O. must be pinned before automatic eligibility is safe.',
    },
    {
      status: 'pending-review',
      id: 'tn-ltpt-subsidy',
      name: 'Low Tension Power Tariff Subsidy',
      nameTa: 'குறைந்த மின்னழுத்த மின் கட்டண மானியம்',
      level: 'state',
      department: 'Tamil Nadu MSME Department',
      citations: [sources.ltpt],
      deadline: null,
      reviewReason:
        'A calculation needs tariff class, connection date, production date and actual bills, none of which are accepted by the current closed matcher input.',
    },
    {
      status: 'pending-review',
      id: 'tn-stamp-duty-reimbursement',
      name: 'Tamil Nadu MSME Stamp Duty and Registration Charges',
      nameTa: 'முத்திரைத் தீர்வை மற்றும் பதிவுக் கட்டணச் சலுகை',
      level: 'state',
      department: 'Tamil Nadu MSME Department',
      citations: [sources.incentives],
      deadline: null,
      reviewReason:
        'The official portal confirms a live application category but does not expose a complete current rate and eligibility rule on the indexed primary page.',
    },
    {
      status: 'pending-review',
      id: 'tn-peace',
      name: 'Promotion of Energy Audit and Conservation of Energy',
      nameTa: 'ஆற்றல் தணிக்கை மற்றும் ஆற்றல் சேமிப்பு ஊக்கத் திட்டம்',
      level: 'state',
      department: 'Tamil Nadu MSME Department',
      citations: [sources.incentives],
      deadline: null,
      reviewReason:
        'The incentive portal is live, but current operative reimbursement limits require primary-document verification.',
    },
    {
      status: 'pending-review',
      id: 'tn-agri-value-addition-100',
      name: 'Special Scheme for 100 Agricultural Value-Addition Units',
      nameTa: '100 வேளாண் மதிப்புக்கூட்டல் அலகுகளுக்கான சிறப்புத் திட்டம்',
      level: 'state',
      department: 'Tamil Nadu Agriculture Department',
      citations: [sources.agriValue],
      deadline: '2026-03-31',
      reviewReason:
        'The budget announcement is verified, but the 2025-26 window has ended and no current extension or operative application guideline was located.',
    },
    {
      status: 'pending-review',
      id: 'tnapex-ramp-food',
      name: 'TNAPEx RAMP Food-Processing Sector Transformation',
      nameTa: 'டிஎன்ஏபெக்ஸ் RAMP உணவு பதப்படுத்தல் மாற்றுத் திட்டம்',
      level: 'state',
      department: 'TNAPEx',
      citations: [sources.tnapexRamp],
      deadline: '2027-03-31',
      reviewReason:
        'The programme and activities are official, but beneficiary-level calls, selection rules and calculable assistance are not published as a stable rule.',
    },
    {
      status: 'pending-review',
      id: 'mofpi-cefppc',
      name: 'Creation/Expansion of Food Processing and Preservation Capacities',
      nameTa:
        'உணவு பதப்படுத்தல் மற்றும் பாதுகாப்புத் திறன் உருவாக்கம்/விரிவாக்கம்',
      level: 'central',
      department: 'Ministry of Food Processing Industries',
      citations: [sources.cefppc],
      deadline: null,
      reviewReason:
        'Assistance is Expression-of-Interest bound; no currently open EOI was verified, so a headline grant is not exposed as available.',
    },
    {
      status: 'pending-review',
      id: 'mse-cdp',
      name: 'Micro and Small Enterprises Cluster Development Programme',
      nameTa: 'குறு மற்றும் சிறு நிறுவனங்கள் குழும மேம்பாட்டுத் திட்டம்',
      level: 'central',
      department: 'Ministry of MSME',
      citations: [sources.mseCdp],
      deadline: null,
      reviewReason:
        'This is a cluster/implementing-agency intervention and cannot be matched safely from an individual enterprise profile.',
    },
    {
      status: 'pending-review',
      id: 'sfurti',
      name: 'Scheme of Fund for Regeneration of Traditional Industries',
      nameTa: 'பாரம்பரிய தொழில்கள் புத்துயிர்ப்புத் திட்டம்',
      level: 'central',
      department: 'Ministry of MSME',
      citations: [sources.sfurti],
      deadline: null,
      reviewReason:
        'SFURTI is cluster and implementing-agency based; individual-unit matching would misrepresent access.',
    },
    {
      status: 'retired',
      id: 'stand-up-india',
      name: 'Stand-Up India',
      nameTa: 'ஸ்டாண்ட்-அப் இந்தியா',
      level: 'central',
      department: 'Department of Financial Services',
      citations: [sources.standup],
      deadline: '2025-03-31',
      reviewReason:
        'The Department of Financial Services states that the scheme ran through 31 March 2025; the announced successor is not treated as launched without operative guidelines.',
    },
    {
      status: 'retired',
      id: 'tniamp-agri-entrepreneur',
      name: 'TNIAMP Agri Entrepreneurship Scheme',
      nameTa: 'TNIAMP வேளாண் தொழில்முனைவோர் திட்டம்',
      level: 'state',
      department: 'Tamil Nadu Agricultural Marketing and Agri Business',
      citations: [sources.tniamp],
      deadline: '2023-03-31',
      reviewReason:
        'The official page gives an implementation period ending in 2022-23 and no current extension was verified.',
    },
    {
      status: 'pending-review',
      id: 'pmksy-integrated-cold-chain',
      name: 'PMKSY Integrated Cold Chain and Value Addition Infrastructure',
      nameTa:
        'ஒருங்கிணைந்த குளிர்சங்கிலி மற்றும் மதிப்புக்கூட்டல் உள்கட்டமைப்பு',
      level: 'central',
      department: 'Ministry of Food Processing Industries',
      citations: [sources.mofpiSchemes],
      deadline: '2026-03-31',
      reviewReason:
        'The cited PMKSY cycle ended on 31 March 2026; a new operative cycle and open EOI must be verified.',
    },
    {
      status: 'pending-review',
      id: 'pmksy-operation-greens',
      name: 'PMKSY Operation Greens',
      nameTa: 'PMKSY ஆபரேஷன் கிரீன்ஸ்',
      level: 'central',
      department: 'Ministry of Food Processing Industries',
      citations: [sources.mofpiSchemes],
      deadline: '2026-03-31',
      reviewReason:
        'The cited PMKSY cycle ended on 31 March 2026; commodity coverage and a current application window require verification.',
    },
    {
      status: 'pending-review',
      id: 'tiic-machinery-finance',
      name: 'TIIC Machinery Finance Scheme',
      nameTa: 'டிஐஐசி இயந்திர நிதித் திட்டம்',
      level: 'state',
      department: 'Tamil Nadu Industrial Investment Corporation Limited',
      citations: [sources.tiicRates],
      deadline: null,
      reviewReason:
        'The current rate circular confirms the product, but complete product eligibility and security terms have not been pinned into a versioned primary source.',
    },
  ];
}

export function createSchemeCorpus(options: {
  readonly pmfmeDeadline: string;
  readonly cgtmseLimitLakhs: number;
  readonly mudraLimitLakhs: number;
}): readonly SchemeRecord[] {
  return [...makePublishedRules(options), ...makeNonCalculatingRecords()];
}

export const conflictPairs: readonly ConflictPair[] = [
  {
    schemeA: 'needs',
    schemeB: 'pmegp',
    kind: 'exclusive',
    rationale:
      'Both pay a capital / margin-money subsidy on the same new project. No cited rule lets NILAM add them. Keep the larger calculated amount and confirm the chosen route in writing before applying.',
    confirmedAt: 'inferred',
    citationIds: [sources.needs.id, sources.pmegp.id],
    verifiedOn: VERIFIED_ON,
  },
  {
    schemeA: 'pmegp',
    schemeB: 'pmfme',
    kind: 'caution',
    rationale:
      'Both are credit-linked central assistance. PMEGP excludes units that already availed another government subsidy; obtain written confirmation before treating the two as stackable.',
    confirmedAt: 'inferred',
    citationIds: [sources.pmegp.id, sources.pmfme.id],
    verifiedOn: VERIFIED_ON,
  },
  {
    schemeA: 'aif',
    schemeB: 'cgtmse',
    kind: 'compatible',
    rationale:
      'AIF guidelines expressly provide CGTMSE cover for eligible loans up to the stated AIF limit, with the coverage fee paid by Government.',
    confirmedAt: 'official-guideline',
    citationIds: [sources.aif.id],
    verifiedOn: VERIFIED_ON,
  },
];

export const CORPUS_VERIFIED_ON = VERIFIED_ON;
