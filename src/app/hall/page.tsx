import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { HallLedger } from '@/components/Hall';
import { SiteDataProvider } from '@/components/SiteDataProvider';
import { SiteNav } from '@/components/SiteNav';
import snapshot from '@/data/site-data.json';
import { ALL } from '@/lib/events';
import type { SiteData } from '@/lib/sheet/types';

export const metadata: Metadata = {
  title: 'Hall of Fame',
  description: 'Champions and top finishes from Sorcery: Contested Realm tournaments across Australia, with the decks they played.',
  alternates: { canonical: '/hall' },
  openGraph: { title: 'Hall of Fame · Realm of Oz', url: '/hall' },
};

export default function HallPage() {
  const data = snapshot as SiteData;
  return (
    <SiteDataProvider snapshot={data} initialCity={ALL}>
      <SiteNav />
      <header className="wrap page-head">
        <p className="crumbs mono">
          <Link href="/">Realm of Oz</Link> · Hall of Fame
        </p>
        <h1 className="page-title">
          The Hall
          <br />
          of Fame
        </h1>
        <p className="page-stand">Every tournament the community has run and the sorcerers who took it. The top four are ranked; the rest of the top eight stand together, since below the cut the order is only a tiebreak.</p>
      </header>
      <main className="section paper" style={{ marginTop: 40 }}>
        <div className="wrap">
          <HallLedger />
        </div>
      </main>
      <Footer fetchedAt={data.fetchedAt} />
    </SiteDataProvider>
  );
}
