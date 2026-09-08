import type { MetadataRoute } from 'next';
import { CITIES, CITY_SLUG, SITE_URL } from '@/lib/config';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/hall`, changeFrequency: 'weekly', priority: 0.7 },
    ...CITIES.map((c) => ({ url: `${SITE_URL}/schedule/${CITY_SLUG[c]}`, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
