import { MatcherInputSchema, getRuleset } from '@nilam/engine';

import { DprList } from '../../../components/dpr-list';
import { DprWizard, type DprPrefill } from '../../../components/dpr-wizard';
import { queryPrefill } from '../../../lib/dpr-query-prefill';
import { BilingualHeading } from '../../../components/public-shell';
import { requireSession } from '../../../lib/authz';
import { evaluateMatcherSurface } from '../../../lib/matcher-surfaces';
import { isPaidEnabled } from '../../../lib/payment-gateway';
import { loadOwnedProject } from '../../../lib/project-memory';

export const dynamic = 'force-dynamic';

export default async function DprPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireSession(`/account/dpr${queryString(params)}`);
  const projectId = first(params.project);
  const project =
    projectId !== undefined
      ? await loadOwnedProject(projectId, session.user.id)
      : null;
  const initialProfile =
    project === null ? queryPrefill(params) : dprPrefill(project);
  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Detailed project report"
        title="Your DPR, ready for the bank"
        titleTa="வங்கிக்கு தயாரான உங்கள் திட்ட அறிக்கை"
      >
        <p className="lede">
          {isPaidEnabled()
            ? 'A bank-style report in Word and PDF, built from your numbers. Download it or email it straight to your bank branch or DIC.'
            : 'Paid DPR generation is not offered on this deployment.'}
        </p>
      </BilingualHeading>
      {isPaidEnabled() ? <DprWizard initialProfile={initialProfile} /> : null}
      <DprList userEmail={session.user.email ?? undefined} />
    </section>
  );
}

function queryString(
  params: Record<string, string | string[] | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = first(value);
    if (single !== undefined) search.set(key, single);
  }
  const text = search.toString();
  return text.length === 0 ? '' : `?${text}`;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dprPrefill(
  project: NonNullable<Awaited<ReturnType<typeof loadOwnedProject>>>,
): DprPrefill {
  const input = MatcherInputSchema.safeParse(project.inputs);
  if (!input.success) return {};
  const rupees = input.data.projectCostLakhs * 100_000;
  const facts = project.companion.readiness?.profileFacts ?? {};
  let citation: { title: string; url: string; verifiedOn: string } | undefined;
  try {
    getRuleset(project.rulesetVersion);
    citation = evaluateMatcherSurface(input.data, project.rulesetVersion)
      .eligible[0]?.citations[0];
  } catch {
    citation = undefined;
  }
  return {
    businessName: String(facts.businessName ?? project.name),
    promoterName: String(facts.promoterName ?? ''),
    sector: input.data.sector,
    district: input.data.district,
    projectCost: String(rupees),
    landAndBuildingCost: String(rupees * 0.2),
    plantAndMachineryCost: String(rupees * 0.5),
    otherFixedCost: String(rupees * 0.1),
    workingCapital: String(rupees * 0.2),
    promoterContribution: String(rupees * 0.25),
    termLoan: String(rupees * 0.75),
    otherFunding: '0',
    assumptions: project.assumptions
      .map((assumption) => `${assumption.label}: ${assumption.value}`)
      .join('\n'),
    ...(citation === undefined
      ? {}
      : {
          citationTitle: citation.title,
          citationUrl: citation.url,
          citationVerifiedOn: citation.verifiedOn,
        }),
  };
}
