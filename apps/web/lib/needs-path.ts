/**
 * NEEDS guided path: the data and arithmetic behind `/needs`.
 *
 * The subsidy figure deliberately matches the published engine rule
 * (25% of eligible capital cost, capped at ₹75 lakh). Business presets are
 * NILAM planning ranges for a first conversation with the District Industries
 * Centre, not quotations and not a statement that DIC will approve an activity.
 */

export const NEEDS_VERIFIED_ON = '2026-11-21';

export const NEEDS_SOURCES = {
  scheme: {
    title: 'About NEEDS, MSME Online portal, Government of Tamil Nadu',
    url: 'https://msmeonline.tn.gov.in/needs/needs_desc.php',
  },
  dic: {
    title: 'NEEDS scheme page, Industries Commissionerate & DIC',
    url: 'https://icdic.tn.gov.in/schemes/needs',
  },
  portal: {
    title: 'MSME Online portal, Government of Tamil Nadu',
    url: 'https://msmeonline.tn.gov.in/',
  },
  tiic: {
    title: 'TIIC — NEEDS scheme (older figures)',
    url: 'https://www.tiic.org/tn/need-scheme/',
  },
} as const;

/**
 * Scheme limits as published on the MSME Online "About NEEDS" page
 * (checked {@link NEEDS_VERIFIED_ON}): project cost ₹10 lakh to ₹5 crore,
 * 25% capital subsidy capped at ₹75 lakh, 3% interest subvention for the
 * whole repayment period, promoter share 10% general / 5% special.
 * TIIC's page still shows the older ₹30 lakh cap and 21–35 general age limit.
 */
export const NEEDS_LIMITS = {
  minProjectLakhs: 10,
  maxProjectLakhs: 500,
  subsidyRate: 0.25,
  subsidyCapLakhs: 75,
  interestSubventionRate: 0.03,
  /** Building may not exceed 25% of project cost (TIIC guideline). */
  maxBuildingShare: 0.25,
  contributionRate: { general: 0.1, special: 0.05 },
  age: { min: 21, general: 45, special: 55 },
} as const;

/** Capital cost at which the 25% subsidy reaches its ₹75 lakh cap (₹3 crore). */
export const SUBSIDY_CAP_REACHED_AT_LAKHS =
  NEEDS_LIMITS.subsidyCapLakhs / NEEDS_LIMITS.subsidyRate;

const SLIDER_STEPS = 1000;
const LOG_MIN = Math.log(NEEDS_LIMITS.minProjectLakhs);
const LOG_SPAN = Math.log(NEEDS_LIMITS.maxProjectLakhs) - LOG_MIN;

/** Slider resolution for the project-cost control (0..SLIDER_STEPS). */
export const PROJECT_SLIDER_STEPS = SLIDER_STEPS;

/**
 * Position (0..1000) of a project cost on the log-scaled slider, so the
 * ₹10–50 lakh band most first units fall in gets as much travel as
 * ₹1–5 crore.
 */
export function projectSliderPosition(lakhs: number): number {
  const clamped = clampProjectLakhs(lakhs);
  return Math.round(((Math.log(clamped) - LOG_MIN) / LOG_SPAN) * SLIDER_STEPS);
}

/** Project cost for a slider position, snapped to ₹1 / ₹5 / ₹10 lakh steps. */
export function projectFromSliderPosition(position: number): number {
  const ratio = Math.min(1, Math.max(0, position / SLIDER_STEPS));
  const raw = Math.exp(LOG_MIN + ratio * LOG_SPAN);
  const step = raw < 50 ? 1 : raw < 200 ? 5 : 10;
  return clampProjectLakhs(Math.round(raw / step) * step);
}

export type FounderCategory = 'general' | 'special';

export type CostSplit = {
  readonly landAndBuilding: number;
  readonly plantAndMachinery: number;
  readonly otherFixed: number;
  readonly workingCapital: number;
};

export type BusinessGroup =
  'food' | 'agri' | 'textiles' | 'manufacturing' | 'services';

