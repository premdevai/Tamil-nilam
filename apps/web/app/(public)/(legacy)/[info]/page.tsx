import {
  CORPUS_VERIFIED_ON,
  CURRENT_RULESET,
  PINNED_RULESETS,
} from '@nilam/engine';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BilingualHeading, JsonLd } from '../../../../components/public-shell';
import { SITE_URL, schemeRecords } from '../../../../lib/public-data';

const INFO = {
  methodology: {
    title: 'How NILAM decides what to show',
    titleTa: 'NILAM எதை காட்ட வேண்டும் என்பதை எவ்வாறு தீர்மானிக்கிறது',
    description:
      'Verification, calculation, conflict and safe-fallback methodology.',
  },
  sources: {
    title: 'Primary source register',
    titleTa: 'முதன்மை ஆதாரப் பதிவு',
    description:
      'Government portals, guidelines and documents cited by the current scheme corpus.',
  },
  changelog: {
    title: 'Ruleset changelog',
    titleTa: 'விதித்தொகுப்பு மாற்றப் பதிவு',
    description:
      'Versioned changes that can alter eligibility, deadlines or directional estimates.',
  },
} as const;

type InfoSlug = keyof typeof INFO;
type InfoPageProps = { readonly params: Promise<{ info: string }> };

function isInfoSlug(value: string): value is InfoSlug {
  return value in INFO;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(INFO).map((info) => ({ info }));
}

export async function generateMetadata({
  params,
}: InfoPageProps): Promise<Metadata> {
  const { info } = await params;
  if (!isInfoSlug(info)) return {};
  return {
    title: INFO[info].title,
    description: INFO[info].description,
    alternates: { canonical: `/${info}` },
  };
}

export default async function InfoPage({ params }: InfoPageProps) {
  const { info } = await params;
  if (!isInfoSlug(info)) notFound();
  const copy = INFO[info];

  return (
    <article className="content-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: copy.title,
          url: `${SITE_URL}/${info}`,
          dateModified: CORPUS_VERIFIED_ON,
          inLanguage: ['en-IN', 'ta-IN'],
        }}
      />
      <BilingualHeading
        eyebrow="NILAM evidence desk"
        title={copy.title}
        titleTa={copy.titleTa}
      >
        <p className="lede">{copy.description}</p>
      </BilingualHeading>
      {info === 'methodology' ? <Methodology /> : null}
      {info === 'sources' ? <Sources /> : null}
      {info === 'changelog' ? <Changelog /> : null}
    </article>
  );
}

function Methodology() {
  return (
    <>
      <section>
        <p className="eyebrow">01 · Publication boundary</p>
        <h2>Only reviewed rules calculate</h2>
        <p>
          A published rule needs a primary citation, verification date, closed
          input contract and named eligibility predicates. Pending records stay
          visible so users can see coverage gaps, but they have no executable
          benefit function and add nothing to a result.
        </p>
      </section>
      <section>
        <p className="eyebrow">02 · Directional calculation</p>
        <h2>Supplied eligible cost is not sanctioned cost</h2>
        <p>
          The engine applies cited formulas only after eligibility passes.
          Non-cash credit access and interest support without a repayment
          schedule are described but not converted into rupees. The stack total
          cannot exceed the supplied project cost.
        </p>
      </section>
      <section>
        <p className="eyebrow">03 · Conflicts and time</p>
        <h2>Rulesets are pinned and conflicts are explained</h2>
        <p>
          Exclusive schemes are resolved deterministically. Caution and unknown
          compatibility are surfaced for written confirmation. Shared URLs pin a
          ruleset so historic links remain reproducible.
        </p>
      </section>
      <section>
        <p className="eyebrow">04 · Land safety</p>
        <h2>Fallback never becomes vacancy</h2>
        <p>
          PostGIS records can expose published geometry and plot status.
          Directory fallbacks expose only an approximate estate point, source
          URL and check date; status is always unknown and rates are omitted.
        </p>
      </section>
    </>
  );
}

function Sources() {
  const citations = new Map(
    schemeRecords.flatMap((record) =>
      record.citations.map((citation) => [citation.id, citation] as const),
    ),
  );
  return (
    <section>
      <p>
        Corpus last checked {CORPUS_VERIFIED_ON}. A verification date records
        when NILAM checked the source; it does not guarantee the authority has
        not changed an unannounced page since.
      </p>
      <ol className="source-list">
        {[...citations.values()].map((citation) => (
          <li key={citation.id}>
            <a href={citation.url} target="_blank" rel="noreferrer">
              {citation.title}
            </a>
            <span>
              {citation.issuingAuthority} · verified {citation.verifiedOn}
              {citation.documentDate === undefined
                ? ''
                : ` · document ${citation.documentDate}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Changelog() {
  return (
    <>
      {[...Object.values(PINNED_RULESETS)].reverse().map((ruleset) => (
        <section className="changelog-entry" key={ruleset.version}>
          <p className="eyebrow">
            Ruleset {ruleset.version}
            {ruleset === CURRENT_RULESET ? ' · current' : ' · historic'}
          </p>
          <h2>Effective {ruleset.effectiveFrom}</h2>
          <ul>
            {ruleset.changelog.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
