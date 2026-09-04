import {
  CURRENT_RULESET_VERSION,
  MatcherInputSchema,
  canonicalizeDistrict,
  getInventoryCoverage,
  getRuleset,
  type Benefit,
  type EvaluationResult,
  type MatcherInput,
  type RulesetVersion,
  type SchemeResult,
} from '@nilam/engine';

import {
  DEFAULT_MATCHER_INPUT,
  serializeMatcherState,
  type MatcherUrlState,
} from './matcher-state';
import { evaluateMatcherSurface } from './matcher-surfaces';

export const NILAM_SECTOR_MAP = {
  food: 'food-processing',
  agri: 'agri-infrastructure',
  textiles: 'manufacturing',
  engineering: 'traditional-industry',
  services: 'services',
  trading: 'trading',
  other: 'other',
} as const satisfies Readonly<Record<string, MatcherInput['sector']>>;

export type NilamSector = keyof typeof NILAM_SECTOR_MAP;

export type NilamControls = {
  readonly sector: NilamSector;
  readonly projectCostLakhs: number;
  readonly district: string;
  readonly firstGeneration: boolean;
  readonly specialCategory: boolean;
  readonly backwardBlock: boolean;
  readonly fpoWilling: boolean;
};

export const NILAM_REFINEMENT_FIELDS = [
  'eligibleCapitalCostLakhs',
  'requestedLoanLakhs',
  'age',
  'enterpriseStage',
  'enterpriseSize',
  'specialCategory',
] as const satisfies readonly (keyof MatcherInput)[];

export type NilamRefinementField = (typeof NILAM_REFINEMENT_FIELDS)[number];

export type NilamAssumption = {
  readonly field: keyof MatcherInput;
  readonly label: string;
  readonly value: string;
  readonly highImpact: boolean;
};

export type NilamBenefitGroup = {
  readonly kind: 'cash-subsidy' | 'cost-saving' | 'financing-access';
  readonly label: string;
  readonly benefits: readonly Benefit[];
  readonly totalLakhs: number;
};

export type NilamSchemeView = SchemeResult & {
  readonly benefitGroups: readonly NilamBenefitGroup[];
};

export type NilamTruthView = {
  readonly result: EvaluationResult;
  readonly schemes: readonly NilamSchemeView[];
  readonly cashSubsidyLakhs: number;
  readonly costSavingLakhs: number;
  readonly totalLakhs: number;
  readonly assumptions: readonly NilamAssumption[];
  readonly inventory: ReturnType<typeof getInventoryCoverage>;
};

const ASSUMPTION_LABELS: Readonly<Partial<Record<keyof MatcherInput, string>>> =
  {
    eligibleCapitalCostLakhs: 'Eligible capital cost',
    eligiblePlantMachineryLakhs: 'Eligible plant and machinery',
    requestedLoanLakhs: 'Requested loan',
    age: 'Promoter age',
    specialCategory: 'Exact special category',
    locationClass: 'Rural or urban location',
    entityKind: 'Legal constitution',
    enterpriseStage: 'Enterprise stage',
    enterpriseSize: 'Enterprise size',
    educationLevel: 'Education level',
    annualFamilyIncomeLakhs: 'Annual family income',
    priorGovernmentCapitalSubsidy: 'Prior capital subsidy',
    repaidMudraTarun: 'Repaid MUDRA Tarun history',
    udyamRegistered: 'Udyam registration',
  };

