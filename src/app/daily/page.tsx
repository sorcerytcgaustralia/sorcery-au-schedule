import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Realmdle } from '@/components/Realmdle';
import { SiteNav } from '@/components/SiteNav';
import cards from '@/data/cards.json';
import type { CardData } from '@/lib/realmdle/types';

export const metadata: Metadata = {
  title: 'Realmdle, the daily card',
  description: 'Guess the Sorcery: Contested Realm card of the day in eight tries. A new card every midnight, Sydney time.',
  alternates: { canonical: '/daily' },
  openGraph: { title: 'Realmdle, Sorcery TCG Australia', url: '/daily' },
};

export default function DailyPage() {
  return (
    <>
      <SiteNav home={false} page="daily" />
      <main>
        <section className="hall" aria-label="Realmdle">
          <div className="hall-inner">
            <h1 className="hall-title">Realmdle</h1>
            <p className="hall-standfirst">
              Guess today&rsquo;s Sorcery card in eight tries. Each guess shows how close its element, type, cost, power, rarity and set are to the answer. A new card every
              midnight, Sydney time.
            </p>
            <Realmdle data={cards as CardData} />
          </div>
        </section>
      </main>
      <Footer variant="daily" />
    </>
  );
}
