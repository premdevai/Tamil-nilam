import type { Metadata } from 'next';
import Link from 'next/link';

import {
  BilingualHeading,
  JsonLd,
  StatusBadge,
} from '../../../../components/public-shell';
import {
  DISTRICTS,
  SECTORS,
  SITE_URL,
  schemeRecords,
} from '../../../../lib/public-data';

export const metadata: Metadata = {
  title: 'Tamil Nadu scheme evidence register',
  description:
    'Browse 24 cited enterprise scheme records by verification status, sector and district in English and Tamil.',
  alternates: { canonical: '/schemes' },
};

export default function SchemesPage() {
  return (
    <article className="content-page directory-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'NILAM scheme evidence register',
          url: `${SITE_URL}/schemes`,
          inLanguage: ['en-IN', 'ta-IN'],
          numberOfItems: schemeRecords.length,
        }}
      />
      <BilingualHeading
        eyebrow="24 cited records · 24 ஆதாரப் பதிவுகள்"
        title="Scheme evidence register"
        titleTa="திட்ட ஆதாரப் பதிவு"
      >
        <p className="lede">
          Browse verified, pending and retired programmes. Only verified rules
          can enter Matcher calculations.
        </p>
      </BilingualHeading>
      <section>
        <h2>All scheme records</h2>
        <div className="directory-grid">
          {schemeRecords.map((record) => (
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
      <section>
        <h2>Browse by sector</h2>
        <div className="directory-grid">
          {SECTORS.map((sector) => (
            <article key={sector.slug}>
              <h3>
                <Link href={`/schemes/sector/${sector.slug}`}>
                  {sector.name}
                </Link>
              </h3>
              <p lang="ta">{sector.nameTa}</p>
              <p>{sector.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Browse by district</h2>
        <div className="district-links">
          {DISTRICTS.map((district) => (
            <Link
              href={`/schemes/district/${district.slug}`}
              key={district.slug}
            >
              {district.name} · <span lang="ta">{district.nameTa}</span>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
