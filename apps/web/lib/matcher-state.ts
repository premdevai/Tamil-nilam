import {
  MatcherInputSchema,
  canonicalizeDistrict,
  type MatcherInput,
  type RulesetVersion,
  CURRENT_RULESET_VERSION,
} from '@nilam/engine';

export function matcherAsOf(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export const MATCHER_AS_OF = matcherAsOf();

export const DEFAULT_MATCHER_INPUT: MatcherInput = {
  sector: 'food-processing',
  projectCostLakhs: 110,
  eligibleCapitalCostLakhs: 17.6,
  eligiblePlantMachineryLakhs: 17.6,
  requestedLoanLakhs: 71.5,
  district: 'Thanjavur',
  locationClass: 'rural',
  backwardBlock: true,
  firstGeneration: true,
  age: 30,
  specialCategory: 'none',
  fpoWilling: false,
  entityKind: 'proprietorship',
  enterpriseStage: 'new',
  enterpriseSize: 'micro',
  educationLevel: 'twelfth',
  annualFamilyIncomeLakhs: 5,
  priorGovernmentCapitalSubsidy: false,
  repaidMudraTarun: false,
  udyamRegistered: false,
};

const BOOLEAN_FIELDS = [
  'backwardBlock',
  'firstGeneration',
  'fpoWilling',
  'priorGovernmentCapitalSubsidy',
  'repaidMudraTarun',
  'udyamRegistered',
] as const;

const NUMBER_FIELDS = [
  'projectCostLakhs',
  'eligibleCapitalCostLakhs',
  'eligiblePlantMachineryLakhs',
  'requestedLoanLakhs',
  'age',
  'annualFamilyIncomeLakhs',
] as const;

const ALIASES = {
  backward: 'backwardBlock',
  cost: 'projectCostLakhs',
  capital: 'eligibleCapitalCostLakhs',
  machinery: 'eligiblePlantMachineryLakhs',
  loan: 'requestedLoanLakhs',
  income: 'annualFamilyIncomeLakhs',
  firstgen: 'firstGeneration',
  special: 'specialCategory',
  stage: 'enterpriseStage',
  size: 'enterpriseSize',
  education: 'educationLevel',
  entity: 'entityKind',
  location: 'locationClass',
  prior: 'priorGovernmentCapitalSubsidy',
  tarun: 'repaidMudraTarun',
  udyam: 'udyamRegistered',
  fpo: 'fpoWilling',
} as const;

const URL_KEYS = Object.fromEntries(
  Object.entries(ALIASES).map(([key, value]) => [value, key]),
) as Readonly<Record<string, string>>;

export type MatcherUrlState = {
  readonly input: MatcherInput;
  readonly ruleset: RulesetVersion;
  readonly estate?: string;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseMatcherState(
  values: Readonly<Record<string, string | string[] | undefined>>,
): MatcherUrlState {
  const candidate: Record<string, unknown> = { ...DEFAULT_MATCHER_INPUT };

  for (const key of Object.keys(DEFAULT_MATCHER_INPUT)) {
    const alias = URL_KEYS[key] ?? key;
    const raw = first(values[alias] ?? values[key]);
    if (raw === undefined) continue;
    if ((BOOLEAN_FIELDS as readonly string[]).includes(key)) {
      candidate[key] = raw === '1' || raw === 'true';
    } else if ((NUMBER_FIELDS as readonly string[]).includes(key)) {
      candidate[key] = Number(raw);
    } else if (key === 'district') {
      candidate[key] = canonicalizeDistrict(raw) ?? raw;
    } else {
      candidate[key] = raw;
    }
  }

  const parsed = MatcherInputSchema.safeParse(candidate);
  const ruleset =
    first(values.ruleset) === '2025.03' ? '2025.03' : CURRENT_RULESET_VERSION;
  const estate = first(values.estate);

  return {
    input: parsed.success ? parsed.data : DEFAULT_MATCHER_INPUT,
    ruleset,
    ...(estate === undefined ? {} : { estate }),
  };
}

export function serializeMatcherState(state: MatcherUrlState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state.input)) {
    if (
      value === DEFAULT_MATCHER_INPUT[key as keyof MatcherInput] &&
      key !== 'district'
    ) {
      continue;
    }
    const alias = URL_KEYS[key] ?? key;
    params.set(
      alias,
      typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
    );
  }
  if (state.ruleset !== CURRENT_RULESET_VERSION) {
    params.set('ruleset', state.ruleset);
  }
  if (state.estate !== undefined) params.set('estate', state.estate);
  return params.toString();
}
