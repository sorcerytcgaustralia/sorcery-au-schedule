'use client';

// The Australian meta as a catalogue: the five avatar plates set at
// different sizes, each with a museum label and the deck currently
// recorded against it in the sheet.

import { ART_CREDITS, CURIOSA_PROFILE_URL } from '@/lib/config';
import { useSiteData } from './SiteDataProvider';

const PLATES = [
  { key: 'imposter', file: 'imposter.webp', name: 'Imposter', size: 'lg' },
  { key: 'archimago', file: 'archimago.webp', name: 'Archimago', size: 'md' },
  { key: 'air', file: 'avatar-of-air.webp', name: 'Avatar of Air', size: 'md' },
  { key: 'pathfinder', file: 'pathfinder.webp', name: 'Pathfinder', size: 'sm' },
  { key: 'necromancer', file: 'necromancer.webp', name: 'Necromancer', size: 'sm' },
];

export function Meta() {
  const { data } = useSiteData();
  const deckFor = (key: string) => data.featured.find((d) => d.card.toLowerCase().includes(key)) ?? null;
  const listed = PLATES.map((p) => deckFor(p.key)).filter(Boolean).length;
  return (
    <section className="meta" id="meta" aria-labelledby="meta-title">
      <div className="meta-inner">
        <div className="meta-head">
          <h2 className="h2" id="meta-title">
            The Australian Meta
          </h2>
          <p className="head-note">
            {listed > 0 ? `${listed} ${listed === 1 ? 'deck' : 'decks'} currently recorded against the avatars seeing play.` : 'The avatars of the realm. Decks appear here as results are recorded.'}{' '}
            <a href={CURIOSA_PROFILE_URL} target="_blank" rel="noopener">
              Every deck on Curiosa
            </a>
          </p>
        </div>
        <div className="catalogue">
          {PLATES.map((p, i) => {
            const deck = deckFor(p.key);
            return (
              <figure key={p.key} className={`work work-${p.size} work-${i + 1}`}>
                {deck?.link ? (
                  <a href={deck.link} target="_blank" rel="noopener" className="work-art" aria-label={`${deck.deck || p.name}, view the deck on Curiosa`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/art/cards/${p.file}`} alt="" loading="lazy" decoding="async" />
                  </a>
                ) : (
                  <span className="work-art">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/art/cards/${p.file}`} alt={`${p.name} card art`} loading="lazy" decoding="async" />
                  </span>
                )}
                <figcaption className="label">
                  <span className="label-name">{p.name}</span>
                  <span className="label-artist">{ART_CREDITS[p.name]}</span>
                  {deck ? (
                    <span className="label-deck">
                      {deck.deck}
                      {deck.pilot ? `, piloted by ${deck.pilot}` : ''}
                      {deck.link && (
                        <>
                          {' '}
                          <a href={deck.link} target="_blank" rel="noopener">
                            Deck
                          </a>
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="label-deck is-quiet">No deck recorded yet</span>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
