'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SORCERYTCG_PROFILE_URL, DISCORD_INVITE_URL } from '@/lib/config';
import { fetchDiscordPresence, type DiscordPresence } from '@/lib/discord';
import { recordedResults } from '@/lib/events';
import { specialDateLabels } from '@/lib/time';
import { useSiteData } from './SiteDataProvider';

// The fan's five avatars become links to the community's featured decks on
// SorceryTCG. Deck and pilot ride on the tooltip and the accessible name.
const FAN_SLOTS: [string, string][] = [
  ['fan-air', 'air'],
  ['fan-archimago', 'archimago'],
  ['fan-pathfinder', 'pathfinder'],
  ['fan-necromancer', 'necromancer'],
  ['fan-imposter', 'imposter'],
];

function DeckFan() {
  const { data } = useSiteData();
  const [peeked, setPeeked] = useState<string | null>(null);
  const [touchOnly, setTouchOnly] = useState(false);

  useEffect(() => {
    setTouchOnly(window.matchMedia('(hover: none)').matches);
    // tapping anywhere else puts the lifted card back
    const clear = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.deck-fan')) setPeeked(null);
    };
    document.addEventListener('click', clear);
    return () => document.removeEventListener('click', clear);
  }, []);

  return (
    <div className="deck-fan">
      {FAN_SLOTS.map(([cls, key]) => {
        const deck = data.featured.find((d) => d.card.toLowerCase().includes(key)) ?? null;
        if (!deck?.link) return <span key={cls} className={`fan-card ${cls}`} />;
        const label = deck.deck + (deck.pilot ? ' by ' + deck.pilot : '');
        return (
          <a
            key={cls}
            className={`fan-card ${cls}` + (peeked === cls ? ' is-peeked' : '')}
            href={deck.link}
            target="_blank"
            rel="noopener"
            title={label}
            aria-label={(label || deck.card) + ', view deck on SorceryTCG'}
            onClick={(e) => {
              // without hover the first tap lifts the card clear of its
              // neighbours, the second one follows the link
              if (touchOnly && peeked !== cls) {
                e.preventDefault();
                setPeeked(cls);
              }
            }}
          />
        );
      })}
    </div>
  );
}

// the most recently recorded result, standing in for a static image
function HallTeaser() {
  const { data } = useSiteData();
  const recorded = recordedResults(data.special);
  const ev = recorded[0];
  if (!ev) return null;
  const champion = ev.results.find((r) => r.place === 1);
  const others = ev.results.length - (champion ? 1 : 0);
  return (
    <div className="hall-teaser">
      <p className="teaser-label">Latest result</p>
      <p className={'teaser-event' + (ev.tier ? ' tier-' + ev.tier : '')}>{ev.event}</p>
      <p className="teaser-meta">{[specialDateLabels(ev.start, ev.end).dateLabel, ev.city].filter(Boolean).join(', ')}</p>
      {champion && (
        <div className="teaser-champion">
          <span className="teaser-champion-label">Champion</span>
          <span className="teaser-champion-name">{champion.player}</span>
        </div>
      )}
      {others > 0 && <p className="teaser-more">{others === 1 ? 'and one more placing recorded' : `and ${others} more placings recorded`}</p>}
    </div>
  );
}

const DISCORD_PATH =
  'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.245.198.372.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

// live status as supporting evidence, not a dashboard widget
function DiscordCard() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [d, setD] = useState<DiscordPresence | null>(null);
  useEffect(() => {
    fetchDiscordPresence().then((res) => {
      setD(res);
      setState(res ? 'ok' : 'error');
    });
  }, []);

  return (
    <div className="discord-card">
      {state === 'loading' ? (
        <div className="discord-loading">
          <span className="spinner" />
          <span className="discord-loading-text">Reading the realm&hellip;</span>
        </div>
      ) : state === 'error' || !d ? (
        <div className="discord-error">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
            <path d={DISCORD_PATH} />
          </svg>
          <div className="discord-error-name">Sorcery TCG Australia</div>
          <div className="discord-error-text">The whole community lives on Discord. Come on in.</div>
        </div>
      ) : (
        <>
          <div className="hall-line">
            <span className="hall-dot" />
            <p className="hall-count">
              <strong>{d.onlineCount}</strong>
              {d.onlineCount === 1 ? ' sorcerer is in the hall' : ' sorcerers are in the hall'}
            </p>
          </div>
          {d.avatars.length > 0 && (
            <div className="avatars">
              {d.avatars.map((a, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} className="avatar" src={a.url} alt="" width={27} height={27} loading="lazy" />
              ))}
              {d.moreCount > 0 && <span className="avatar-more">+{d.moreCount}</span>}
            </div>
          )}
          <p className="voice-line">
            {d.voiceRooms.length > 0 ? (
              <>
                <strong>In voice: </strong>
                {d.voiceRooms.map((v) => `${v.name} (${v.count})`).join(', ')}
              </>
            ) : (
              'Quiet in voice right now. Hop in and start a table.'
            )}
          </p>
        </>
      )}
    </div>
  );
}

export function Dispatches() {
  return (
    <section id="community" className="community" aria-label="Community">
      <div className="community-inner">
        <article className="dispatch" id="decks">
          <div className="dispatch-copy">
            <h2>From the Australian Meta</h2>
            <p>
              What is the realm down under playing? We collect the decks coming out of Australia&rsquo;s organised-play scene on <strong>SorceryTCG</strong>: tournament winners, top finishing decks, and community brews, updated as the meta shifts.
            </p>
            <a href={SORCERYTCG_PROFILE_URL} target="_blank" rel="noopener" className="action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="13" height="17" rx="2" />
                <path d="M8 4V3a1 1 0 0 1 1-1h10a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1h-1" />
              </svg>
              Browse the decks on SorceryTCG
            </a>
          </div>
          <div className="dispatch-art">
            <DeckFan />
          </div>
        </article>

        <article className="dispatch" id="hall">
          <div className="dispatch-copy">
            <h2>The Hall of Fame</h2>
            <p>Every tournament the community has run, the sorcerers who took it, and the decks they played. Champions, podiums and top eights, kept as a permanent record.</p>
            <Link href="/hall" className="action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
                <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
              </svg>
              Enter the Hall of Fame
            </Link>
          </div>
          <div className="dispatch-art">
            <HallTeaser />
          </div>
        </article>

        <article className="dispatch" id="join">
          <div className="dispatch-copy">
            <h2>Gather with the Community</h2>
            <p>
              This almanac is kept by the <strong>Sorcery TCG Australia</strong> community on Discord. Join local groups, trade, play online with sorcerers across the country, and help keep the schedule current.
            </p>
            <p>New to the game? Welcome! Drop in, say hi and find your community.</p>
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener" className="action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={DISCORD_PATH} />
              </svg>
              Open the Discord
            </a>
          </div>
          <DiscordCard />
        </article>
      </div>
    </section>
  );
}
