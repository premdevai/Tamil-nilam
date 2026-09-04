import type { MetadataRoute } from 'next';

import {
  DISTRICTS,
  PLAYBOOKS,
  SECTORS,
  SITE_URL,
  schemeRecords,
} from '../lib/public-data';
import { publicLandSlugs, snapshotFetchedAt } from '../lib/tansidco-estates';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = snapshotFetchedAt().slice(0, 10);
  const paths = [
    '',
    '/land',
    '/schemes',
    '/methodology',
    '/sources',
    '/changelog',
    ...schemeRecords.map(({ id }) => `/schemes/${id}`),
    ...SECTORS.map(({ slug }) => `/schemes/sector/${slug}`),
    ...DISTRICTS.map(({ slug }) => `/schemes/district/${slug}`),
    ...publicLandSlugs().map((slug) => `/estates/${slug}`),
    ...PLAYBOOKS.map(({ slug }) => `/playbooks/${slug}`),
  ];

  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/land' ? 0.9 : 0.7,
  }));
}
