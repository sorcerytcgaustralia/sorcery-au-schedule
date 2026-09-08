'use client';

// The register: one stream of time on a ruled spine. This week's tables for
// the selected place (only days that have any, starting from today), then
// the tournaments coming up, then what was recorded last.

import { addSpecialToCalendar, addWeeklyToCalendar, canExportWeekly } from '@/lib/calendar';
import { ALL, eventsForDay, findStoreForVenue, recordedResults, splitSpecial, type PlacedEvent } from '@/lib/events';
import { DAY_KEYS, DAY_NAMES, type SpecialEvent } from '@/lib/sheet/types';
import { cityTz, formatClock, parseTimes, proximity, relativeDays, specialDateLabels, todayIso } from '@/lib/time';
import Link from 'next/link';
import { CalendarButton } from './CalendarButton';
import { useSiteData } from './SiteDataProvider';

const FREQ: Record<string, string> = { fortnightly: 'Fortnightly', monthly: 'Monthly', irregular: 'Irregular, check dates' };

function WeekRibbon({ todayIdx, minutes }: { todayIdx: number; minutes: number }) {
  const { data, activeCity } = useSiteData();
  const needle = todayIdx >= 0 ? ((todayIdx + minutes / 1440) / 7) * 100 : null;
  return (
    <div className="ribbon" role="list" aria-label="Tables per day this week">
      {DAY_KEYS.map((d, i) => {
        const n = eventsForDay(data, activeCity, d).length;
        return (
          <a key={d} href={n ? `#day-${d}` : undefined} role="listitem" className={'ribbon-day' + (i === todayIdx ? ' is-today' : '') + (n ? ' has' : '')} aria-label={`${DAY_NAMES[d]}, ${n} ${n === 1 ? 'table' : 'tables'}`}>
            <span className="ribbon-name">{DAY_NAMES[d].slice(0, 3)}</span>
            <span className="ribbon-count">{n || ''}</span>
          </a>
        );
      })}
      {needle != null && <span className="ribbon-needle" style={{ left: `${needle}%` }} aria-hidden="true" />}
    </div>
  );
}

function Entry({ ev, showCity, onVenue, todayIdx }: { ev: PlacedEvent; showCity: boolean; onVenue: ((v: string) => void) | null; todayIdx: number }) {
  const { now } = useSiteData();
  const t = parseTimes(ev.time);
  const near = now && ev.freq === 'weekly' && t ? proximity(ev.dayIdx, t, cityTz(ev.city), now) : null;
  const state = near?.kind === 'now' ? 'On now' : near?.kind === 'today' && ev.dayIdx === todayIdx ? 'Tonight' : null;
  const venue = ev.venue + (ev.suburb ? `, ${ev.suburb}` : '');
  return (
    <div className={'entry' + (state ? ' is-live' : '')}>
      <div className="entry-time">
        {t ? <span className="t-big">{formatClock(t.start)}</span> : <span className="t-small">{ev.time || 'Time TBC'}</span>}
        {t && t.end && <span className="t-small">to {formatClock(t.end)}</span>}
        {state && <span className="t-state">{state}</span>}
      </div>
      <div className="entry-main">
        <p className="entry-title">{ev.type}</p>
        <p className="entry-where">
          {onVenue ? (
            <button type="button" className="where-link" onClick={() => onVenue(ev.venue)} title="Show on the map">
              {venue}
            </button>
          ) : (
            venue
          )}
          {showCity && <span className="entry-city">{ev.city}</span>}
        </p>
      </div>
      <aside className="entry-margin">
        {ev.freq !== 'weekly' && <span>{FREQ[ev.freq]}</span>}
        {ev.note && <span>{ev.note}</span>}
        {canExportWeekly(ev) && <CalendarButton className="cal-btn" label={`Add ${ev.type} at ${ev.venue} to your calendar`} onClick={() => addWeeklyToCalendar(ev, ev.city, ev.dayIdx)} />}
      </aside>
    </div>
  );
}

