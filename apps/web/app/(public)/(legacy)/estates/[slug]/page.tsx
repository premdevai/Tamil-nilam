import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BilingualHeading,
  JsonLd,
} from '../../../../../components/public-shell';
import { WatchEstateButton } from '../../../../../components/watch-estate-button';
import { SITE_URL } from '../../../../../lib/public-data';
import {
  getPublicLandEstate,
  publicLandSlugs,
} from '../../../../../lib/tansidco-estates';

type EstatePageProps = {
  readonly params: Promise<{ slug: string }>;
};

export const dynamicParams = true;

export function generateStaticParams() {
  return publicLandSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: EstatePageProps): Promise<Metadata> {
  const estate = getPublicLandEstate((await params).slug);
  if (estate === undefined) return {};
  return {
    title: `${estate.name} industrial estate`,
    description: estate.summary,
    alternates: { canonical: `/estates/${estate.slug}` },
  };
}

export default async function EstatePage({ params }: EstatePageProps) {
  const requested = (await params).slug;
  const estate = getPublicLandEstate(requested);
  if (estate === undefined) notFound();
  const snapshot = estate.dataQuality === 'vacancy-snapshot';

  return (
    <article className="content-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: estate.name,
          alternateName: estate.nameTa,
          url: `${SITE_URL}/estates/${estate.slug}`,
          ...(estate.latitude === null || estate.longitude === null
            ? {}
            : {
                geo: {
                  '@type': 'GeoCoordinates',
                  latitude: estate.latitude,
                  longitude: estate.longitude,
                },
              }),
          address: {
            '@type': 'PostalAddress',
            addressRegion: 'Tamil Nadu',
            addressLocality: estate.district,
            addressCountry: 'IN',
          },
        }}
      />
      <BilingualHeading
        eyebrow={`${estate.agency.toUpperCase()} · ${estate.district}`}
        title={estate.name}
        titleTa={estate.nameTa}
      >
        <span
          className={
            snapshot
              ? 'status-badge status-published'
              : 'status-badge status-pending-review'
          }
        >
          {snapshot
            ? `TANSIDCO vacancy snapshot · ${estate.verifiedOn}`
            : 'Directory only · availability unknown'}
        </span>
        <p className="lede">{estate.summary}</p>
      </BilingualHeading>
      <section className="fact-grid">
        <div>
          <span>Plot availability</span>
          <strong>
            {estate.vacantTotal === null
              ? 'Unknown'
              : `${estate.vacantTotal} vacant on chart`}
          </strong>
        </div>
        <div>
          <span>Block</span>
          <strong>{estate.block ?? 'Not published'}</strong>
        </div>
        <div>
          <span>Backward-block flag</span>
          <strong>{estate.backward ? 'Yes (source flag)' : 'No'}</strong>
        </div>
        <div>
          <span>Snapshot date</span>
          <strong>{estate.verifiedOn}</strong>
        </div>
      </section>
      <section>
        <h2>Evidence limits</h2>
        <p>
          {snapshot
            ? 'Vacant counts and rates come from the TANSIDCO vacancy chart on the snapshot date. They are not an allotment letter. SIPCOT and SIDCO estates are not in this chart.'
            : 'This entry only proves the estate exists in a directory. Live plot availability, rates and boundaries are not asserted.'}
        </p>
        <div className="card-actions">
          <a href={estate.sourceUrl} target="_blank" rel="noreferrer">
            Open source
          </a>
          <Link
            href={`/?district=${encodeURIComponent(estate.district)}&estate=${estate.slug}`}
          >
            Prefill Matcher
          </Link>
          <Link href={`/land?district=${encodeURIComponent(estate.district)}`}>
            View on land explorer
          </Link>
          <WatchEstateButton slug={estate.slug} />
        </div>
      </section>
    </article>
  );
}