export type NeedsBusiness = {
  readonly id: string;
  readonly name: string;
  readonly nameTa: string;
  readonly group: BusinessGroup;
  readonly makes: string;
  readonly minLakhs: number;
  readonly maxLakhs: number;
  readonly typicalLakhs: number;
  readonly split: CostSplit;
  readonly space: string;
  readonly jobs: number;
  readonly licences: readonly string[];
};

export const BUSINESS_GROUPS: readonly (readonly [BusinessGroup, string])[] = [
  ['food', 'Food processing'],
  ['agri', 'Agri value-add'],
  ['textiles', 'Textiles'],
  ['manufacturing', 'Manufacturing'],
  ['services', 'Industrial services'],
];

const split = (
  landAndBuilding: number,
  plantAndMachinery: number,
  otherFixed: number,
  workingCapital: number,
): CostSplit => ({
  landAndBuilding,
  plantAndMachinery,
  otherFixed,
  workingCapital,
});

export const DEFAULT_NEEDS_BUSINESS: NeedsBusiness = {
  id: 'cold-pressed-oil',
  name: 'Cold-pressed oil mill',
  nameTa: 'மரச்செக்கு எண்ணெய் ஆலை',
  group: 'food',
  makes: 'Groundnut, sesame and coconut oil in retail packs',
  minLakhs: 15,
  maxLakhs: 60,
  typicalLakhs: 30,
  split: split(0.3, 0.45, 0.05, 0.2),
  space: '1,500–3,000 sq ft shed',
  jobs: 6,
  licences: ['FSSAI licence', 'Legal Metrology packer registration'],
};

