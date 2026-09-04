import {
  CURRENT_RULESET_VERSION,
  MatcherInputSchema,
  evaluatePinned,
  type MatcherInput,
} from '@nilam/engine';
import type { JobHelpers } from 'graphile-worker';
import { z } from 'zod';

const payloadSchema = z.object({ runId: z.uuid() }).strict();

const DEFAULTS: MatcherInput = {
  sector: 'manufacturing',
  projectCostLakhs: 25,
  eligibleCapitalCostLakhs: 20,
  eligiblePlantMachineryLakhs: 15,
  requestedLoanLakhs: 15,
  district: 'Coimbatore',
  locationClass: 'urban',
  backwardBlock: false,
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

export function matcherInputFromBulkRow(
  row: Record<string, string>,
): MatcherInput {
  const projectCost = Number(row.projectCost ?? row.projectCostLakhs ?? '');
  const projectCostLakhs =
    row.projectCostLakhs === undefined || row.projectCostLakhs.length === 0
      ? Number.isFinite(projectCost)
        ? projectCost / 100_000
        : DEFAULTS.projectCostLakhs
      : Number(row.projectCostLakhs);
  const merged = {
    ...DEFAULTS,
    ...(row.sector === undefined ? {} : { sector: row.sector }),
    ...(row.district === undefined ? {} : { district: row.district }),
    projectCostLakhs,
    eligibleCapitalCostLakhs: numberOr(
      row.eligibleCapitalCostLakhs,
      Math.min(projectCostLakhs, DEFAULTS.eligibleCapitalCostLakhs),
    ),
    eligiblePlantMachineryLakhs: numberOr(
      row.eligiblePlantMachineryLakhs,
      Math.min(projectCostLakhs, DEFAULTS.eligiblePlantMachineryLakhs),
    ),
    requestedLoanLakhs: numberOr(
      row.requestedLoanLakhs,
      Math.min(projectCostLakhs, DEFAULTS.requestedLoanLakhs),
    ),
    ...(row.locationClass === undefined
      ? {}
      : { locationClass: row.locationClass }),
    backwardBlock: booleanOr(row.backwardBlock, DEFAULTS.backwardBlock),
    firstGeneration: booleanOr(row.firstGeneration, DEFAULTS.firstGeneration),
    age: Math.round(numberOr(row.age, DEFAULTS.age)),
    ...(row.specialCategory === undefined
      ? {}
      : { specialCategory: row.specialCategory }),
    fpoWilling: booleanOr(row.fpoWilling, DEFAULTS.fpoWilling),
    ...(row.entityKind === undefined ? {} : { entityKind: row.entityKind }),
    ...(row.enterpriseStage === undefined
      ? {}
      : { enterpriseStage: row.enterpriseStage }),
    ...(row.enterpriseSize === undefined
      ? {}
      : { enterpriseSize: row.enterpriseSize }),
    ...(row.educationLevel === undefined
      ? {}
      : { educationLevel: row.educationLevel }),
    annualFamilyIncomeLakhs: numberOr(
      row.annualFamilyIncomeLakhs,
      DEFAULTS.annualFamilyIncomeLakhs,
    ),
    priorGovernmentCapitalSubsidy: booleanOr(
      row.priorGovernmentCapitalSubsidy,
      DEFAULTS.priorGovernmentCapitalSubsidy,
    ),
    repaidMudraTarun: booleanOr(
      row.repaidMudraTarun,
      DEFAULTS.repaidMudraTarun,
    ),
    udyamRegistered: booleanOr(row.udyamRegistered, DEFAULTS.udyamRegistered),
  };
  return MatcherInputSchema.parse(merged);
}

export async function runBulkStack(
  payload: unknown,
  helpers: JobHelpers,
): Promise<void> {
  const { runId } = payloadSchema.parse(payload);
  const claimed = await helpers.query<{
    id: string;
    inputRows: Record<string, string>[];
    rulesetVersion: string;
  }>(
    `update bulk_stack_runs
     set status = 'running', error = null, updated_at = now()
     where id = $1::uuid and status in ('queued', 'failed')
     returning id::text, input_rows as "inputRows",
       ruleset_version as "rulesetVersion"`,
    [runId],
  );
  const run = claimed.rows[0];
  if (run === undefined) return;
  const asOf = new Date().toISOString().slice(0, 10);
  const results = run.inputRows.map((row, index) => {
    try {
      const input = matcherInputFromBulkRow(row);
      const evaluation = evaluatePinned(
        input,
        run.rulesetVersion || CURRENT_RULESET_VERSION,
        { asOf },
      );
      return {
        row: index + 1,
        businessName: row.businessName ?? '',
        district: input.district,
        sector: input.sector,
        totalLakhs: evaluation.totalLakhs,
        eligibleSchemeSlugs: evaluation.eligible.map(
          (scheme) => scheme.schemeId,
        ),
        warnings: evaluation.warnings,
      };
    } catch (error) {
      return {
        row: index + 1,
        businessName: row.businessName ?? '',
        district: row.district ?? '',
        sector: row.sector ?? '',
        totalLakhs: 0,
        eligibleSchemeSlugs: [],
        warnings: [
          error instanceof Error
            ? error.message
            : 'This row could not be evaluated.',
        ],
      };
    }
  });
  await helpers.query(
    `update bulk_stack_runs
     set status = 'ready', result_snapshot = $2::jsonb, error = null,
       updated_at = now()
     where id = $1::uuid`,
    [run.id, JSON.stringify(results)],
  );
}

function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim().length === 0) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanOr(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim().length === 0) return fallback;
  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
}
