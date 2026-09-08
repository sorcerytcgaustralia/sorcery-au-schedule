import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { RecordFull } from '@/components/Record';
import { SiteDataProvider } from '@/components/SiteDataProvider';
import { SiteNav } from '@/components/SiteNav';
import snapshot from '@/data/site-data.json';
import type { SiteData } from '@/lib/sheet/types';

export const metadata: Metadata = {
  title: 'The Record',
  description: 'Every Sorcery: Contested Realm tournament run in Australia, its champion, podium and the decks they played.',
  alternates: { canonical: '/hall' },
  openGraph: { title: 'The Record, Sorcery TCG Australia', url: '/hall' },
};

export default function HallPage() {
  return (
    <SiteDataProvider snapshot={snapshot as SiteData}>
      <SiteNav home={false} />
      <main className="page">
        <div className="page-inner">
          <p className="crumbs">
            <Link href="/">The Realm</Link>
          </p>
          <h1 className="statement">The Record</h1>
          <p className="lede">Every tournament the community has run, the sorcerers who took it, and the decks they played. The top four are ranked; the rest of the top eight stand together.</p>
          <RecordFull />
        </div>
      </main>
      <Footer />
    </SiteDataProvider>
  );
}
