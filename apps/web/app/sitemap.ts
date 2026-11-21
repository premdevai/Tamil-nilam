import type { MetadataRoute } from 'next';

import { SITE_URL } from '../lib/public-data';
import { snapshotFetchedAt } from '../lib/tansidco-estates';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = snapshotFetchedAt().slice(0, 10);
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/needs`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