function Coming({ ev, today, dim }: { ev: SpecialEvent; today: string; dim: boolean }) {
  const d = specialDateLabels(ev.start, ev.end);
  return (
    <div className={'entry entry-special' + (ev.tier ? ' tier-' + ev.tier : '') + (dim ? ' is-dim' : '')}>
      <div className="entry-time">
        <span className="t-date">{d.dayLabel}</span>
        <span className="t-small">{d.monthLabel}</span>
        <span className="t-small">{relativeDays(ev.start, today)}</span>
      </div>
      <div className="entry-main">
        <p className="entry-title">
          {ev.event}
          {ev.tier && <span className="tier">{ev.tier === 'grand' ? 'Grand Contest' : 'Cornerstone'}</span>}
        </p>
        <p className="entry-where">
          {[ev.venue, ev.city].filter(Boolean).join(', ')}
          {ev.time ? `, ${ev.time}` : ''}
        </p>
        {(ev.format || ev.entry) && <p className="entry-sub">{[ev.format, ev.entry].filter(Boolean).join('. ')}</p>}
        {ev.link && (
          <a className="entry-link" href={ev.link} target="_blank" rel="noopener">
            Event details
          </a>
        )}
      </div>
      <aside className="entry-margin">
        <CalendarButton className="cal-btn" label={`Add ${ev.event} to your calendar`} onClick={() => addSpecialToCalendar(ev)} />
      </aside>
    </div>
  );
}

export function Register({ onVenue }: { onVenue: (venue: string) => void }) {
  const { data, activeCity, now } = useSiteData();
  const todayIdx = now ? (now.getDay() + 6) % 7 : -1;
  const minutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const today = todayIso(now ?? new Date(data.fetchedAt));
  const order = todayIdx >= 0 ? DAY_KEYS.map((_, i) => DAY_KEYS[(todayIdx + i) % 7]) : [...DAY_KEYS];
  const days = order.map((d) => ({ d, events: eventsForDay(data, activeCity, d) })).filter((x) => x.events.length);
  const { upcoming } = splitSpecial(data.special, today);
  const recorded = recordedResults(data.special).slice(0, 3);
  const showCity = activeCity === ALL;

  return (
    <section className="register" id="register" aria-labelledby="register-title">
      <div className="register-inner">
        <div className="register-head">
          <h2 className="h2" id="register-title">
            The Register
          </h2>
          <p className="head-note">{showCity ? 'Every city, this week and what follows.' : `${activeCity}, this week and what follows.`}</p>
        </div>

        <WeekRibbon todayIdx={todayIdx} minutes={minutes} />

        <div className="spine">
          <h3 className="spine-label">
            <span>This week</span>
          </h3>
          {days.length === 0 ? (
            <p className="spine-empty">No regular tables are listed for {showCity ? 'any city' : activeCity} yet. Special events still appear below.</p>
          ) : (
            days.map(({ d, events }) => {
              const i = DAY_KEYS.indexOf(d);
              return (
                <div key={d} id={`day-${d}`} className={'day' + (i === todayIdx ? ' is-today' : '')}>
                  <h4 className="day-name">
                    {DAY_NAMES[d]}
                    {i === todayIdx && <span className="day-today">Today</span>}
                  </h4>
                  {events.map((ev, k) => (
                    <Entry key={ev.city + k} ev={ev} showCity={showCity} onVenue={findStoreForVenue(data.stores, ev.venue) ? onVenue : null} todayIdx={todayIdx} />
                  ))}
                </div>
              );
            })
          )}

          <h3 className="spine-label">
            <span>Coming up</span>
          </h3>
          {upcoming.length === 0 ? (
            <p className="spine-empty">{data.failed.includes('special') && data.special.length === 0 ? 'The tournament list could not be read just now.' : 'No tournaments are announced yet. They appear here as organisers add them.'}</p>
          ) : (
            upcoming.map((ev) => <Coming key={ev.start + ev.event} ev={ev} today={today} dim={!showCity && !!ev.city && ev.city !== activeCity} />)
          )}

          {recorded.length > 0 && (
            <>
              <h3 className="spine-label">
                <span>Recorded</span>
              </h3>
              {recorded.map((ev) => {
                const champ = ev.results.find((r) => r.place === 1);
                const d = specialDateLabels(ev.start, ev.end);
                return (
                  <div key={ev.start + ev.event} className={'entry entry-recorded' + (ev.tier ? ' tier-' + ev.tier : '')}>
                    <div className="entry-time">
                      <span className="t-date">{d.dayLabel}</span>
                      <span className="t-small">{d.monthLabel}</span>
                    </div>
                    <div className="entry-main">
                      <p className="entry-title">{ev.event}</p>
                      <p className="entry-where">{[ev.venue, ev.city].filter(Boolean).join(', ')}</p>
                      {champ && (
                        <p className="entry-champion">
                          Won by <span className="champ-name">{champ.player}</span>
                          {champ.deck && (
                            <a href={champ.deck} target="_blank" rel="noopener">
                              deck
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                    <aside className="entry-margin">
                      <Link href="/hall">Full record</Link>
                    </aside>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