export const NEEDS_BUSINESSES: readonly NeedsBusiness[] = [
  DEFAULT_NEEDS_BUSINESS,
  {
    id: 'millet-flour',
    name: 'Millet & flour mix unit',
    nameTa: 'சிறுதானிய மாவு அலகு',
    group: 'food',
    makes: 'Millet flour, dosa/idli and health mixes',
    minLakhs: 15,
    maxLakhs: 80,
    typicalLakhs: 35,
    split: split(0.3, 0.45, 0.05, 0.2),
    space: '2,000–4,000 sq ft shed',
    jobs: 8,
    licences: ['FSSAI licence', 'Legal Metrology packer registration'],
  },
  {
    id: 'pulses-grading',
    name: 'Pulses & grain cleaning and grading',
    nameTa: 'பருப்பு தானியம் தரம் பிரிப்பு',
    group: 'agri',
    makes: 'Cleaned, sorted and graded dal, groundnut and grain',
    minLakhs: 30,
    maxLakhs: 150,
    typicalLakhs: 60,
    split: split(0.35, 0.4, 0.05, 0.2),
    space: '10–25 cents plot with godown',
    jobs: 12,
    licences: [
      'FSSAI licence',
      'APMC / market committee licence if trading produce',
    ],
  },
  {
    id: 'spice-grinding',
    name: 'Spice grinding & packing',
    nameTa: 'மசாலா அரைத்தல் மற்றும் பேக்கிங்',
    group: 'food',
    makes: 'Chilli, turmeric, coriander and blended masala',
    minLakhs: 15,
    maxLakhs: 60,
    typicalLakhs: 25,
    split: split(0.3, 0.45, 0.05, 0.2),
    space: '1,500–3,000 sq ft shed',
    jobs: 7,
    licences: ['FSSAI licence', 'Legal Metrology packer registration'],
  },
  {
    id: 'bakery-snacks',
    name: 'Bakery & snacks unit',
    nameTa: 'பேக்கரி மற்றும் தின்பண்டம் அலகு',
    group: 'food',
    makes: 'Rusk, cookies and packed savouries for retail',
    minLakhs: 20,
    maxLakhs: 100,
    typicalLakhs: 40,
    split: split(0.3, 0.45, 0.05, 0.2),
    space: '2,000–4,000 sq ft shed',
    jobs: 10,
    licences: ['FSSAI licence', 'TNPCB consent (check category)'],
  },
  {
    id: 'dairy-products',
    name: 'Dairy products unit',
    nameTa: 'பால் பொருட்கள் அலகு',
    group: 'food',
    makes: 'Curd, paneer, ghee and flavoured milk',
    minLakhs: 40,
    maxLakhs: 200,
    typicalLakhs: 80,
    split: split(0.3, 0.5, 0.05, 0.15),
    space: '10–20 cents plot',
    jobs: 12,
    licences: ['FSSAI licence', 'TNPCB consent to establish/operate'],
  },
  {
    id: 'cattle-feed',
    name: 'Cattle & poultry feed mill',
    nameTa: 'கால்நடை தீவன ஆலை',
    group: 'agri',
    makes: 'Mash and pellet feed for dairy and poultry farms',
    minLakhs: 50,
    maxLakhs: 250,
    typicalLakhs: 100,
    split: split(0.35, 0.45, 0.05, 0.15),
    space: '25–50 cents plot',
    jobs: 15,
    licences: ['BIS / feed quality standard (check)', 'TNPCB consent'],
  },
  {
    id: 'coir-products',
    name: 'Coir fibre & products',
    nameTa: 'தென்னை நார் பொருட்கள்',
    group: 'agri',
    makes: 'Coir fibre, pith blocks and grow-bags',
    minLakhs: 25,
    maxLakhs: 120,
    typicalLakhs: 50,
    split: split(0.35, 0.4, 0.05, 0.2),
    space: '50 cents–1 acre yard',
    jobs: 20,
    licences: ['TNPCB consent', 'Coir Board registration (optional)'],
  },
  {
    id: 'garments',
    name: 'Readymade garment unit',
    nameTa: 'ஆயத்த ஆடை அலகு',
    group: 'textiles',
    makes: 'Innerwear, kidswear or uniforms on job-work and own brand',
    minLakhs: 15,
    maxLakhs: 100,
    typicalLakhs: 30,
    split: split(0.25, 0.5, 0.05, 0.2),
    space: '2,000–5,000 sq ft shed',
    jobs: 25,
    licences: ['Factory licence above worker threshold', 'GST'],
  },
  {
    id: 'paper-plates',
    name: 'Areca & paper plate unit',
    nameTa: 'பாக்கு மட்டை / காகித தட்டு அலகு',
    group: 'manufacturing',
    makes: 'Areca leaf plates, paper plates and cups',
    minLakhs: 12,
    maxLakhs: 50,
    typicalLakhs: 20,
    split: split(0.3, 0.45, 0.05, 0.2),
    space: '1,500–3,000 sq ft shed',
    jobs: 8,
    licences: ['TNPCB consent (check category)', 'GST'],
  },
  {
    id: 'flyash-bricks',
    name: 'Fly-ash bricks & paver blocks',
    nameTa: 'சாம்பல் செங்கல் மற்றும் பேவர் பிளாக்',
    group: 'manufacturing',
    makes: 'Fly-ash bricks, solid blocks and interlocking pavers',
    minLakhs: 20,
    maxLakhs: 80,
    typicalLakhs: 35,
    split: split(0.3, 0.45, 0.05, 0.2),
    space: '50 cents–1 acre yard',
    jobs: 15,
    licences: ['TNPCB consent', 'BIS IS 12894 testing'],
  },
  {
    id: 'corrugated-boxes',
    name: 'Corrugated box & packaging',
    nameTa: 'அட்டைப் பெட்டி பேக்கேஜிங்',
    group: 'manufacturing',
    makes: 'Printed corrugated boxes for food and FMCG units',
    minLakhs: 50,
    maxLakhs: 250,
    typicalLakhs: 90,
    split: split(0.3, 0.5, 0.05, 0.15),
    space: '5,000–10,000 sq ft shed',
    jobs: 20,
    licences: ['TNPCB consent', 'Factory licence'],
  },
  {
    id: 'steel-fabrication',
    name: 'Steel fabrication & welding works',
    nameTa: 'எஃகு வெல்டிங் மற்றும் கட்டமைப்பு',
    group: 'manufacturing',
    makes: 'Sheds, gates, trusses and industrial structures',
    minLakhs: 15,
    maxLakhs: 100,
    typicalLakhs: 35,
    split: split(0.3, 0.45, 0.05, 0.2),
    space: '3,000–6,000 sq ft shed',
    jobs: 10,
    licences: ['TNPCB consent', 'Electricity LT/HT connection'],
  },
  {
    id: 'cnc-machining',
    name: 'CNC machining job shop',
    nameTa: 'CNC இயந்திர பணிமனை',
    group: 'manufacturing',
    makes: 'Precision turned and milled parts for auto and pump makers',
    minLakhs: 60,
    maxLakhs: 300,
    typicalLakhs: 120,
    split: split(0.25, 0.6, 0.05, 0.1),
    space: '3,000–6,000 sq ft shed',
    jobs: 12,
    licences: ['TNPCB consent', 'Factory licence', 'ISO 9001 (customer ask)'],
  },
  {
    id: 'cold-storage',
    name: 'Cold storage & ripening chamber',
    nameTa: 'குளிர்பதன கிடங்கு',
    group: 'services',
    makes: 'Rented cold storage and banana/mango ripening for traders',
    minLakhs: 80,
    maxLakhs: 400,
    typicalLakhs: 150,
    split: split(0.45, 0.45, 0.05, 0.05),
    space: '25–50 cents plot',
    jobs: 10,
    licences: ['FSSAI licence', 'HT electricity connection'],
  },
  {
    id: 'printing-press',
    name: 'Offset & digital printing press',
    nameTa: 'அச்சகம்',
    group: 'services',
    makes: 'Labels, cartons, books and commercial print',
    minLakhs: 30,
    maxLakhs: 150,
    typicalLakhs: 60,
    split: split(0.25, 0.55, 0.05, 0.15),
    space: '2,000–4,000 sq ft shed',
    jobs: 10,
    licences: ['TNPCB consent', 'Press registration (PRB) if publishing'],
  },
];

