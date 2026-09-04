import { MatcherInputSchema, getRuleset } from '@nilam/engine';

import { DprWizard, type DprPrefill } from '../../../components/dpr-wizard';
import { BilingualHeading } from '../../../components/public-shell';
import { requireSession } from '../../../lib/authz';
import { evaluateMatcherSurface } from '../../../lib/matcher-surfaces';
import { loadOwnedProject } from '../../../lib/project-memory';

export const dynamic = 'force-dynamic';

export default async function DprPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const projectId = first((await searchParams).project);
  const project =
    projectId !== undefined
      ? await loadOwnedProject(projectId, session.user.id)
      : null;
  const initialProfile = project === null ? {} : dprPrefill(project);
  return (
    <section className="content-page account-page">
      <BilingualHeading
        eyebrow="Detailed project report"
        title="Guided financial inputs"
        titleTa="வழிகாட்டப்பட்ட நிதி உள்ளீடுகள்"
      >
        <p className="lede">
          Cost and funding must balance. Generated files freeze the inputs and
          ruleset, then expire after a signed download window.
        </p>
      </BilingualHeading>
      <DprWizard initialProfile={initialProfile} />
    </section>
  );
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
