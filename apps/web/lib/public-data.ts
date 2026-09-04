import {
  CORPUS_VERIFIED_ON,
  CURRENT_RULESET,
  TAMIL_NADU_DISTRICTS,
  type SchemeRecord,
} from '@nilam/engine';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nilam.tn';

export const SECTORS = [
  {
    slug: 'food-processing',
    name: 'Food processing',
    nameTa: 'உணவு பதப்படுத்துதல்',
    description:
      'Credit-linked support, formalisation and infrastructure programmes for food enterprises.',
  },
  {
    slug: 'manufacturing',
    name: 'Manufacturing',
    nameTa: 'உற்பத்தி',
    description:
      'Enterprise creation, term credit and quality-certification support for manufacturers.',
  },
  {
    slug: 'services',
    name: 'Services',
    nameTa: 'சேவைகள்',
    description:
      'Finance and enterprise-development routes for eligible service businesses.',
  },
  {
    slug: 'agri-infrastructure',
    name: 'Agriculture infrastructure',
    nameTa: 'வேளாண் உள்கட்டமைப்பு',
    description:
      'Post-harvest, storage and value-chain infrastructure support.',
  },
] as const;

export type PublicEstate = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly nameTa: string;
  readonly agency: 'tansidco' | 'sipcot';
  readonly district: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sourceUrl: string;
  readonly verifiedOn: string;
  readonly sourceSyncedAt: string;
  readonly dataQuality: 'directory-only';
  readonly plotStatus: 'unknown';
  readonly summary: string;
};

/**
 * Safe low-connectivity fallback. These records prove that an estate directory
 * entry exists; they deliberately make no vacancy, rate or boundary claim.
 * Database-backed API results replace them when a verified publication exists.
 */
export const FALLBACK_ESTATES: readonly PublicEstate[] = [
  {
    id: 'fallback-guindy',
    slug: 'guindy-industrial-estate',
    name: 'Guindy Industrial Estate',
    nameTa: 'கிண்டி தொழிற்பேட்டை',
    agency: 'tansidco',
    district: 'Chennai',
    latitude: 13.0108,
    longitude: 80.2137,
    sourceUrl: 'https://www.tansidco.tn.gov.in/',
    verifiedOn: CORPUS_VERIFIED_ON,
    sourceSyncedAt: `${CORPUS_VERIFIED_ON}T00:00:00.000Z`,
    dataQuality: 'directory-only',
    plotStatus: 'unknown',
    summary:
      'Directory-only fallback entry. Live plot availability, rates and boundaries are not asserted.',
  },
  {
    id: 'fallback-hosur',
    slug: 'hosur-industrial-complex',
    name: 'Hosur Industrial Complex',
    nameTa: 'ஓசூர் தொழில் வளாகம்',
    agency: 'sipcot',
    district: 'Krishnagiri',
    latitude: 12.7409,
    longitude: 77.8253,
    sourceUrl: 'https://sipcot.tn.gov.in/',
    verifiedOn: CORPUS_VERIFIED_ON,
    sourceSyncedAt: `${CORPUS_VERIFIED_ON}T00:00:00.000Z`,
    dataQuality: 'directory-only',
    plotStatus: 'unknown',
    summary:
      'Directory-only fallback entry. Live plot availability, rates and boundaries are not asserted.',
  },
  {
    id: 'fallback-coimbatore',
    slug: 'kurichi-industrial-estate',
    name: 'Kurichi Industrial Estate',
    nameTa: 'குறிச்சி தொழிற்பேட்டை',
    agency: 'tansidco',
    district: 'Coimbatore',
    latitude: 10.9338,
    longitude: 76.9538,
    sourceUrl: 'https://www.tansidco.tn.gov.in/',
    verifiedOn: CORPUS_VERIFIED_ON,
    sourceSyncedAt: `${CORPUS_VERIFIED_ON}T00:00:00.000Z`,
    dataQuality: 'directory-only',
    plotStatus: 'unknown',
    summary:
      'Directory-only fallback entry. Live plot availability, rates and boundaries are not asserted.',
  },
] as const;

