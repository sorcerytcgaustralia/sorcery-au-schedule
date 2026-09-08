'use client';

import { useEffect, useState } from 'react';
import { CITIES, DISCORD_INVITE_URL } from '@/lib/config';
import { fetchDiscordPresence, type DiscordPresence } from '@/lib/discord';
import { ALL, cityEventCount, nextTable } from '@/lib/events';
import { DAY_NAMES } from '@/lib/sheet/types';
import { formatClock, longDate, parseTimes } from '@/lib/time';
import { Chart } from './Chart';
import { useSiteData } from './SiteDataProvider';
import type { City } from '@/lib/config';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The live line: one sentence that changes with the clock and the place.
function LiveLine({ hovered }: { hovered: City | null }) {
  const { data, activeCity, now } = useSiteData();
  const scope = hovered ?? activeCity;
  const total = CITIES.reduce((n, c) => n + cityEventCount(data, c), 0);
  const scopedCount = scope === ALL ? total : cityEventCount(data, scope);
  const next = now ? nextTable(data, scope, now) : null;

  let nextText: React.ReactNode = null;
  if (now && next) {
    const t = parseTimes(next.event.time);
    const at = t ? formatClock(t.start) : '';
    const p = next.proximity;
    const when = p.kind === 'now' ? 'on now' : p.kind === 'today' ? `tonight at ${at}` : p.kind === 'upcoming' && p.daysUntil === 1 ? `tomorrow at ${at}` : `${DAY_NAMES[next.event.day]} at ${at}`;
    nextText = (
      <>
        {' '}
        Next table: <b>{next.event.city}</b>, {when}, {next.event.venue}
        {next.event.suburb ? `, ${next.event.suburb}` : ''}.
      </>
    );
  }

  return (
    <p className="live-line" aria-live="polite">
      {now ? (
        <>
          <b>
            {WEEKDAYS[now.getDay()]} {longDate(now)}.
          </b>{' '}
        </>
      ) : null}
      {scope === ALL ? (
        <>
          <b>{total}</b> regular {total === 1 ? 'table' : 'tables'} this week across <b>{CITIES.length}</b> cities.
        </>
      ) : (
        <>
          <b>{scopedCount}</b> regular {scopedCount === 1 ? 'table' : 'tables'} this week in <b>{scope}</b>.
        </>
      )}
      {nextText}
    </p>
  );
}

function DiscordNote() {
  const [p, setP] = useState<DiscordPresence | null | undefined>(undefined);
  useEffect(() => {
    fetchDiscordPresence().then(setP);
  }, []);
  return (
    <p className="margin-note discord-note">
      {p ? (
        <>
          <span className="live-dot" aria-hidden="true" />
          <b>{p.onlineCount}</b> {p.onlineCount === 1 ? 'sorcerer is' : 'sorcerers are'} on the Discord right now.{' '}
          <a href={p.inviteUrl} target="_blank" rel="noopener">
            Join them
          </a>
          {p.avatars.length > 0 && (
            <span className="note-avatars" aria-hidden="true">
              {p.avatars.slice(0, 8).map((a, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={a.url} alt="" width={22} height={22} loading="lazy" />
              ))}
            </span>
          )}
        </>
      ) : p === null ? (
        <>
          The community lives on{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener">
            Discord
          </a>
          , where tables are arranged and results are posted.
        </>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </p>
  );
}

export function Realm() {
  const [hovered, setHovered] = useState<City | null>(null);
  const { activeCity, setCity } = useSiteData();
  return (
    <header className="realm" id="realm">
      <div className="realm-inner">
        <div className="realm-copy">
          <h1 className="statement">Where Sorcery happens in Australia.</h1>
          <LiveLine hovered={hovered} />
          <p className="realm-actions">
            <a className="btn" href="#register">
              See this week
            </a>
            {activeCity !== ALL && (
              <button type="button" className="quiet-link" onClick={() => setCity(ALL)}>
                Show every city
              </button>
            )}
          </p>
          <DiscordNote />
        </div>
        <Chart hovered={hovered} onHover={setHovered} />
      </div>
    </header>
  );
}
