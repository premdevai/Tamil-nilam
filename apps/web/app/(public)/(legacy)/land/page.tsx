import type { Metadata } from 'next';

import { LandExplorer } from '../../../../components/land-explorer';
import { BilingualHeading, JsonLd } from '../../../../components/public-shell';
import { SITE_URL } from '../../../../lib/public-data';

export const metadata: Metadata = {
  title: 'Tamil Nadu industrial land explorer',
  description:
    'Filter cited industrial estate and plot records by district, agency, status and source age, with safe fallback data.',
  alternates: { canonical: '/land' },
};

export default async function LandPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const value = (await searchParams).district;
  const initialDistrict = Array.isArray(value) ? value[0] : value;

  return (
    <>
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'NILAM Tamil Nadu industrial land explorer',
          description:
            'Published industrial estate and plot records with source dates and explicit fallback quality labels.',
          url: `${SITE_URL}/land`,
          spatialCoverage: 'Tamil Nadu, India',
          inLanguage: ['en-IN', 'ta-IN'],
        }}
      />
      <BilingualHeading
        eyebrow="Land explorer · தொழில் நிலத் தேடல்"
        title="Map the evidence, not just the marker."
        titleTa="குறியீட்டை மட்டும் அல்ல, ஆதாரத்தையும் வரைபடத்தில் காணுங்கள்."
      >
        <p className="lede">
          PostGIS filters return published plot facts when available. If the
          database or geometry is unavailable, NILAM falls back to
          directory-only points and marks every availability status unknown.
        </p>
      </BilingualHeading>
      <LandExplorer
        {...(initialDistrict === undefined ? {} : { initialDistrict })}
      />
    </>
  );
}
