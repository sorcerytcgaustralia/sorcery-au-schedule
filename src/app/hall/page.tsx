import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { HallList } from '@/components/Hall';
import { SiteDataProvider } from '@/components/SiteDataProvider';
import { SiteNav } from '@/components/SiteNav';
import snapshot from '@/data/site-data.json';
import type { SiteData } from '@/lib/sheet/types';

export const metadata: Metadata = {
  title: 'Hall of Fame',
  description: 'Champions and top finishes from Sorcery: Contested Realm tournaments across Australia, with the decks they played.',
  alternates: { canonical: '/hall' },
  openGraph: { title: 'Hall of Fame, Sorcery TCG Australia', url: '/hall' },
};

export default function HallPage() {
  return (
    <SiteDataProvider snapshot={snapshot as SiteData}>
      <SiteNav home={false} />
      <main>
        <section className="hall" aria-label="Hall of Fame">
          <div className="hall-inner">
            <h1 className="hall-title">Hall of Fame</h1>
            <p className="hall-standfirst">Every tournament the community has run, and the sorcerers who took it. Decks link through to SorceryTCG.</p>
            <HallList />
          </div>
        </section>
      </main>
      <Footer variant="hall" />
    </SiteDataProvider>
  );
}
