import { createHash } from 'node:crypto';

import { z } from 'zod';

const money = z.number().finite().nonnegative().max(1_000_000_000_000);

export const citationSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    url: z.url(),
    verifiedOn: z.iso.date(),
    schemeSlug: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const dprFinancialInputSchema = z
  .object({
    businessName: z.string().trim().min(2).max(160),
    promoterName: z.string().trim().min(2).max(160),
    sector: z.string().trim().min(2).max(120),
    district: z.string().trim().min(2).max(120),
    projectCost: money.positive(),
    landAndBuildingCost: money,
    plantAndMachineryCost: money,
    otherFixedCost: money,
    workingCapital: money,
    promoterContribution: money,
    termLoan: money,
    otherFunding: money.default(0),
    projectedAnnualRevenue: money,
    projectedAnnualOperatingCost: money,
    employment: z.number().int().nonnegative().max(1_000_000),
    implementationMonths: z.number().int().min(1).max(120),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    citations: z.array(citationSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const costParts =
      value.landAndBuildingCost +
      value.plantAndMachineryCost +
      value.otherFixedCost +
      value.workingCapital;
    const funding =
      value.promoterContribution + value.termLoan + value.otherFunding;
    const tolerance = Math.max(1, value.projectCost * 0.001);
    if (Math.abs(costParts - value.projectCost) > tolerance) {
      context.addIssue({
        code: 'custom',
        path: ['projectCost'],
        message: 'Project cost must equal the itemised project costs.',
      });
    }
    if (Math.abs(funding - value.projectCost) > tolerance) {
      context.addIssue({
        code: 'custom',
        path: ['promoterContribution'],
        message: 'Funding sources must equal the project cost.',
      });
    }
    if (value.projectedAnnualOperatingCost > value.projectedAnnualRevenue) {
      context.addIssue({
        code: 'custom',
        path: ['projectedAnnualOperatingCost'],
        message:
          'Operating cost exceeds revenue; revise the estimate or document the loss-making period.',
      });
    }
  });

export type Citation = z.infer<typeof citationSchema>;
export type DprFinancialInput = z.infer<typeof dprFinancialInputSchema>;

export const dprSnapshotSchema = z
  .object({
    schemaVersion: z.literal('nilam-dpr-input-v1'),
    capturedAt: z.iso.datetime(),
    input: dprFinancialInputSchema,
    warnings: z.array(z.string().min(1).max(500)).max(50),
  })
  .strict();

export type DprSnapshot = z.infer<typeof dprSnapshotSchema>;

export const rulesetRuleSchema = z
  .object({
    schemeSlug: z.string().trim().min(1).max(120),
    version: z.number().int().positive(),
    verifiedOn: z.iso.date(),
    sourceUrl: z.url(),
  })
  .strict();

export const rulesetSnapshotSchema = z
  .object({
    rulesetVersion: z.string().trim().min(1).max(8_000),
    capturedAt: z.iso.datetime(),
    rules: z.array(rulesetRuleSchema).max(200),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type RulesetSnapshot = z.infer<typeof rulesetSnapshotSchema>;

export const businessProfileDataSchema = z
  .object({
    businessName: z.string().trim().min(2).max(160),
    promoterName: z.string().trim().min(2).max(160),
    sector: z.string().trim().min(2).max(120),
    district: z.string().trim().min(2).max(120),
    entityKind: z.string().trim().min(2).max(80).default('proprietorship'),
    notes: z.string().trim().max(2_000).default(''),
  })
  .strict();

export type BusinessProfileData = z.infer<typeof businessProfileDataSchema>;

export const printableReportInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    asOf: z.iso.date(),
    rulesetVersion: z.string().trim().min(1).max(40),
    matcherInput: z.record(z.string(), z.unknown()),
    clientWorkspaceId: z.uuid().optional(),
  })
  .strict();

export type PrintableReportInput = z.infer<typeof printableReportInputSchema>;

export function financialWarnings(input: DprFinancialInput): string[] {
  const warnings: string[] = [];
  const margin =
    input.projectedAnnualRevenue - input.projectedAnnualOperatingCost;
  if (
    input.projectedAnnualRevenue > 0 &&
    margin / input.projectedAnnualRevenue < 0.1
  ) {
    warnings.push(
      'Projected operating margin is below 10%; stress-test the assumptions.',
    );
  }
  if (input.promoterContribution / input.projectCost < 0.15) {
    warnings.push(
      'Promoter contribution is below 15%; a lender may require a higher margin.',
    );
  }
  if (input.assumptions.length === 0) {
    warnings.push('No supporting assumptions were supplied.');
  }
  return warnings;
}

export function createInputSnapshot(
  input: DprFinancialInput,
  capturedAt: string,
): DprSnapshot {
  return deepFreeze({
    schemaVersion: 'nilam-dpr-input-v1',
    capturedAt,
    input: structuredClone(input),
    warnings: financialWarnings(input),
  });
}

export function hashSnapshot(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export type PaidPlan = 'dpr_once' | 'pro' | 'consultant';
export type EntitlementKey =
  | 'dpr:create'
  | 'reports:print'
  | 'saves:unlimited'
  | 'bulk:run'
  | 'profiles:write'
  | 'clients:write'
  | 'audit:export';

export const PLAN_ENTITLEMENTS: Readonly<
  Record<PaidPlan, readonly EntitlementKey[]>
> = {
  dpr_once: ['dpr:create'],
  pro: [
    'dpr:create',
    'reports:print',
    'saves:unlimited',
    'bulk:run',
    'profiles:write',
    'audit:export',
  ],
  consultant: [
    'dpr:create',
    'reports:print',
    'saves:unlimited',
    'bulk:run',
    'profiles:write',
    'clients:write',
    'audit:export',
  ],
};

export const PLAN_LIMITS: Readonly<
  Record<
    PaidPlan,
    { profiles: number; clients: number; bulkRowsPerMonth: number }
  >
> = {
  dpr_once: { profiles: 0, clients: 0, bulkRowsPerMonth: 0 },
  pro: { profiles: 20, clients: 0, bulkRowsPerMonth: 500 },
  consultant: { profiles: 250, clients: 100, bulkRowsPerMonth: 5_000 },
};

export const FREE_SAVED_STACK_LIMIT = 5;
export const DOCUMENT_DOWNLOAD_TTL_SECONDS = 14 * 24 * 60 * 60;

export function usagePeriodKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function quotaRemaining(used: number, limit: number): number {
  return Math.max(0, limit - used);
}

export function createRulesetSnapshot(
  rules: RulesetSnapshot['rules'],
  capturedAt: string,
): RulesetSnapshot {
  const core = {
    rulesetVersion:
      rules.length === 0
        ? 'empty-ruleset'
        : `tn-${rules.map((rule) => `${rule.schemeSlug}@${rule.version}`).join(',')}`,
    capturedAt,
    rules: structuredClone(rules),
  };
  return deepFreeze({
    ...core,
    hash: hashSnapshot(core),
  });
}

export function subscriptionHasAccess(
  status: string,
  currentPeriodEnd: Date | null,
  gracePeriodEnd: Date | null,
  now = new Date(),
): boolean {
  if (status === 'active')
    return currentPeriodEnd === null || currentPeriodEnd > now;
  return (
    (status === 'past_due' || status === 'cancelled') &&
    gracePeriodEnd !== null &&
    gracePeriodEnd > now
  );
}

export function parseBulkStackCsv(csv: string, maximumRows: number) {
  const rows = csv
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  const headers = rows.shift();
  if (headers === undefined || headers.length === 0) {
    throw new Error('CSV must include a header row.');
  }
  if (rows.length > maximumRows) {
    throw new Error(`CSV exceeds the ${maximumRows} row limit.`);
  }
  const normalized = headers.map((header) => header.trim());
  const required = ['businessName', 'sector', 'district', 'projectCost'];
  for (const header of required) {
    if (!normalized.includes(header)) {
      throw new Error(`CSV is missing required column: ${header}`);
    }
  }
  return rows.map((row, rowIndex) => {
    if (row.length !== normalized.length) {
      throw new Error(`CSV row ${rowIndex + 2} has the wrong column count.`);
    }
    return Object.fromEntries(
      normalized.map((header, index) => [header, row[index] ?? '']),
    );
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  cells.push(current);
  return cells;
}

export {
  createDownloadSignature,
  verifyDownloadSignature,
  type DownloadClaims,
  type DownloadFormat,
} from './downloads';
export {
  buildPrintableReportModel,
  type PrintableReportSource,
} from './reports';
