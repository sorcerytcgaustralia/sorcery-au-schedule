'use client';

import { useState } from 'react';
import { CITIES } from '@/lib/config';
import { addSpecialToCalendar, addWeeklyToCalendar, canExportWeekly } from '@/lib/calendar';
import { ALL, eventsForDay, findStoreForVenue, splitSpecial, type PlacedEvent } from '@/lib/events';
import { DAY_KEYS, DAY_NAMES, type SpecialEvent } from '@/lib/sheet/types';
import { cityTz, nowIn, specialDateLabels, todayIso } from '@/lib/time';
import { CalendarButton } from './CalendarButton';
import { CityTabs } from './CityTabs';
import { useSiteData } from './SiteDataProvider';

const FREQ_LABELS: Record<string, string> = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', irregular: 'Check dates' };
const freqLabel = (f: string) => FREQ_LABELS[f] || FREQ_LABELS.irregular;
const ARCHIVE_PAGE_SIZE = 10;

function AgendaEvent({ ev, showCity, onVenue }: { ev: PlacedEvent; showCity: boolean; onVenue: ((venue: string) => void) | null }) {
  const venueText = ev.venue + (ev.suburb ? ', ' + ev.suburb : '');
  return (
    <div className="agenda-event">
      {showCity && <div className="agenda-city">{ev.city}</div>}
      <div className="agenda-head">
        <div className="agenda-type">{ev.type}</div>
        {/* only weekly events can be booked as a true repeat: the sheet says an
            event is fortnightly or monthly but not which fortnight or which week */}
        {canExportWeekly(ev) && <CalendarButton className="cal-icon" label={`Add ${ev.type} at ${ev.venue} to calendar`} onClick={() => addWeeklyToCalendar(ev, ev.city, ev.dayIdx)} />}
      </div>
      {/* venue links through to the store explorer when we know the store */}
      {onVenue ? (
        <div className="agenda-venue">
          <button type="button" className="agenda-venue-link" title="Find this store on the map" onClick={() => onVenue(ev.venue)}>
            {venueText}
          </button>
        </div>
      ) : (
        <div className="agenda-venue">{venueText}</div>
      )}
      {(ev.time || ev.freq !== 'weekly' || ev.note) && (
        <div className="agenda-time-line">
          {ev.time && <span>{ev.time}</span>}
          {ev.freq !== 'weekly' && <span className="freq-tag">{freqLabel(ev.freq)}</span>}
          {ev.note && <span className="agenda-note-inline">{ev.note}</span>}
        </div>
      )}
    </div>
  );
}

