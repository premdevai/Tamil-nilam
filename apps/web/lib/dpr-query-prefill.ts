import type { DprPrefill } from '../components/dpr-wizard';

const QUERY_PREFILL_KEYS = [
  'businessName',
  'promoterName',
  'sector',
  'district',
  'projectCost',
  'landAndBuildingCost',
  'plantAndMachineryCost',
  'otherFixedCost',
  'workingCapital',
  'promoterContribution',
  'termLoan',
  'otherFunding',
  'employment',
  'citationTitle',
  'citationUrl',
  'citationVerifiedOn',
] as const satisfies readonly (keyof DprPrefill)[];

/**
 * Prefill from a link such as the NEEDS guided path. Only whitelisted keys are
 * read, values are length-capped, and the wizard's schema still validates
 * everything before a DPR is generated.
 */
export function queryPrefill(
  params: Record<string, string | string[] | undefined>,
): DprPrefill {
  const prefill: DprPrefill = {};
  for (const key of QUERY_PREFILL_KEYS) {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value !== undefined && value.length > 0 && value.length <= 200) {
      prefill[key] = value;
    }
  }
  return prefill;
}