function formatAssumptionValue(
  field: keyof MatcherInput,
  value: MatcherInput[keyof MatcherInput],
): string {
  if (
    field === 'eligibleCapitalCostLakhs' ||
    field === 'eligiblePlantMachineryLakhs' ||
    field === 'requestedLoanLakhs' ||
    field === 'annualFamilyIncomeLakhs'
  ) {
    return `₹${String(value)} lakh`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replaceAll('-', ' ');
}

const DEFAULT_PROJECT_COST_LAKHS = DEFAULT_MATCHER_INPUT.projectCostLakhs;

function scaleHiddenCost(
  projectCostLakhs: number,
  defaultAmount: number,
): number {
  return (
    Math.round(
      ((defaultAmount * projectCostLakhs) / DEFAULT_PROJECT_COST_LAKHS) * 10,
    ) / 10
  );
}

export function createNilamMatcherInput(
  controls: NilamControls,
  refinements: Partial<MatcherInput> = {},
): MatcherInput {
  const projectCostLakhs = controls.projectCostLakhs;
  const district = canonicalizeDistrict(controls.district);
  if (district === undefined) {
    throw new Error(`Unknown district: ${controls.district}`);
  }
  const specialCategory =
    controls.specialCategory &&
    refinements.specialCategory !== undefined &&
    refinements.specialCategory !== 'none'
      ? refinements.specialCategory
      : 'none';
  return MatcherInputSchema.parse({
    ...DEFAULT_MATCHER_INPUT,
    ...refinements,
    sector: NILAM_SECTOR_MAP[controls.sector],
    projectCostLakhs,
    district,
    firstGeneration: controls.firstGeneration,
    specialCategory,
    backwardBlock: controls.backwardBlock,
    locationClass:
      refinements.locationClass ?? DEFAULT_MATCHER_INPUT.locationClass,
    fpoWilling: controls.fpoWilling,
    eligibleCapitalCostLakhs: Math.min(
      refinements.eligibleCapitalCostLakhs ??
        scaleHiddenCost(
          projectCostLakhs,
          DEFAULT_MATCHER_INPUT.eligibleCapitalCostLakhs,
        ),
      projectCostLakhs,
    ),
    eligiblePlantMachineryLakhs: Math.min(
      refinements.eligiblePlantMachineryLakhs ??
        scaleHiddenCost(
          projectCostLakhs,
          DEFAULT_MATCHER_INPUT.eligiblePlantMachineryLakhs,
        ),
      projectCostLakhs,
    ),
    requestedLoanLakhs: Math.min(
      refinements.requestedLoanLakhs ??
        scaleHiddenCost(
          projectCostLakhs,
          DEFAULT_MATCHER_INPUT.requestedLoanLakhs,
        ),
      projectCostLakhs,
    ),
  });
}

export function nilamControlsFromMatcher(input: MatcherInput): NilamControls {
  const sector =
    (
      Object.entries(NILAM_SECTOR_MAP) as readonly [
        NilamSector,
        MatcherInput['sector'],
      ][]
    ).find(([, canonical]) => canonical === input.sector)?.[0] ?? 'services';
  return {
    sector,
    projectCostLakhs: input.projectCostLakhs,
    district: input.district,
    firstGeneration: input.firstGeneration,
    specialCategory: input.specialCategory !== 'none',
    backwardBlock: input.backwardBlock,
    fpoWilling: input.fpoWilling,
  };
}

export function parseLegacyNilamHash(hash: string): MatcherUrlState | null {
  const raw = hash.replace(/^#\??/u, '');
  if (raw === '') return null;
  const values = new URLSearchParams(raw);
  if (
    !['sec', 'pc', 'd', 'fg', 'sp', 'bb', 'fpo'].some((key) => values.has(key))
  ) {
    return null;
  }

  const defaults = nilamControlsFromMatcher(DEFAULT_MATCHER_INPUT);
  const rawSector = values.get('sec');
  const sector =
    rawSector !== null && rawSector in NILAM_SECTOR_MAP
      ? (rawSector as NilamSector)
      : defaults.sector;
  const projectCost = Number(values.get('pc') ?? defaults.projectCostLakhs);
  const refinements: Partial<MatcherInput> = {};
  if (values.get('sp') === '1') refinements.specialCategory = 'woman';
  if (values.get('bb') === '0') refinements.locationClass = 'urban';
  if (values.get('bb') === '1') refinements.locationClass = 'rural';
  const input = createNilamMatcherInput(
    {
      sector,
      projectCostLakhs: projectCost,
      district: values.get('d') ?? defaults.district,
      firstGeneration:
        values.get('fg') === null
          ? defaults.firstGeneration
          : values.get('fg') === '1',
      specialCategory:
        values.get('sp') === null
          ? defaults.specialCategory
          : values.get('sp') === '1',
      backwardBlock:
        values.get('bb') === null
          ? defaults.backwardBlock
          : values.get('bb') === '1',
      fpoWilling:
        values.get('fpo') === null
          ? defaults.fpoWilling
          : values.get('fpo') === '1',
    },
    refinements,
  );
  return { input, ruleset: CURRENT_RULESET_VERSION };
}

export function canonicalQueryForLegacyHash(hash: string): string | null {
  const state = parseLegacyNilamHash(hash);
  return state === null ? null : serializeMatcherState(state);
}

export function getNilamAssumptions(
  input: MatcherInput,
  confirmed: ReadonlySet<keyof MatcherInput> = new Set(),
): readonly NilamAssumption[] {
  return Object.entries(ASSUMPTION_LABELS).flatMap(([rawField, label]) => {
    const field = rawField as keyof MatcherInput;
    if (label === undefined || confirmed.has(field)) return [];
    return [
      {
        field,
        label,
        value: formatAssumptionValue(field, input[field]),
        highImpact: (NILAM_REFINEMENT_FIELDS as readonly string[]).includes(
          field,
        ),
      },
    ];
  });
}

function classifyBenefit(benefit: Benefit): NilamBenefitGroup['kind'] {
  if (
    benefit.kind === 'capital-subsidy' ||
    benefit.kind === 'margin-money-subsidy'
  ) {
    return 'cash-subsidy';
  }
  if (
    benefit.kind === 'interest-subvention' ||
    benefit.kind === 'certification-support'
  ) {
    return 'cost-saving';
  }
  return 'financing-access';
}

function groupBenefits(
  benefits: readonly Benefit[],
): readonly NilamBenefitGroup[] {
  const definitions = [
    ['cash-subsidy', 'Cash subsidy'],
    ['cost-saving', 'Reimbursement / cost saving'],
    ['financing-access', 'Financing / access'],
  ] as const;
  return definitions.flatMap(([kind, label]) => {
    const grouped = benefits.filter(
      (benefit) => classifyBenefit(benefit) === kind,
    );
    if (grouped.length === 0) return [];
    return [
      {
        kind,
        label,
        benefits: grouped,
        totalLakhs: grouped.reduce(
          (total, benefit) => total + (benefit.amountLakhs ?? 0),
          0,
        ),
      },
    ];
  });
}

export function toNilamTruthView(
  result: EvaluationResult,
  confirmed: ReadonlySet<keyof MatcherInput> = new Set(),
): NilamTruthView {
  const schemes = result.eligible.map((scheme) => ({
    ...scheme,
    benefitGroups: groupBenefits(scheme.benefits),
  }));
  const totalFor = (kind: NilamBenefitGroup['kind']) =>
    schemes.reduce(
      (total, scheme) =>
        total +
        scheme.benefitGroups
          .filter((group) => group.kind === kind)
          .reduce((subtotal, group) => subtotal + group.totalLakhs, 0),
      0,
    );
  return {
    result,
    schemes,
    cashSubsidyLakhs: totalFor('cash-subsidy'),
    costSavingLakhs: totalFor('cost-saving'),
    totalLakhs: result.totalLakhs,
    assumptions: getNilamAssumptions(result.input, confirmed),
    inventory: getInventoryCoverage(getRuleset(result.rulesetVersion)),
  };
}

export function evaluateNilamTruth(
  input: MatcherInput,
  ruleset: RulesetVersion = CURRENT_RULESET_VERSION,
  confirmed: ReadonlySet<keyof MatcherInput> = new Set(),
): NilamTruthView {
  return toNilamTruthView(evaluateMatcherSurface(input, ruleset), confirmed);
}
