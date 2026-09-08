'use client';

import { useEffect, useState } from 'react';
import { CURIOSA_PROFILE_URL } from '@/lib/config';
import { useSiteData } from './SiteDataProvider';

// The fan's five avatars, in fan order. Each slot matches a "Card" value in
// the Featured Decks tab by substring, so "Avatar of Air" and "Air" both work.
const SLOTS = [
  { key: 'archimago', art: '/art/cards/archimago.webp', label: 'Archimago', cls: 'f1' },
  { key: 'pathfinder', art: '/art/cards/pathfinder.webp', label: 'Pathfinder', cls: 'f2' },
  { key: 'imposter', art: '/art/cards/imposter.webp', label: 'Imposter', cls: 'f3' },
  { key: 'necromancer', art: '/art/cards/necromancer.webp', label: 'Necromancer', cls: 'f4' },
  { key: 'air', art: '/art/cards/avatar-of-air.webp', label: 'Avatar of Air', cls: 'f5' },
];

export function Decks() {
  const { data } = useSiteData();
  const [peek, setPeek] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    setTouch(window.matchMedia('(hover: none)').matches);
    const clear = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.fan')) setPeek(null);
    };
    document.addEventListener('click', clear);
    return () => document.removeEventListener('click', clear);
  }, []);

  const deckFor = (key: string) => data.featured.find((d) => d.card.toLowerCase().includes(key)) ?? null;
  const linked = SLOTS.map((s) => ({ ...s, deck: deckFor(s.key) })).filter((s) => s.deck?.link);

  return (
    <section className="section wrap" id="decks" aria-labelledby="decks-title">
      <div className="section-head">
        <span className="section-no mono">§ 03</span>
        <h2 className="section-title" id="decks-title">
          From the <em>Australian meta</em>
        </h2>
        <p className="section-meta mono">
          Decks on Curiosa.io,
          <br />
          updated as the meta shifts.
        </p>
      </div>
      <div className="decks">
        <div>
          <p className="lede">
            What is the realm down under playing? We keep the decks coming out of Australia&rsquo;s organised play on <strong>Curiosa</strong>: tournament winners, top finishes and community brews.
          </p>
          {linked.length > 0 ? (
            <ol className="deck-list">
              {linked.map((s, i) => (
                <a className="deck-row" key={s.key} href={s.deck!.link} target="_blank" rel="noopener">
                  <span className="deck-idx num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="deck-name">
                    {s.deck!.deck || s.label}
                    <small>
                      {s.label}
                      {s.deck!.pilot ? ` · piloted by ${s.deck!.pilot}` : ''}
                    </small>
                  </span>
                  <span className="deck-go">Curiosa &nearr;</span>
                </a>
              ))}
            </ol>
          ) : (
            <p className="lede">The avatars on the right are decorative until someone lists a deck in the sheet&rsquo;s Featured Decks tab.</p>
          )}
          <a className="btn" href={CURIOSA_PROFILE_URL} target="_blank" rel="noopener">
            Browse every deck on Curiosa
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
        <div className="fan" aria-label="Featured decks">
          {SLOTS.map((s) => {
            const deck = deckFor(s.key);
            const style = { backgroundImage: `url(${s.art})` };
            if (!deck?.link) return <span key={s.key} className={`fan-card ${s.cls}`} style={style} role="img" aria-label={`${s.label} card art`} />;
            const tip = deck.deck + (deck.pilot ? ` · ${deck.pilot}` : '');
            return (
              <a
                key={s.key}
                className={`fan-card ${s.cls}` + (peek === s.key ? ' peek' : '')}
                style={style}
                href={deck.link}
                target="_blank"
                rel="noopener"
                aria-label={`${tip || s.label}: view the deck on Curiosa`}
                onClick={(e) => {
                  // without hover the first tap lifts the card clear of its
                  // neighbours, the second follows the link
                  if (touch && peek !== s.key) {
                    e.preventDefault();
                    setPeek(s.key);
                  }
                }}
              >
                <span className="fan-tip" aria-hidden="true">
                  {tip || s.label}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
