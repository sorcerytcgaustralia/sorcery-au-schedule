import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomePage } from '@/components/HomePage';
import snapshot from '@/data/site-data.json';
import { CITIES, CITY_SLUG, cityFromSlug } from '@/lib/config';
import { cityEventCount } from '@/lib/events';
import type { SiteData } from '@/lib/sheet/types';

// One pre-rendered page per city, so "Sorcery TCG Melbourne" has a URL of
// its own to share and to be found by. Same page, city pinned.

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: CITY_SLUG[c] }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = cityFromSlug((await params).city);
  if (!city) return {};
  const n = cityEventCount(snapshot as SiteData, city);
  const description = `Sorcery: Contested Realm organised play in ${city}: ${n} regular ${n === 1 ? 'table' : 'tables'} each week, plus tournaments, local stores and the Australian community Discord.`;
  return {
    title: `Sorcery TCG in ${city}`,
    description,
    alternates: { canonical: `/schedule/${CITY_SLUG[city]}` },
    openGraph: { title: `Sorcery TCG in ${city} · Realm of Oz`, description, url: `/schedule/${CITY_SLUG[city]}` },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const city = cityFromSlug((await params).city);
  if (!city) notFound();
  return <HomePage snapshot={snapshot as SiteData} initialCity={city} />;
}
