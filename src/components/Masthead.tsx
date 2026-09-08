'use client';

import { CITIES } from '@/lib/config';
import { ALL, nextTable } from '@/lib/events';
import { DAY_NAMES } from '@/lib/sheet/types';
import { formatClock, isoWeek, longDate, parseTimes } from '@/lib/time';
import { useSiteData } from './SiteDataProvider';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Dateline() {
  const { now } = useSiteData();
  if (!now) return <span aria-hidden="true">&nbsp;</span>;
  return (
    <span>
      Week <b className="num">{isoWeek(now)}</b> · {WEEKDAYS[now.getDay()]} <b className="num">{longDate(now)}</b>
    </span>
  );
}

function NextTable() {
  const { data, city, now } = useSiteData();
  const next = now ? nextTable(data, city, now) : null;
  const scope = city === ALL ? 'across Australia' : `in ${city}`;

  let when: string;
  let sub: string;
  if (!now) {
    when = '';
    sub = '';
  } else if (!next) {
    when = '';
    sub = '';
  } else {
    const { event, proximity: p } = next;
    const range = parseTimes(event.time);
    const at = range ? formatClock(range.start) : '';
    if (p.kind === 'now') {
      when = 'Tables are live now';
      sub = `${DAY_NAMES[event.day]} ${at}, ${Math.max(1, Math.round(p.minutesLeft / 60))}h left`;
    } else if (p.kind === 'today') {
      when = `Tonight at ${at}`;
      const h = Math.floor(p.minutesUntil / 60);
      const m = p.minutesUntil % 60;
      sub = h > 0 ? `in ${h}h ${m}m, ${event.city} time` : `in ${m} minutes, ${event.city} time`;
    } else {
      when = `${DAY_NAMES[event.day]} ${at}`;
      sub = p.daysUntil === 1 ? `tomorrow, ${event.city} time` : `in ${p.daysUntil} days, ${event.city} time`;
    }
  }

  return (
    <aside className="next" aria-live="polite">
      <div className="next-kicker mono">
        <span>Next table {scope}</span>
        <span className="live">Live</span>
      </div>
      {!now ? (
        <p className="next-when" aria-hidden="true">
          &nbsp;
        </p>
      ) : next ? (
        <>
          <p className="next-when">
            {when}
            <small>{sub}</small>
          </p>
          <p className="next-what">
            <strong>{next.event.type}</strong> at {next.event.venue}
            {next.event.suburb ? `, ${next.event.suburb}` : ''}
            {city === ALL ? ` · ${next.event.city}` : ''}
          </p>
        </>
      ) : (
        <p className="next-empty">No weekly table is listed {scope} yet. Fortnightly and monthly events still show on the board below.</p>
      )}
    </aside>
  );
}

export function Masthead() {
  const cityCount = CITIES.length;
  return (
    <header className="nameplate wrap" id="top">
      <div className="np-top mono">
        <span>
          Sorcery: Contested Realm · <b>The Australian community</b>
        </span>
        <Dateline />
      </div>
      <h1 className="np-word" aria-label="Realm of Oz">
        <span aria-hidden="true">Realm of</span>
        {/* the emblem stands in for the O: the wreath is the community's mark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="np-o" src="/art/sta-emblem.png" alt="" aria-hidden="true" />
        <span aria-hidden="true">z</span>
      </h1>
      <hr className="np-rule" />
      <div className="np-deck">
        <div>
          <p className="np-stand">
            Where Australia&rsquo;s sorcerers gather: <em>weekly tables in {cityCount} cities</em>, the tournaments worth travelling for, and the decks that won them. Kept by the players, for the players.
          </p>
          <p className="np-stand-links">
            <a href="#week">See the week&rsquo;s tables</a>
            <a href="#notices">Upcoming tournaments</a>
            <a href="#community">New here? Start on Discord</a>
          </p>
        </div>
        <NextTable />
      </div>
    </header>
  );
}