function WeeklyView({ onVenue }: { onVenue: (venue: string) => void }) {
  const { data, activeCity, setCity, now, refresh } = useSiteData();
  // today in the visitor's own clock, as the original site did
  const todayIdx = now ? (now.getDay() + 6) % 7 : -1;
  void cityTz;
  void nowIn;
  const showCity = activeCity === ALL;
  const total = DAY_KEYS.reduce((n, d) => n + eventsForDay(data, activeCity, d).length, 0);
  const city = activeCity === ALL ? null : data.cities[activeCity];

  return (
    <div>
      <CityTabs current={activeCity} onPick={setCity} label="City" />
      <div className="agenda">
        {DAY_KEYS.map((key, i) => {
          const events = eventsForDay(data, activeCity, key);
          const isToday = i === todayIdx;
          const empty = events.length === 0;
          return (
            <div key={key} className={'agenda-day' + (isToday ? ' is-today' : '') + (empty ? ' is-empty' : '')}>
              <div className="agenda-day-head">
                <span className="agenda-day-name">{DAY_NAMES[key]}</span>
                {isToday && <span className="today-flag">Today</span>}
              </div>
              <div className="agenda-day-body">
                {empty ? (
                  <p className="agenda-note">No regular events</p>
                ) : (
                  events.map((ev, k) => <AgendaEvent key={ev.city + k} ev={ev} showCity={showCity} onVenue={findStoreForVenue(data.stores, ev.venue) ? onVenue : null} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="schedule-meta">
        {activeCity === ALL ? (
          <>
            Showing <span className="city-name">every city</span>, {total} regular {total === 1 ? 'event' : 'events'} across Australia
          </>
        ) : (
          <>
            Showing <span className="city-name">{activeCity}</span>
            {city?.error ? ', couldn’t load this city’s schedule, check the Discord' : `, last updated ${city?.updated || 'unknown'}`}
          </>
        )}
        {refresh === 'refreshing' ? ' (checking the sheet)' : ''}
      </p>
    </div>
  );
}

// upcoming events render as featured panels
function SpecialFeature({ ev }: { ev: SpecialEvent }) {
  const d = specialDateLabels(ev.start, ev.end);
  return (
    <article className={'special-feature' + (ev.tier ? ' tier-' + ev.tier : '')}>
      <div className="feature-date">
        <div className="feature-date-day">{d.dayLabel}</div>
        <div className="feature-date-month">{d.monthLabel}</div>
      </div>
      <div className="feature-main">
        <div className="feature-name-row">
          <span className="feature-name">{ev.event}</span>
          <CalendarButton className="cal-icon" label={`Add ${ev.event} to calendar`} onClick={() => addSpecialToCalendar(ev)} />
        </div>
        {ev.format && <div className="feature-subline">{ev.format}</div>}
        {ev.venue && <div className="feature-venue">{ev.venue}</div>}
        {ev.time && <div className="feature-meta">{ev.time}</div>}
        {(ev.city || ev.entry) && (
          <div className="feature-foot">
            <span className="feature-city">{ev.city}</span>
            {ev.entry && <span className="feature-entry">{ev.entry}</span>}
          </div>
        )}
        {ev.link && (
          <a className="special-link" href={ev.link} target="_blank" rel="noopener">
            View event information
          </a>
        )}
      </div>
    </article>
  );
}

function SpecialCard({ ev }: { ev: SpecialEvent }) {
  const d = specialDateLabels(ev.start, ev.end);
  const where = [ev.venue, ev.city].filter(Boolean).join(', ');
  return (
    <div className={'special-card' + (ev.tier ? ' tier-' + ev.tier : '')}>
      <div className="special-date">
        <div className="special-date-day">{d.dayLabel}</div>
        <div className="special-date-month">{d.monthLabel}</div>
      </div>
      <div className="special-main">
        <div className="special-top">
          <span className="special-name">{ev.event}</span>
        </div>
        {where && <div className="special-venue">{where}</div>}
        <div className="special-meta">
          <span>{d.dateLabel}</span>
          {ev.time && <span>{ev.time}</span>}
          {ev.format && <span>{ev.format}</span>}
          {ev.entry && <span>{ev.entry}</span>}
        </div>
        {ev.link && (
          <a className="special-link" href={ev.link} target="_blank" rel="noopener">
            Event details
          </a>
        )}
      </div>
    </div>
  );
}

function SpecialView() {
  const { data, now } = useSiteData();
  const [page, setPage] = useState(0);
  const today = todayIso(now ?? new Date(data.fetchedAt));
  const { upcoming, past } = splitSpecial(data.special, today);
  const unreadable = data.failed.includes('special') && data.special.length === 0;
  const pages = Math.max(1, Math.ceil(past.length / ARCHIVE_PAGE_SIZE));
  const p = Math.min(page, pages - 1);
  const from = p * ARCHIVE_PAGE_SIZE;

  return (
    <div>
      <div className="special-list">
        {unreadable ? (
          <div className="special-empty">Couldn&rsquo;t load the special events. Check the Discord for announcements.</div>
        ) : upcoming.length === 0 ? (
          <div className="special-empty">No special events on the horizon right now. Keep an eye on the Discord for announcements.</div>
        ) : (
          <>
            <p className="special-heading">Upcoming gatherings</p>
            {upcoming.map((ev) => (
              <SpecialFeature key={ev.start + ev.event} ev={ev} />
            ))}
          </>
        )}
      </div>
      {past.length > 0 && (
        <details className="special-archive">
          <summary>Past events</summary>
          <div className="special-archive-list">
            {past.slice(from, from + ARCHIVE_PAGE_SIZE).map((ev) => (
              <SpecialCard key={ev.start + ev.event} ev={ev} />
            ))}
            {pages > 1 && (
              <div className="archive-pager">
                <button type="button" className="pager-btn" disabled={p === 0} onClick={() => setPage(p - 1)}>
                  Newer
                </button>
                <span className="pager-label">
                  Page {p + 1} of {pages}
                </span>
                <button type="button" className="pager-btn" disabled={p === pages - 1} onClick={() => setPage(p + 1)}>
                  Older
                </button>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export function Schedule({ onVenue }: { onVenue: (venue: string) => void }) {
  const [view, setView] = useState<'weekly' | 'special'>('weekly');
  void CITIES;
  return (
    <section id="schedule" className="schedule-section" aria-label="Event schedule">
      <div className="schedule-inner">
        <div className="schedule-head">
          <h2 className="section-title">Organised Play</h2>
          <div className="view-toggle" role="tablist" aria-label="Schedule view">
            <button type="button" role="tab" className={'view-tab' + (view === 'weekly' ? ' active' : '')} aria-selected={view === 'weekly'} onClick={() => setView('weekly')}>
              Weekly events
            </button>
            <button type="button" role="tab" className={'view-tab' + (view === 'special' ? ' active' : '')} aria-selected={view === 'special'} onClick={() => setView('special')}>
              Special events
            </button>
          </div>
        </div>
        <div className="view-enter" key={view}>
          {view === 'weekly' ? <WeeklyView onVenue={onVenue} /> : <SpecialView />}
        </div>
      </div>
    </section>
  );
}
