import { z } from 'zod';

export const TAMIL_NADU_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Kanniyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
] as const;

export const MatcherInputSchema = z
  .object({
    sector: z.enum([
      'agri-infrastructure',
      'food-processing',
      'manufacturing',
      'services',
      'trading',
      'traditional-industry',
      'other',
    ]),
    projectCostLakhs: z.number().finite().positive().max(5_000),
    eligibleCapitalCostLakhs: z.number().finite().nonnegative().max(5_000),
    eligiblePlantMachineryLakhs: z.number().finite().nonnegative().max(5_000),
    requestedLoanLakhs: z.number().finite().nonnegative().max(5_000),
    district: z.enum(TAMIL_NADU_DISTRICTS),
    locationClass: z.enum(['urban', 'rural']),
    backwardBlock: z.boolean(),
    firstGeneration: z.boolean(),
    age: z.number().int().min(18).max(100),
    specialCategory: z.enum([
      'none',
      'woman',
      'sc',
      'st',
      'bc',
      'mbc',
      'minority',
      'ex-serviceman',
      'transgender',
      'differently-abled',
    ]),
    fpoWilling: z.boolean(),
    entityKind: z.enum([
      'proprietorship',
      'partnership',
      'company',
      'cooperative',
      'fpo',
      'shg',
      'other',
    ]),
    enterpriseStage: z.enum(['new', 'existing']),
    enterpriseSize: z.enum(['micro', 'small', 'medium', 'not-msme']),
    educationLevel: z.enum([
      'below-eighth',
      'eighth',
      'twelfth',
      'iti',
      'diploma',
      'degree',
    ]),
    annualFamilyIncomeLakhs: z.number().finite().nonnegative().max(1_000),
    priorGovernmentCapitalSubsidy: z.boolean(),
    repaidMudraTarun: z.boolean(),
    udyamRegistered: z.boolean(),
  })
  .strict()
  .superRefine((input, context) => {
    const boundedCosts = [
      ['eligibleCapitalCostLakhs', input.eligibleCapitalCostLakhs],
      ['eligiblePlantMachineryLakhs', input.eligiblePlantMachineryLakhs],
      ['requestedLoanLakhs', input.requestedLoanLakhs],
    ] as const;

    for (const [field, amount] of boundedCosts) {
      if (amount > input.projectCostLakhs) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} cannot exceed projectCostLakhs`,
        });
      }
    }
  });

export type MatcherInput = z.infer<typeof MatcherInputSchema>;

export type SchemeLevel = 'central' | 'state';
export type SchemeStatus = 'published' | 'pending-review' | 'retired';
export type ConfirmationLevel =
  | 'go-text'
  | 'official-guideline'
  | 'official-portal'
  | 'dic-written'
  | 'inferred';

export interface Citation {
  readonly id: string;
  readonly title: string;
  readonly issuingAuthority: string;
  readonly url: string;
  readonly documentDate?: string;
  readonly verifiedOn: string;
  readonly locator?: string;
  readonly primary: true;
}

export interface PredicateOutcome {
  readonly passed: boolean;
  readonly actual?: string;
}

export interface EligibilityPredicate {
  readonly id: string;
  readonly label: string;
  readonly citationIds: readonly string[];
  readonly evaluate: (input: MatcherInput) => PredicateOutcome;
}

export type BenefitKind =
  | 'capital-subsidy'
  | 'margin-money-subsidy'
  | 'interest-subvention'
  | 'credit-access'
  | 'certification-support'
  | 'market-access';

export interface Benefit {
  readonly id: string;
  readonly kind: BenefitKind;
  readonly amountLakhs: number | null;
  readonly label: string;
  readonly citationIds: readonly string[];
  readonly calculation:
    'exact-input-formula' | 'official-limit-only' | 'non-monetary';
}

export interface ApplicationStepDefinition {
  readonly id: string;
  readonly title: string;
  readonly organisation: string;
  readonly citationIds: readonly string[];
  readonly requires: readonly string[];
}

export interface PublishedSchemeRule {
  readonly status: 'published';
  readonly id: string;
  readonly name: string;
  readonly nameTa: string;
  readonly level: SchemeLevel;
  readonly department: string;
  readonly citations: readonly Citation[];
  readonly eligibility: readonly EligibilityPredicate[];
  readonly benefits: (input: MatcherInput) => readonly Benefit[];
  readonly conflictGroup?: string;
  readonly deadline: string | null;
  readonly steps: readonly ApplicationStepDefinition[];
  readonly caveats: readonly string[];
}

export interface NonCalculatingSchemeRecord {
  readonly status: 'pending-review' | 'retired';
  readonly id: string;
  readonly name: string;
  readonly nameTa: string;
  readonly level: SchemeLevel;
  readonly department: string;
  readonly citations: readonly Citation[];
  readonly reviewReason: string;
  readonly deadline: string | null;
}

export type SchemeRecord = PublishedSchemeRule | NonCalculatingSchemeRecord;

export interface ConflictPair {
  readonly schemeA: string;
  readonly schemeB: string;
  readonly kind: 'exclusive' | 'caution' | 'compatible';
  readonly rationale: string;
  readonly confirmedAt: ConfirmationLevel;
  readonly citationIds: readonly string[];
  readonly verifiedOn: string;
}

export interface Ruleset {
  readonly version: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly records: readonly SchemeRecord[];
  readonly conflictPairs: readonly ConflictPair[];
  readonly changelog: readonly string[];
}

export interface PredicateResult {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly actual?: string;
  readonly citationIds: readonly string[];
}

export interface SchemeResult {
  readonly schemeId: string;
  readonly name: string;
  readonly nameTa: string;
  readonly predicates: readonly PredicateResult[];
  readonly benefits: readonly Benefit[];
  readonly totalLakhs: number;
  readonly deadline: string | null;
  readonly citations: readonly Citation[];
  readonly caveats: readonly string[];
}

export interface NearMiss {
  readonly schemeId: string;
  readonly name: string;
  readonly failedPredicates: readonly PredicateResult[];
  readonly passedPredicateCount: number;
}

export interface ConflictResolution {
  readonly keptSchemeId: string;
  readonly droppedSchemeId: string;
  readonly kind: 'conflict-group' | 'exclusive-pair';
  readonly rationale: string;
  readonly confirmedAt: ConfirmationLevel;
  readonly citationIds: readonly string[];
}

export interface CompatibilityResult {
  readonly schemeA: string;
  readonly schemeB: string;
  readonly kind: 'compatible' | 'caution' | 'unknown';
  readonly rationale: string;
  readonly confirmedAt: ConfirmationLevel;
  readonly citationIds: readonly string[];
}

export interface ApplicationStep extends ApplicationStepDefinition {
  readonly schemeIds: readonly string[];
  readonly order: number;
}

export interface EvaluationResult {
  readonly rulesetVersion: string;
  readonly asOf: string;
  readonly input: MatcherInput;
  readonly eligible: readonly SchemeResult[];
  readonly nearMisses: readonly NearMiss[];
  readonly conflicts: readonly ConflictResolution[];
  readonly compatibility: readonly CompatibilityResult[];
  readonly sequence: readonly ApplicationStep[];
  readonly totalLakhs: number;
  readonly pendingVerification: readonly NonCalculatingSchemeRecord[];
  readonly retired: readonly NonCalculatingSchemeRecord[];
  readonly warnings: readonly string[];
}

export interface SchemeDelta {
  readonly schemeId: string;
  readonly beforeLakhs: number;
  readonly afterLakhs: number;
  readonly deltaLakhs: number;
  readonly eligibilityChanged: boolean;
}

export interface HistoricComparison {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly before: EvaluationResult;
  readonly after: EvaluationResult;
  readonly totalDeltaLakhs: number;
  readonly schemeDeltas: readonly SchemeDelta[];
}
