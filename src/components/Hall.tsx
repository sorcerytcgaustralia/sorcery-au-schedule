'use client';

import Link from 'next/link';
import { recordedResults } from '@/lib/events';
import type { SpecialEvent } from '@/lib/sheet/types';
import { specialDateLabels } from '@/lib/time';
import { TierStamp } from './Notices';
import { useSiteData } from './SiteDataProvider';

const RANKS = ['1st', '2nd', '3rd', '4th'];

function Podium({ ev }: { ev: SpecialEvent }) {
  const runners = ev.results.filter((r) => r.place > 1 && r.place <= 4);
  const rest = ev.results.filter((r) => r.place > 4);
  return (
    <>
      {runners.length > 0 && (
        <ol className="podium">
          {runners.map((r) => (
            <li key={r.place} className={`podium-row p${r.place}`}>
              <span className="rank">{RANKS[r.place - 1]}</span>
              <span className="player">{r.player}</span>
              {r.deck && (
                <a href={r.deck} target="_blank" rel="noopener" aria-label={`View ${r.player}'s deck on Curiosa`}>
                  Deck &nearr;
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <div className="top8">
          {/* below the cut the order is a Swiss tiebreak artefact, so the rest of the top eight is listed together */}
          <p className="top8-label">Also in the top eight</p>
          <ul>
            {rest.map((r) => (
              <li key={r.place}>
                <span>{r.player}</span>
                {r.deck && (
                  <a href={r.deck} target="_blank" rel="noopener">
                    Deck &nearr;
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export function HallPreview() {
  const { data } = useSiteData();
  const recorded = recordedResults(data.special);
  const latest = recorded[0];
  const champion = latest?.results.find((r) => r.place === 1);

  return (
    <section className="section paper" id="hall" aria-labelledby="hall-title">
      <div className="wrap">
        <div className="section-head">
          <span className="section-no mono">§ 04</span>
          <h2 className="section-title" id="hall-title">
            The Hall <em>of Fame</em>
          </h2>
          <p className="section-meta mono">
            {recorded.length} {recorded.length === 1 ? 'tournament' : 'tournaments'} on record.
            <br />
            <Link href="/hall">Open the full ledger</Link>
          </p>
        </div>
        <div className="hall-grid">
          <div>
            <p className="lede" style={{ color: 'var(--paper-text-2)' }}>
              Every tournament the community has run, the sorcerers who took it, and the decks they played. Champions, podiums and top eights, kept as a permanent record.
            </p>
            <Link className="btn" href="/hall" style={{ background: 'var(--paper-text)', color: 'var(--paper)' }}>
              Enter the Hall of Fame
            </Link>
          </div>
          {latest ? (
            <div className="champion-card">
              <p className="kicker mono">Latest result</p>
              <p className="event">
                {latest.event} <TierStamp tier={latest.tier} />
              </p>
              <p className="meta">{[specialDateLabels(latest.start, latest.end).dateLabel, latest.city, latest.venue].filter(Boolean).join(' · ')}</p>
              {champion && (
                <>
                  <p className="name-label">Champion</p>
                  <p className="name">{champion.player}</p>
                  {champion.deck && (
                    <p className="meta">
                      <a href={champion.deck} target="_blank" rel="noopener">
                        The winning deck on Curiosa &nearr;
                      </a>
                    </p>
                  )}
                </>
              )}
              <Podium ev={latest} />
            </div>
          ) : (
            <p className="empty-note">No results recorded yet. Once an event has its placings entered in the sheet, the champion is named here.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function HallLedger() {
  const { data } = useSiteData();
  const recorded = recordedResults(data.special);
  if (recorded.length === 0) {
    return <p className="empty-note">No results recorded yet. Once an event has its placings entered in the sheet, it takes its place here.</p>;
  }
  return (
    <div>
      {recorded.map((ev) => {
        const champion = ev.results.find((r) => r.place === 1);
        const d = specialDateLabels(ev.start, ev.end);
        return (
          <article className="hall-entry" key={ev.start + ev.event}>
            <div className="when">
              {d.dateLabel}
              <br />
              {[ev.city, ev.venue].filter(Boolean).join(' · ')}
            </div>
            <div>
              <h3 className="name">
                {ev.event}
                <TierStamp tier={ev.tier} />
              </h3>
              {ev.format && <p className="where">{ev.format}</p>}
              {champion && (
                <>
                  <p className="winner-label">Champion</p>
                  <p className="winner">
                    {champion.player}
                    {champion.deck && (
                      <a href={champion.deck} target="_blank" rel="noopener">
                        Winning deck &nearr;
                      </a>
                    )}
                  </p>
                </>
              )}
              <Podium ev={ev} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
