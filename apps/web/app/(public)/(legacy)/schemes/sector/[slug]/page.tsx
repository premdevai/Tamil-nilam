import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BilingualHeading,
  JsonLd,
  StatusBadge,
} from '../../../../../../components/public-shell';
import {
  SECTORS,
  SITE_URL,
  getSector,
  schemeRecords,
} from '../../../../../../lib/public-data';

type SectorPageProps = {
  readonly params: Promise<{ slug: string }>;
};

const related: Readonly<Record<string, readonly string[]>> = {
  'food-processing': ['pmfme', 'pmegp', 'aif', 'mofpi-cefppc'],
  manufacturing: [
    'needs',
    'pmegp',
    'cgtmse',
    'tiic-general',
    'tn-capital-subsidy',
  ],
  services: ['needs', 'pmegp', 'mudra', 'tiic-general'],
  'agri-infrastructure': ['aif', 'pmfme', 'tn-agri-value-addition-100'],
};

export const dynamicParams = false;

export function generateStaticParams() {
  return SECTORS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: SectorPageProps): Promise<Metadata> {
  const sector = getSector((await params).slug);
  if (sector === undefined) return {};
  return {
    title: `${sector.name} schemes`,
    description: `${sector.name} enterprise schemes in Tamil Nadu with bilingual status and primary citations.`,
    alternates: { canonical: `/schemes/sector/${sector.slug}` },
  };
}

export default async function SectorPage({ params }: SectorPageProps) {
  const sector = getSector((await params).slug);
  if (sector === undefined) notFound();
  const records = (related[sector.slug] ?? [])
    .map((id) => schemeRecords.find((record) => record.id === id))
    .filter((record) => record !== undefined);

  return (
    <article className="content-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${sector.name} schemes`,
          url: `${SITE_URL}/schemes/sector/${sector.slug}`,
          inLanguage: ['en-IN', 'ta-IN'],
        }}
      />
      <BilingualHeading
        eyebrow="Sector guide · துறை வழிகாட்டி"
        title={`${sector.name} schemes`}
        titleTa={`${sector.nameTa} திட்டங்கள்`}
      >
        <p className="lede">{sector.description}</p>
      </BilingualHeading>
      <section>
        <h2>Evidence register</h2>
        <p>
          Status is explicit: pending and retired records appear for context but
          never produce a calculated benefit.
        </p>
        <div className="directory-grid">
          {records.map((record) => (
            <article key={record.id}>
              <StatusBadge status={record.status} />
              <h3>
                <Link href={`/schemes/${record.id}`}>{record.name}</Link>
              </h3>
              <p lang="ta">{record.nameTa}</p>
              <p>{record.department}</p>
            </article>
          ))}
        </div>
      </section>
      <Link className="button-link" href={`/?sector=${sector.slug}`}>
        Match a {sector.name.toLowerCase()} project
      </Link>
    </article>
  );
}
