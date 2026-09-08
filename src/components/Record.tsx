'use client';

// The record: tournament history as a register table. Champions enter the
// record in the display face; the top four are ranked, the rest of the top
// eight stand together, since below the cut the order is a Swiss tiebreak.

import Link from 'next/link';
import { recordedResults } from '@/lib/events';
import type { SpecialEvent } from '@/lib/sheet/types';
import { specialDateLabels } from '@/lib/time';
import { useSiteData } from './SiteDataProvider';

const RANKS = ['1st', '2nd', '3rd', '4th'];

function Tier({ ev }: { ev: SpecialEvent }) {
  if (!ev.tier) return null;
  return <span className={'tier tier-' + ev.tier}>{ev.tier === 'grand' ? 'Grand Contest' : 'Cornerstone'}</span>;
}

export function RecordTable({ limit }: { limit?: number }) {
  const { data } = useSiteData();
  const all = recordedResults(data.special);
  const rows = limit ? all.slice(0, limit) : all;
  if (rows.length === 0) {
    return <p className="spine-empty">{data.failed.includes('special') && data.special.length === 0 ? 'The record could not be read just now.' : 'No results are recorded yet. Once an event has its placings entered, its champion enters the record here.'}</p>;
  }
  return (
    <div className="record-wrap">
      <table className="record">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Event</th>
            <th scope="col">Place</th>
            <th scope="col">Champion</th>
            <th scope="col">
              <span className="sr-only">Deck</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ev) => {
            const champ = ev.results.find((r) => r.place === 1);
            const d = specialDateLabels(ev.start, ev.end);
            return (
              <tr key={ev.start + ev.event} className={ev.tier ? 'tier-' + ev.tier : ''}>
                <td className="rc-date">{d.dateLabel}</td>
                <td className="rc-event">
                  {ev.event}
                  <Tier ev={ev} />
                </td>
                <td className="rc-place">{[ev.city, ev.venue].filter(Boolean).join(', ')}</td>
                <td className="rc-champ">{champ ? champ.player : ''}</td>
                <td className="rc-deck">
                  {champ?.deck && (
                    <a href={champ.deck} target="_blank" rel="noopener">
                      Deck
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RecordPreview() {
  const { data } = useSiteData();
  const n = recordedResults(data.special).length;
  return (
    <section className="record-section" id="record" aria-labelledby="record-title">
      <div className="record-inner">
        <div className="record-head">
          <h2 className="h2" id="record-title">
            The Record
          </h2>
          <p className="head-note">
            {n} {n === 1 ? 'tournament' : 'tournaments'} on record. <Link href="/hall">Open the full record</Link>
          </p>
        </div>
        <RecordTable limit={6} />
      </div>
    </section>
  );
}

// the full record: grouped by year, each event unfolding to its podium
export function RecordFull() {
  const { data } = useSiteData();
  const all = recordedResults(data.special);
  if (all.length === 0) return <RecordTable />;
  const years = Array.from(new Set(all.map((e) => e.start.slice(0, 4))));
  return (
    <div className="record-full">
      {years.map((y) => (
        <div key={y} className="record-year">
          <h2 className="year">{y}</h2>
          {all
            .filter((e) => e.start.startsWith(y))
            .map((ev) => {
              const champ = ev.results.find((r) => r.place === 1);
              const runners = ev.results.filter((r) => r.place > 1 && r.place <= 4);
              const rest = ev.results.filter((r) => r.place > 4);
              const d = specialDateLabels(ev.start, ev.end);
              return (
                <details key={ev.start + ev.event} className={'rec' + (ev.tier ? ' tier-' + ev.tier : '')}>
                  <summary>
                    <span className="rec-date">{d.dateLabel}</span>
                    <span className="rec-event">
                      {ev.event}
                      <Tier ev={ev} />
                      <span className="rec-place">{[ev.city, ev.venue].filter(Boolean).join(', ')}</span>
                    </span>
                    <span className="rec-champ">{champ ? champ.player : ''}</span>
                    <span className="rec-open" aria-hidden="true">
                      Placings
                    </span>
                  </summary>
                  <div className="rec-body">
                    {champ && (
                      <p className="rec-line rec-line-1">
                        <span className="rec-rank">Champion</span>
                        <span className="rec-name">{champ.player}</span>
                        {champ.deck && (
                          <a href={champ.deck} target="_blank" rel="noopener">
                            Winning deck
                          </a>
                        )}
                      </p>
                    )}
                    {runners.map((r) => (
                      <p key={r.place} className="rec-line">
                        <span className="rec-rank">{RANKS[r.place - 1]}</span>
                        <span className="rec-name">{r.player}</span>
                        {r.deck && (
                          <a href={r.deck} target="_blank" rel="noopener">
                            Deck
                          </a>
                        )}
                      </p>
                    ))}
                    {rest.length > 0 && (
                      <p className="rec-line rec-rest">
                        <span className="rec-rank">Top eight</span>
                        <span className="rec-name">
                          {rest.map((r, i) => (
                            <span key={r.place}>
                              {i > 0 ? ', ' : ''}
                              {r.player}
                              {r.deck && (
                                <>
                                  {' '}
                                  <a href={r.deck} target="_blank" rel="noopener">
                                    deck
                                  </a>
                                </>
                              )}
                            </span>
                          ))}
                        </span>
                      </p>
                    )}
                    {ev.format && <p className="rec-format">{ev.format}</p>}
                  </div>
                </details>
              );
            })}
        </div>
      ))}
    </div>
  );
}
