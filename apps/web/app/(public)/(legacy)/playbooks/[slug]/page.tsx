import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlaybookProgress } from '../../../../../components/playbook-progress';
import {
  BilingualHeading,
  JsonLd,
} from '../../../../../components/public-shell';
import {
  PLAYBOOKS,
  SITE_URL,
  getPlaybook,
} from '../../../../../lib/public-data';

type PlaybookPageProps = {
  readonly params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return PLAYBOOKS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PlaybookPageProps): Promise<Metadata> {
  const playbook = getPlaybook((await params).slug);
  if (playbook === undefined) return {};
  return {
    title: playbook.title,
    description: playbook.description,
    alternates: { canonical: `/playbooks/${playbook.slug}` },
  };
}

export default async function PlaybookPage({ params }: PlaybookPageProps) {
  const playbook = getPlaybook((await params).slug);
  if (playbook === undefined) notFound();

  return (
    <article className="content-page">
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: playbook.title,
          description: playbook.description,
          url: `${SITE_URL}/playbooks/${playbook.slug}`,
          inLanguage: ['en-IN', 'ta-IN'],
          step: playbook.steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            text: step,
          })),
        }}
      />
      <BilingualHeading
        eyebrow="Playbook · செயல்வழிகாட்டி"
        title={playbook.title}
        titleTa={playbook.titleTa}
      >
        <p className="lede">{playbook.description}</p>
      </BilingualHeading>
      <div className="alert">
        <strong>A checklist is not an approval.</strong>
        <p>
          Verify live deadlines, land facts and authority decisions at the
          linked primary source.
        </p>
      </div>
      <PlaybookProgress slug={playbook.slug} steps={playbook.steps} />
    </article>
  );
}
