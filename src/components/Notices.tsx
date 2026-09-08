'use client';

import { useState } from 'react';
import { addSpecialToCalendar } from '@/lib/calendar';
import { splitSpecial } from '@/lib/events';
import type { SpecialEvent } from '@/lib/sheet/types';
import { relativeDays, specialDateLabels, todayIso } from '@/lib/time';
import { useSiteData } from './SiteDataProvider';

const PAGE = 8;

export function TierStamp({ tier }: { tier: SpecialEvent['tier'] }) {
  if (!tier) return null;
  return <span className={'stamp' + (tier === 'grand' ? ' grand' : '')}>{tier === 'grand' ? 'Grand Contest' : 'Cornerstone'}</span>;
}

function Notice({ ev, today }: { ev: SpecialEvent; today: string }) {
  const d = specialDateLabels(ev.start, ev.end);
  const champion = ev.results.find((r) => r.place === 1);
  return (
    <article className="notice">
      <div className="notice-date">
        <span className="notice-day">{d.dayLabel}</span>
        <span className="notice-month">
          {d.weekday} · {d.monthLabel}
        </span>
        <span className="notice-rel">{relativeDays(ev.start, today)}</span>
      </div>
      <div className="notice-body">
        <div className="notice-head">
          <h3 className="notice-name">{ev.event}</h3>
          <TierStamp tier={ev.tier} />
        </div>
        {ev.format && <p className="notice-format">{ev.format}</p>}
        <dl className="notice-details">
          {ev.venue && (
            <div>
              <dt>Venue</dt>
              <dd>{ev.venue}</dd>
            </div>
          )}
          {ev.city && (
            <div>
              <dt>City</dt>
              <dd>{ev.city}</dd>
            </div>
          )}
          {ev.time && (
            <div>
              <dt>Time</dt>
              <dd className="num">{ev.time}</dd>
            </div>
          )}
          {ev.entry && (
            <div>
              <dt>Entry</dt>
              <dd>{ev.entry}</dd>
            </div>
          )}
        </dl>
        <div className="notice-actions">
          {ev.link && (
            <a href={ev.link} target="_blank" rel="noopener">
              Event details &nearr;
            </a>
          )}
          <button type="button" onClick={() => addSpecialToCalendar(ev)}>
            Add to calendar
          </button>
        </div>
        {champion && (
          <p className="notice-podium">
            Won by <b>{champion.player}</b>
            {ev.results.length > 1 ? `, with ${ev.results.length - 1} more placings in the Hall of Fame` : ''}
          </p>
        )}
      </div>
    </article>
  );
}

function Ledger({ past }: { past: SpecialEvent[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(past.length / PAGE));
  const rows = past.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <details className="ledger">
      <summary>Past events, {past.length} on record</summary>
      <div className="ledger-rows">
        {rows.map((ev) => {
          const d = specialDateLabels(ev.start, ev.end);
          const champion = ev.results.find((r) => r.place === 1);
          return (
            <div className="ledger-row" key={ev.start + ev.event}>
              <span className="ld-date">{d.dateLabel}</span>
              <span>
                <span className="ld-name">{ev.event}</span>
                {(ev.venue || ev.city) && <span className="ld-where"> · {[ev.venue, ev.city].filter(Boolean).join(', ')}</span>}
              </span>
              {champion && (
                <span className="ld-win">
                  Won by <b>{champion.player}</b>
                </span>
              )}
            </div>
          );
        })}
        {pages > 1 && (
          <div className="pager">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Newer
            </button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Older
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

export function Notices() {
  const { data, now } = useSiteData();
  const today = todayIso(now ?? new Date(data.fetchedAt));
  const { upcoming, past } = splitSpecial(data.special, today);
  const unreadable = data.failed.includes('special') && data.special.length === 0;

  return (
    <section className="section paper" id="notices" aria-labelledby="notices-title">
      <div className="wrap">
        <div className="section-head">
          <span className="section-no mono">§ 02</span>
          <h2 className="section-title" id="notices-title">
            Notices <em>and tournaments</em>
          </h2>
          <p className="section-meta mono">
            One-off events across the realm.
            <br />
            Soonest first.
          </p>
        </div>

        {upcoming.length > 0 ? (
          <div className="notices">
            {upcoming.map((ev) => (
              <Notice key={ev.start + ev.event} ev={ev} today={today} />
            ))}
          </div>
        ) : (
          <p className="empty-note">
            {unreadable
              ? 'The notice board could not be read just now. Tournament announcements are always on the Discord.'
              : 'Nothing is posted on the horizon right now. When an organiser adds a tournament to the sheet, it appears here, and the Discord always hears first.'}
          </p>
        )}

        {past.length > 0 && <Ledger past={past} />}
      </div>
    </section>
  );
}
