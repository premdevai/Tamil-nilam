import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BilingualHeading,
  JsonLd,
  StatusBadge,
} from '../../../../../components/public-shell';
import {
  SITE_URL,
  STATUS_COPY,
  getScheme,
  schemeRecords,
} from '../../../../../lib/public-data';

type SchemePageProps = {
  readonly params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return schemeRecords.map((scheme) => ({ slug: scheme.id }));
}

export async function generateMetadata({
  params,
}: SchemePageProps): Promise<Metadata> {
  const { slug } = await params;
  const scheme = getScheme(slug);
  if (scheme === undefined) return {};
  const status = STATUS_COPY[scheme.status].label;
  return {
    title: scheme.name,
    description: `${scheme.name}: ${status}. Read Tamil and English status, evidence and primary sources.`,
    alternates: { canonical: `/schemes/${scheme.id}` },
    openGraph: {
      title: `${scheme.name} — ${status}`,
      description: STATUS_COPY[scheme.status].explanation,
      url: `/schemes/${scheme.id}`,
    },
  };
}

export default async function SchemePage({ params }: SchemePageProps) {
  const { slug } = await params;
  const scheme = getScheme(slug);
  if (scheme === undefined) notFound();
  const status = STATUS_COPY[scheme.status];

  return (
    <article className="content-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'GovernmentService',
          name: scheme.name,
          alternateName: scheme.nameTa,
          serviceType: 'Enterprise support programme',
          provider: {
            '@type': 'GovernmentOrganization',
            name: scheme.department,
          },
          url: `${SITE_URL}/schemes/${scheme.id}`,
          inLanguage: ['en-IN', 'ta-IN'],
          isRelatedTo: scheme.citations.map((citation) => citation.url),
        }}
      />
      <BilingualHeading
        eyebrow={`${scheme.level} scheme · ${scheme.department}`}
        title={scheme.name}
        titleTa={scheme.nameTa}
      >
        <StatusBadge status={scheme.status} />
        <p className="lede">{status.explanation}</p>
      </BilingualHeading>

      {scheme.status === 'published' ? (
        <>
          <section>
            <p className="eyebrow">Matcher contract</p>
            <h2>What NILAM checks</h2>
            <ul className="evidence-list">
              {scheme.eligibility.map((predicate) => (
                <li key={predicate.id}>{predicate.label}</li>
              ))}
            </ul>
            <p>
              NILAM calculates benefits only after every applicable predicate,
              including a live deadline, passes. Inputs remain estimates until
              the authority confirms eligible cost.
            </p>
            <Link className="button-link" href={`/?sector=manufacturing`}>
              Check my project
            </Link>
          </section>
          <section>
            <p className="eyebrow">Application path</p>
            <h2>Sequence in the current ruleset</h2>
            <ol className="sequence-list">
              {scheme.steps.map((step) => (
                <li key={step.id}>
                  <strong>{step.title}</strong>
                  <span>{step.organisation}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <p className="eyebrow">Limits</p>
            <h2>Read before relying on a result</h2>
            <ul>
              {scheme.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="non-calculating">
          <p className="eyebrow">Excluded from calculations</p>
          <h2>
            {scheme.status === 'retired'
              ? 'Historical record only'
              : 'Primary evidence is incomplete'}
          </h2>
          <p>{scheme.reviewReason}</p>
          <p>
            <strong>
              No eligibility decision or monetary benefit is generated from this
              record.
            </strong>
          </p>
        </section>
      )}

      <section>
        <p className="eyebrow">Citation trail</p>
        <h2>Primary sources</h2>
        <ol className="source-list">
          {scheme.citations.map((citation) => (
            <li key={citation.id}>
              <a href={citation.url} target="_blank" rel="noreferrer">
                {citation.title}
              </a>
              <span>
                {citation.issuingAuthority} · verified {citation.verifiedOn}
                {citation.locator === undefined ? '' : ` · ${citation.locator}`}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
