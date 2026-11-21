import { TAMIL_NADU_DISTRICTS } from '@nilam/engine';
import type { Metadata } from 'next';

import { NeedsPath, type NeedsEstate } from '../../components/needs-path';
import { BilingualHeading } from '../../components/public-shell';
import snapshot from '../../data/tansidco.json';
import { NEEDS_SOURCES, NEEDS_VERIFIED_ON } from '../../lib/needs-path';
import {
  getPublicLandCatalog,
  snapshotFetchedAt,
  tansidcoApplyUrl,
} from '../../lib/tansidco-estates';

export const metadata: Metadata = {
  title: 'NEEDS guided path',
  description:
    'Pick a NEEDS-ready business, see your 5–10% contribution, find TANSIDCO land and follow every step from Udyam to first production.',
  alternates: { canonical: '/needs' },
};

type RawPlot = {
  readonly type: string;
  readonly costRs: number | null;
  readonly extent: number | null;
};
type RawEstate = {
  readonly id: number;
  readonly vacant: { readonly industrialPlot?: number; readonly shed?: number };
  readonly plots?: readonly RawPlot[];
  readonly record?: { readonly phone?: string };
};

function needsEstates(): readonly NeedsEstate[] {
  const raw = new Map(
    (snapshot.estates as readonly RawEstate[]).map((estate) => [
      estate.id,
      estate,
    ]),
  );
  return getPublicLandCatalog()
    .filter((estate) => estate.snapshotId !== null)
    .map((estate) => {
      const source = raw.get(estate.snapshotId ?? -1);
      const industrial = (source?.plots ?? []).filter(
        (plot) =>
          plot.type === 'Industrial Plot' && typeof plot.costRs === 'number',
      );
      const cheapest = industrial.reduce<RawPlot | undefined>(
        (best, plot) =>
          best === undefined ||
          (plot.costRs ?? Infinity) < (best.costRs ?? Infinity)
            ? plot
            : best,
        undefined,
      );
      return {
        name: estate.name,
        district: estate.district,
        block: estate.block,
        backward: estate.backward,
        industrialPlots: source?.vacant.industrialPlot ?? 0,
        sheds: source?.vacant.shed ?? 0,
        cheapestPlotRs: cheapest?.costRs ?? null,
        cheapestPlotAcres: cheapest?.extent ?? null,
        phone: source?.record?.phone ?? null,
      };
    });
}

export default function NeedsPage() {
  return (
    <section className="content-page needs-page">
      <BilingualHeading
        eyebrow="NEEDS guided path"
        title="No money? You can still start a factory."
        titleTa="பணம் இல்லையா? பரவாயில்லை — நாங்கள் வழிகாட்டுகிறோம்."
      >
        <p className="lede">
          Under Tamil Nadu’s NEEDS scheme you bring only 5–10% of the project
          cost. The bank lends the rest and the State credits a 25% capital
          subsidy against the loan once you start. Pick a business below and we
          walk you through every step — Udyam to first production.
        </p>
      </BilingualHeading>
      <NeedsPath
        districts={TAMIL_NADU_DISTRICTS}
        estates={needsEstates()}
        landSnapshotDate={snapshotFetchedAt().slice(0, 10)}
        tansidcoUrl={tansidcoApplyUrl()}
      />
      <p className="needs-sources">
        Rules checked {NEEDS_VERIFIED_ON} against{' '}
        <a href={NEEDS_SOURCES.scheme.url} rel="noreferrer" target="_blank">
          {NEEDS_SOURCES.scheme.title}
        </a>
        , the{' '}
        <a href={NEEDS_SOURCES.dic.url} rel="noreferrer" target="_blank">
          {NEEDS_SOURCES.dic.title}
        </a>{' '}
        and{' '}
        <a href={NEEDS_SOURCES.tiic.url} rel="noreferrer" target="_blank">
          {NEEDS_SOURCES.tiic.title}
        </a>
        . Directional guidance only — the DIC, bank or TIIC decides eligibility
        and sanction.
      </p>
    </section>
  );
}
