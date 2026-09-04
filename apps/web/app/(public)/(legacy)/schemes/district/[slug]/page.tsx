import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BilingualHeading,
  JsonLd,
  StatusBadge,
} from '../../../../../../components/public-shell';
import {
  DISTRICTS,
  SITE_URL,
  getDistrict,
  schemeRecords,
} from '../../../../../../lib/public-data';
import { landForDistrict } from '../../../../../../lib/tansidco-estates';

type DistrictPageProps = {
  readonly params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return DISTRICTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: DistrictPageProps): Promise<Metadata> {
  const district = getDistrict((await params).slug);
  if (district === undefined) return {};
  return {
    title: `${district.name} district schemes and industrial land`,
    description: `Bilingual scheme status, cited sources and safe industrial land directory entries for ${district.name}, Tamil Nadu.`,
    alternates: { canonical: `/schemes/district/${district.slug}` },
  };
}

export default async function DistrictPage({ params }: DistrictPageProps) {
  const district = getDistrict((await params).slug);
  if (district === undefined) notFound();
  const localEstates = landForDistrict(district.name);

  return (
    <article className="content-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${district.name} district enterprise support`,
          url: `${SITE_URL}/schemes/district/${district.slug}`,
          spatialCoverage: {
            '@type': 'AdministrativeArea',
            name: `${district.name}, Tamil Nadu`,
          },
          inLanguage: ['en-IN', 'ta-IN'],
        }}
      />
      <BilingualHeading
        eyebrow="District guide · மாவட்ட வழிகாட்டி"
        title={`${district.name}: schemes and land`}
        titleTa={`${district.nameTa}: திட்டங்கள் மற்றும் தொழில் நிலம்`}
      >
        <p className="lede">
          Statewide and central rules still depend on project facts. District
          selection alone never proves eligibility.
        </p>
      </BilingualHeading>
      <section>
        <h2>Run this district through Matcher</h2>
        <p>
          Location class, backward-block status and other profile fields remain
          for you to confirm.
        </p>
        <Link
          className="button-link"
          href={`/?district=${encodeURIComponent(district.name)}`}
        >
          Prefill {district.name}
        </Link>
      </section>
      <section>
        <h2>Scheme verification register</h2>
        <div className="directory-grid">
          {schemeRecords.map((record) => (
            <article key={record.id}>
              <StatusBadge status={record.status} />
              <h3>
                <Link href={`/schemes/${record.id}`}>{record.name}</Link>
              </h3>
              <p lang="ta">{record.nameTa}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Industrial land in this district</h2>
        {localEstates.length === 0 ? (
          <p>
            No TANSIDCO vacancy-chart estate is in this snapshot for this
            district. That does not mean no estates exist — SIPCOT and empty
            TANSIDCO parks are absent from the chart.
          </p>
        ) : (
          localEstates.map((estate) => (
            <article className="evidence-card" key={estate.id}>
              <span
                className={
                  estate.dataQuality === 'vacancy-snapshot'
                    ? 'status-badge status-published'
                    : 'status-badge status-pending-review'
                }
              >
                {estate.vacantTotal === null
                  ? 'Availability unknown'
                  : `${estate.vacantTotal} vacant · ${estate.verifiedOn}`}
              </span>
              <h3>
                <Link href={`/estates/${estate.slug}`}>{estate.name}</Link>
              </h3>
              <p>{estate.summary}</p>
            </article>
          ))
        )}
        <Link
          className="text-link"
          href={`/land?district=${encodeURIComponent(district.name)}`}
        >
          Open land explorer →
        </Link>
      </section>
    </article>
  );
}