export function getNeedsBusiness(id: string): NeedsBusiness | undefined {
  return NEEDS_BUSINESSES.find((business) => business.id === id);
}

export function clampProjectLakhs(value: number): number {
  if (!Number.isFinite(value)) return NEEDS_LIMITS.minProjectLakhs;
  return Math.min(
    NEEDS_LIMITS.maxProjectLakhs,
    Math.max(NEEDS_LIMITS.minProjectLakhs, Math.round(value)),
  );
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export type FundingPlan = {
  readonly projectLakhs: number;
  readonly costs: CostSplit;
  readonly capitalCostLakhs: number;
  readonly yourContributionLakhs: number;
  readonly contributionRate: number;
  readonly bankLoanLakhs: number;
  readonly subsidyLakhs: number;
  readonly subsidyCapped: boolean;
  readonly loanAfterSubsidyLakhs: number;
  readonly firstYearInterestSavedLakhs: number;
};

/**
 * Means of finance for a NEEDS project. Subsidy is 25% of capital cost
 * (project cost less working capital), capped at ₹75 lakh, and is credited
 * against the loan after the unit starts — it does not reduce the cash the
 * founder must bring on day one.
 */
export function needsFundingPlan(
  projectLakhs: number,
  category: FounderCategory,
  costSplit: CostSplit,
): FundingPlan {
  const total = clampProjectLakhs(projectLakhs);
  const costs: CostSplit = {
    landAndBuilding: round2(total * costSplit.landAndBuilding),
    plantAndMachinery: round2(total * costSplit.plantAndMachinery),
    otherFixed: round2(total * costSplit.otherFixed),
    workingCapital: 0,
  };
  const workingCapital = round2(
    total - costs.landAndBuilding - costs.plantAndMachinery - costs.otherFixed,
  );
  const finalCosts = { ...costs, workingCapital };
  const capitalCost = round2(total - workingCapital);
  const rate = NEEDS_LIMITS.contributionRate[category];
  const yourContribution = round2(total * rate);
  const bankLoan = round2(total - yourContribution);
  const rawSubsidy = capitalCost * NEEDS_LIMITS.subsidyRate;
  const subsidy = round2(Math.min(rawSubsidy, NEEDS_LIMITS.subsidyCapLakhs));
  return {
    projectLakhs: total,
    costs: finalCosts,
    capitalCostLakhs: capitalCost,
    yourContributionLakhs: yourContribution,
    contributionRate: rate,
    bankLoanLakhs: bankLoan,
    subsidyLakhs: subsidy,
    subsidyCapped: rawSubsidy > NEEDS_LIMITS.subsidyCapLakhs,
    loanAfterSubsidyLakhs: round2(bankLoan - subsidy),
    firstYearInterestSavedLakhs: round2(
      bankLoan * NEEDS_LIMITS.interestSubventionRate,
    ),
  };
}

/** ₹ formatting for lakh amounts: "₹5 lakh", "₹1.2 crore", "₹45,000". */
export function formatLakhs(lakhs: number): string {
  if (lakhs >= 100) {
    const crore = lakhs / 100;
    return `₹${Number.isInteger(crore) ? crore : crore.toFixed(2).replace(/0$/u, '')} crore`;
  }
  if (lakhs < 1) {
    return `₹${Math.round(lakhs * 100_000).toLocaleString('en-IN')}`;
  }
  const rounded = Math.round(lakhs * 100) / 100;
  return `₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/u, '')} lakh`;
}

export type FounderProfile = {
  readonly name: string;
  readonly age: number | null;
  readonly category: FounderCategory;
  readonly education: 'below-12th' | '12th-iti-diploma' | 'degree';
  readonly firstGeneration: boolean | null;
  readonly tnResident3Years: boolean | null;
  readonly district: string;
};

export type EligibilityCheck = {
  readonly id: string;
  readonly label: string;
  readonly status: 'pass' | 'fail' | 'check';
  readonly note: string;
};

export function needsEligibility(
  profile: FounderProfile,
): readonly EligibilityCheck[] {
  const maxAge = NEEDS_LIMITS.age[profile.category];
  const age = profile.age;
  return [
    {
      id: 'age',
      label: `Age 21–${maxAge} (${profile.category === 'special' ? 'special' : 'general'} category)`,
      status:
        age === null
          ? 'check'
          : age >= NEEDS_LIMITS.age.min && age <= maxAge
            ? 'pass'
            : 'fail',
      note:
        profile.category === 'general'
          ? 'The MSME Online NEEDS page gives 21–45. TIIC’s older page still says 21–35, so confirm with your DIC before applying.'
          : 'Special category: women, SC, ST, BC, MBC, ex-servicemen, transgender and differently-abled applicants (TIIC also lists minorities). Age relaxed up to 55.',
    },
    {
      id: 'education',
      label: '12th (+2) pass, ITI, vocational training, diploma or degree',
      status: profile.education === 'below-12th' ? 'fail' : 'pass',
      note: 'Keep the original certificate ready for the DIC interview.',
    },
    {
      id: 'first-generation',
      label: 'First-generation entrepreneur',
      status:
        profile.firstGeneration === null
          ? 'check'
          : profile.firstGeneration
            ? 'pass'
            : 'fail',
      note: 'You and your family should not already run a subsidised enterprise. An affidavit is usually required.',
    },
    {
      id: 'residency',
      label: 'Living in Tamil Nadu for at least 3 years',
      status:
        profile.tnResident3Years === null
          ? 'check'
          : profile.tnResident3Years
            ? 'pass'
            : 'fail',
      note: 'Aadhaar, ration card or a nativity certificate is used as proof.',
    },
  ];
}

export type RoadmapStep = {
  readonly id: string;
  readonly phase: 'Prepare' | 'Apply' | 'Fund' | 'Build' | 'Start';
  readonly title: string;
  readonly org: string;
  readonly time: string;
  readonly what: string;
  readonly docs: readonly string[];
  readonly url: string;
  readonly warn?: string;
};

export const NEEDS_ROADMAP: readonly RoadmapStep[] = [
  {
    id: 'pick',
    phase: 'Prepare',
    title: 'Pick the business and size it',
    org: 'NILAM (this page)',
    time: '1 day',
    what: 'Choose an activity, set the project cost and see what you need to bring.',
    docs: ['Your project choice', 'Rough machinery list'],
    url: '/needs#business',
  },
  {
    id: 'udyam',
    phase: 'Prepare',
    title: 'Register on Udyam',
    org: 'Ministry of MSME — free',
    time: '1 day',
    what: 'Free online MSME registration. Never pay an agent for it.',
    docs: ['Aadhaar linked to mobile', 'PAN'],
    url: 'https://udyamregistration.gov.in/',
  },
  {
    id: 'quotes',
    phase: 'Prepare',
    title: 'Collect machinery quotations and build the DPR',
    org: 'Suppliers + NILAM DPR',
    time: '1–2 weeks',
    what: 'Get 2–3 GST quotations per machine. The DPR uses them to justify cost and repayment.',
    docs: ['Machinery quotations', 'Building estimate or lease deed', 'DPR'],
    url: '/needs#dpr',
    warn: 'Rented or leased building cost is not counted for subsidy.',
  },
  {
    id: 'apply',
    phase: 'Apply',
    title: 'Apply online for NEEDS',
    org: 'MSME Online portal',
    time: '1 day',
    what: 'Fill the NEEDS application and upload your documents and DPR.',
    docs: [
      'Photo, Aadhaar, PAN',
      'Education certificate',
      'Community certificate (special category)',
      'Residence proof',
      'DPR and quotations',
    ],
    url: 'https://msmeonline.tn.gov.in/',
  },
  {
    id: 'interview',
    phase: 'Apply',
    title: 'Attend the DIC interview',
    org: 'District Industries Centre',
    time: '2–4 weeks',
    what: 'A district committee checks you and your project, then recommends it to a bank or TIIC.',
    docs: ['Original certificates', 'DPR printout'],
    url: NEEDS_SOURCES.dic.url,
  },
  {
    id: 'edp',
    phase: 'Apply',
    title: 'Complete the EDP training',
    org: 'EDII-TN',
    time: '15 days',
    what: 'Entrepreneurship Development Programme. Subsidy cannot be claimed without it.',
    docs: ['DIC recommendation'],
    url: 'https://www.editn.in/',
  },
  {
    id: 'sanction',
    phase: 'Fund',
    title: 'Get the bank or TIIC loan sanction',
    org: 'Bank / TIIC',
    time: '4–8 weeks',
    what: 'The bank appraises the DPR. Ask for a CGTMSE guarantee if you have no collateral.',
    docs: ['Sanction letter', 'Proof of your contribution'],
    url: NEEDS_SOURCES.tiic.url,
    warn: 'Make sure the sanction letter mentions NEEDS — the subsidy is linked to it.',
  },
  {
    id: 'land',
    phase: 'Build',
    title: 'Secure land or a shed',
    org: 'TANSIDCO / SIDCO / own land',
    time: '3–8 weeks',
    what: 'NEEDS applicants get priority in SIDCO estates. Own or purchased land is fine too.',
    docs: ['NEEDS recommendation letter', 'EMD for the plot'],
    url: 'https://www.tansidco.tn.gov.in/',
  },
  {
    id: 'approvals',
    phase: 'Build',
    title: 'Get approvals to build',
    org: 'TN Single Window Portal',
    time: '2–6 weeks',
    what: 'Building plan approval, TNPCB consent to establish, GST and electricity connection.',
    docs: ['Site plan', 'Land documents', 'Udyam certificate'],
    url: 'https://tnswp.com/',
  },
  {
    id: 'install',
    phase: 'Build',
    title: 'Construct and install machinery',
    org: 'You + suppliers',
    time: '2–4 months',
    what: 'The bank pays suppliers in stages. Keep every invoice — the subsidy claim needs them.',
    docs: ['Tax invoices', 'Delivery challans', 'Photos of installed machines'],
    url: '/needs#roadmap',
  },
  {
    id: 'operate',
    phase: 'Start',
    title: 'Get licences to operate',
    org: 'TNPCB / FSSAI / Factories',
    time: '2–4 weeks',
    what: 'Consent to operate, FSSAI for food units, factory licence if you cross the worker limit.',
    docs: ['Consent to establish', 'Installation photos'],
    url: 'https://tnswp.com/',
  },
  {
    id: 'production',
    phase: 'Start',
    title: 'Start production and claim the subsidy',
    org: 'DIC + bank',
    time: '1–3 months',
    what: 'Tell the DIC you have started. The capital subsidy is credited to your loan account, and the 3% interest subvention runs through repayment.',
    docs: ['Commercial production certificate', 'Invoices', 'Loan statement'],
    url: NEEDS_SOURCES.dic.url,
  },
];

export const DPR_READY_DOCUMENTS: readonly (readonly [string, string])[] = [
  ['photo', 'Passport photo'],
  ['aadhaar', 'Aadhaar'],
  ['pan', 'PAN'],
  ['education', 'Education certificate'],
  ['community', 'Community certificate (special category)'],
  ['residence', 'Residence proof (3 years in TN)'],
  ['affidavit', 'First-generation affidavit'],
  ['udyam', 'Udyam certificate'],
  ['quotations', 'Machinery quotations (2–3 each)'],
  ['site', 'Land/shed documents or allotment'],
];

/**
 * First-year revenue and operating cost as multiples of project cost, by
 * business group, at the 60% starting utilisation the DPR assumes. These are
 * NILAM planning ratios for a first draft — the founder replaces them with
 * their own quotations and price lists in the DPR builder.
 */
export const GROUP_ECONOMICS: Readonly<
  Record<BusinessGroup, { revenueMultiple: number; operatingCostShare: number }>
> = {
  food: { revenueMultiple: 1.8, operatingCostShare: 0.82 },
  agri: { revenueMultiple: 1.6, operatingCostShare: 0.82 },
  textiles: { revenueMultiple: 1.5, operatingCostShare: 0.8 },
  manufacturing: { revenueMultiple: 1.4, operatingCostShare: 0.78 },
  services: { revenueMultiple: 0.9, operatingCostShare: 0.7 },
};

/** Rupee strings for the DPR builder's query prefill. */
export function dprPrefillQuery(input: {
  readonly business: NeedsBusiness;
  readonly plan: FundingPlan;
  readonly promoterName: string;
  readonly district: string;
}): string {
  const rupees = (lakhs: number) => String(Math.round(lakhs * 100_000));
  const economics = GROUP_ECONOMICS[input.business.group];
  const revenueLakhs = input.plan.projectLakhs * economics.revenueMultiple;
  const params = new URLSearchParams({
    businessName: input.business.name,
    promoterName: input.promoterName,
    sector: input.business.name,
    district: input.district,
    projectCost: rupees(input.plan.projectLakhs),
    landAndBuildingCost: rupees(input.plan.costs.landAndBuilding),
    plantAndMachineryCost: rupees(input.plan.costs.plantAndMachinery),
    otherFixedCost: rupees(input.plan.costs.otherFixed),
    workingCapital: rupees(input.plan.costs.workingCapital),
    promoterContribution: rupees(input.plan.yourContributionLakhs),
    termLoan: rupees(input.plan.bankLoanLakhs),
    otherFunding: '0',
    employment: String(input.business.jobs),
    implementationMonths: '9',
    projectedAnnualRevenue: rupees(revenueLakhs),
    projectedAnnualOperatingCost: rupees(
      revenueLakhs * economics.operatingCostShare,
    ),
    capitalSubsidy: rupees(input.plan.subsidyLakhs),
    subsidySchemeName: 'NEEDS (Tamil Nadu)',
    interestSubventionPct: String(NEEDS_LIMITS.interestSubventionRate * 100),
    loanInterestRatePct: '10.5',
    loanTenureYears: '7',
    moratoriumMonths: '12',
    productsAndCapacity: `${input.business.makes}. Space needed: ${input.business.space}.`,
    location: `${input.district} district, Tamil Nadu`,
    licences: input.business.licences.join('\n'),
    assumptions: [
      `First-year revenue is a NILAM planning estimate (${economics.revenueMultiple}× project cost at 60% utilisation); replace it with your own price list and volumes.`,
      `NEEDS capital subsidy of 25% of fixed assets (capped at ₹${NEEDS_LIMITS.subsidyCapLakhs} lakh) is credited to the loan after commercial production.`,
      'NEEDS 3% interest subvention applies throughout the repayment period.',
    ].join('\n'),
    citationTitle: NEEDS_SOURCES.scheme.title,
    citationUrl: NEEDS_SOURCES.scheme.url,
    citationVerifiedOn: NEEDS_VERIFIED_ON,
  });
  return params.toString();
}