export const PLAYBOOKS = [
  {
    slug: 'first-generation-manufacturer',
    title: 'Start a first-generation manufacturing unit',
    titleTa: 'முதல் தலைமுறை உற்பத்தி நிறுவனத்தைத் தொடங்குதல்',
    description:
      'Move from project definition to registrations, land, finance and a cited scheme application.',
    steps: [
      'Define the product, capacity and realistic eligible project costs.',
      'Shortlist land without treating directory or map markers as vacancy confirmation.',
      'Complete Udyam and entity registrations required by the chosen route.',
      'Run the Matcher and verify every failed or passed eligibility condition.',
      'Prepare the project report before seeking a scheme-tagged bank sanction.',
    ],
  },
  {
    slug: 'micro-food-formalisation',
    title: 'Formalise a micro food-processing unit',
    titleTa: 'நுண் உணவு பதப்படுத்தும் நிறுவனத்தை முறைப்படுத்துதல்',
    description:
      'A deadline-aware route for existing micro food enterprises, with no promise of sanction.',
    steps: [
      'Document the existing activity, ownership, sales and present machinery.',
      'Check FSSAI, Udyam and local compliance gaps.',
      'Separate eligible project cost from the full business budget.',
      'Check the current PMFME window and district process at the cited source.',
      'Submit the DPR and preserve written decisions from the nodal agency and lender.',
    ],
  },
  {
    slug: 'industrial-land-shortlist',
    title: 'Shortlist industrial land safely',
    titleTa: 'தொழில் நிலத்தை பாதுகாப்பாகத் தேர்வு செய்தல்',
    description:
      'Use map evidence as a shortlist, then verify title, vacancy, infrastructure and price.',
    steps: [
      'Filter estates by district and agency; note the source-sync date.',
      'Treat unknown and fallback plot statuses as unknown—not vacant.',
      'Open the official source and request current written availability.',
      'Verify utilities, access, environmental fit, tenure, rate and all additional charges.',
      'Prefill the Matcher with the selected district, then confirm location classifications.',
    ],
  },
] as const;

const DISTRICT_NAMES_TA: Readonly<
  Record<(typeof TAMIL_NADU_DISTRICTS)[number], string>
> = {
  Ariyalur: 'அரியலூர்',
  Chengalpattu: 'செங்கல்பட்டு',
  Chennai: 'சென்னை',
  Coimbatore: 'கோயம்புத்தூர்',
  Cuddalore: 'கடலூர்',
  Dharmapuri: 'தருமபுரி',
  Dindigul: 'திண்டுக்கல்',
  Erode: 'ஈரோடு',
  Kallakurichi: 'கள்ளக்குறிச்சி',
  Kancheepuram: 'காஞ்சிபுரம்',
  Kanniyakumari: 'கன்னியாகுமரி',
  Karur: 'கரூர்',
  Krishnagiri: 'கிருஷ்ணகிரி',
  Madurai: 'மதுரை',
  Mayiladuthurai: 'மயிலாடுதுறை',
  Nagapattinam: 'நாகப்பட்டினம்',
  Namakkal: 'நாமக்கல்',
  Nilgiris: 'நீலகிரி',
  Perambalur: 'பெரம்பலூர்',
  Pudukkottai: 'புதுக்கோட்டை',
  Ramanathapuram: 'இராமநாதபுரம்',
  Ranipet: 'இராணிப்பேட்டை',
  Salem: 'சேலம்',
  Sivaganga: 'சிவகங்கை',
  Tenkasi: 'தென்காசி',
  Thanjavur: 'தஞ்சாவூர்',
  Theni: 'தேனி',
  Thoothukudi: 'தூத்துக்குடி',
  Tiruchirappalli: 'திருச்சிராப்பள்ளி',
  Tirunelveli: 'திருநெல்வேலி',
  Tirupathur: 'திருப்பத்தூர்',
  Tiruppur: 'திருப்பூர்',
  Tiruvallur: 'திருவள்ளூர்',
  Tiruvannamalai: 'திருவண்ணாமலை',
  Tiruvarur: 'திருவாரூர்',
  Vellore: 'வேலூர்',
  Viluppuram: 'விழுப்புரம்',
  Virudhunagar: 'விருதுநகர்',
};

export const DISTRICTS = TAMIL_NADU_DISTRICTS.map((name) => ({
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
  nameTa: `${DISTRICT_NAMES_TA[name]} மாவட்டம்`,
}));

export const schemeRecords = CURRENT_RULESET.records;
export const publishedSchemes = schemeRecords.filter(
  (record) => record.status === 'published',
);

export function getScheme(slug: string): SchemeRecord | undefined {
  return schemeRecords.find((record) => record.id === slug);
}

export function getEstate(slug: string): PublicEstate | undefined {
  return FALLBACK_ESTATES.find((estate) => estate.slug === slug);
}

export function getSector(slug: string) {
  return SECTORS.find((sector) => sector.slug === slug);
}

export function getDistrict(slug: string) {
  return DISTRICTS.find((district) => district.slug === slug);
}

export function getPlaybook(slug: string) {
  return PLAYBOOKS.find((playbook) => playbook.slug === slug);
}

export const STATUS_COPY = {
  published: {
    label: 'Verified rule',
    labelTa: 'சரிபார்க்கப்பட்ட விதி',
    explanation:
      'Included in Matcher calculations only when all cited eligibility predicates pass.',
  },
  'pending-review': {
    label: 'Pending verification — not calculated',
    labelTa: 'சரிபார்ப்பு நிலுவை — கணக்கிடப்படவில்லை',
    explanation:
      'NILAM has not pinned enough primary-source evidence to calculate eligibility or benefits.',
  },
  retired: {
    label: 'Retired — not available',
    labelTa: 'முடிவடைந்தது — தற்போது கிடைக்காது',
    explanation:
      'Kept for historical context and excluded from current calculations.',
  },
} as const;
