'use client';

import { CITIES, SHEET_URL } from '@/lib/config';
import { addWeeklyToCalendar, canExportWeekly } from '@/lib/calendar';
import { ALL, cityEventCount, elementFor, eventsForDay, findStoreForVenue, type PlacedEvent } from '@/lib/events';
import { DAY_KEYS, DAY_NAMES, type DayKey } from '@/lib/sheet/types';
import { cityTz, nowIn, parseTimes, proximity } from '@/lib/time';
import { CalendarButton } from './CalendarButton';
import { useSiteData } from './SiteDataProvider';

const FREQ_LABEL: Record<string, string> = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', irregular: 'Check dates' };

function CityIndex() {
  const { data, city, setCity } = useSiteData();
  const total = CITIES.reduce((n, c) => n + cityEventCount(data, c), 0);
  return (
    <nav className="city-index" aria-label="City">
      <p className="city-index-label mono">Cities</p>
      <ul>
        <li>
          <button type="button" className={'city-btn all' + (city === ALL ? ' active' : '')} aria-pressed={city === ALL} onClick={() => setCity(ALL)}>
            <span>All of Oz</span>
            <span className="count">{total}</span>
          </button>
        </li>
        {CITIES.map((c) => (
          <li key={c}>
            <button type="button" className={'city-btn' + (city === c ? ' active' : '')} aria-pressed={city === c} onClick={() => setCity(c)}>
              <span>{c}</span>
              <span className="count">{cityEventCount(data, c)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="city-index-foot">
        Missing your city or your store? <a href={SHEET_URL} target="_blank" rel="noopener">Add it to the sheet</a> and it appears here.
      </p>
    </nav>
  );
}

function Slot({ ev, showCity, onVenue }: { ev: PlacedEvent; showCity: boolean; onVenue: ((venue: string) => void) | null }) {
  const { now } = useSiteData();
  const range = parseTimes(ev.time);
  const near = now && ev.freq === 'weekly' && range ? proximity(ev.dayIdx, range, cityTz(ev.city), now) : null;
  const soon = near?.kind === 'now' ? 'On now' : near?.kind === 'today' ? 'Tonight' : null;
  const venueText = ev.venue + (ev.suburb ? `, ${ev.suburb}` : '');
  return (
    <li className={`slot el-${elementFor(ev.type)}`}>
      <p className="slot-type">
        <span>
          {ev.type}
          {showCity && <span className="slot-city">{ev.city}</span>}
        </span>
      </p>
      {ev.venue && (
        <p className="slot-venue">
          {onVenue ? (
            <button type="button" onClick={() => onVenue(ev.venue)} title="Find this store on the map">
              {venueText}
            </button>
          ) : (
            venueText
          )}
        </p>
      )}
      <p className="slot-meta">
        {ev.time && <span className="time">{ev.time}</span>}
        {ev.freq !== 'weekly' && <span className="freq">{FREQ_LABEL[ev.freq]}</span>}
        {soon && <span className="soon">{soon}</span>}
      </p>
      {ev.note && <p className="slot-note">{ev.note}</p>}
      {canExportWeekly(ev) && <CalendarButton label={`Add ${ev.type} at ${ev.venue} to your calendar`} onClick={() => addWeeklyToCalendar(ev, ev.city, ev.dayIdx)} />}
    </li>
  );
}

function dateOfWeekday(dayIdx: number, now: Date): number {
  const jsDay = (now.getDay() + 6) % 7; // Monday = 0
  const d = new Date(now);
  d.setDate(now.getDate() - jsDay + dayIdx);
  return d.getDate();
}

export function WeekBoard({ onVenue }: { onVenue: ((venue: string) => void) | null }) {
  const { data, city, now, refresh } = useSiteData();
  const todayIdx = now ? nowIn(city === ALL ? Intl.DateTimeFormat().resolvedOptions().timeZone : cityTz(city), now).dayIdx : -1;
  const showCity = city === ALL;
  const cityInfo = city === ALL ? null : data.cities[city];
  const stores = data.stores;

  return (
    <section className="section wrap" id="week" aria-labelledby="week-title">
      <div className="section-head">
        <span className="section-no mono">§ 01</span>
        <h2 className="section-title" id="week-title">
          This week <em>at the tables</em>
        </h2>
        <p className="section-meta mono">
          Regular organised play, {city === ALL ? 'every city' : city}.
          <br />
          Times are local to each city.
        </p>
      </div>

      <div className="board">
        <CityIndex />
        <div>
          <ol className="days">
            {DAY_KEYS.map((day: DayKey, i) => {
              const events = eventsForDay(data, city, day);
              const isToday = i === todayIdx;
              const empty = events.length === 0;
              return (
                <li key={day} className={'day' + (isToday ? ' today' : '') + (empty ? ' empty' : '')}>
                  <div className="day-label">
                    <span className="day-name">{DAY_NAMES[day]}</span>
                    <span className="day-date num" aria-hidden="true">
                      {now ? String(dateOfWeekday(i, now)).padStart(2, '0') : ''}
                    </span>
                    {isToday && <span className="day-today-flag">Today</span>}
                  </div>
                  {empty ? (
                    <p className="day-none">No regular tables</p>
                  ) : (
                    <ul className="slots">
                      {events.map((ev, k) => (
                        <Slot key={`${ev.city}-${k}`} ev={ev} showCity={showCity} onVenue={onVenue && findStoreForVenue(stores, ev.venue) ? onVenue : null} />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="board-foot mono">
            {cityInfo ? (
              <span>
                <b>{city}</b> · {cityInfo.error ? 'could not be read, check the Discord' : `sheet updated ${cityInfo.updated || 'date unknown'}`}
              </span>
            ) : (
              <span>
                <b>All of Oz</b> · {CITIES.length} cities
              </span>
            )}
            <span className="dim">{refresh === 'refreshing' ? 'Checking the sheet for edits' : refresh === 'fresh' ? 'Live from the sheet' : refresh === 'offline' ? 'Showing the last snapshot' : ''}</span>
            <a href={SHEET_URL} target="_blank" rel="noopener">
              Something out of date? Fix it in the sheet
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
