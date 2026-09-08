// Selectors over SiteData shared by several sections.

import { CITIES, type City } from './config';
import { DAY_KEYS, type DayKey, type SiteData, type SpecialEvent, type Store, type WeeklyEvent } from './sheet/types';
import { cityTz, minutesOf, parseTimes, proximity, type Proximity } from './time';

export const ALL = 'All' as const;
export type CityChoice = City | typeof ALL;

export interface PlacedEvent extends WeeklyEvent {
  city: City;
  day: DayKey;
  dayIdx: number;
}

function startMinutes(time: string): number {
  const t = parseTimes(time);
  return t ? minutesOf(t.start) : 24 * 60 + 1; // untimed events sort last
}

export function eventsForDay(data: SiteData, choice: CityChoice, day: DayKey): PlacedEvent[] {
  const cities = choice === ALL ? [...CITIES] : [choice];
  const dayIdx = DAY_KEYS.indexOf(day);
  const all: PlacedEvent[] = [];
  for (const city of cities) {
    const c = data.cities[city];
    if (!c || c.error) continue;
    for (const ev of c.events[day] || []) all.push({ ...ev, city, day, dayIdx });
  }
  if (choice === ALL) all.sort((a, b) => startMinutes(a.time) - startMinutes(b.time) || a.city.localeCompare(b.city));
  return all;
}

export function allEvents(data: SiteData, choice: CityChoice): PlacedEvent[] {
  return DAY_KEYS.flatMap((day) => eventsForDay(data, choice, day));
}

export function cityEventCount(data: SiteData, city: City): number {
  const c = data.cities[city];
  if (!c || c.error) return 0;
  return Object.values(c.events).reduce((n, l) => n + l.length, 0);
}

export interface NextTable {
  event: PlacedEvent;
  proximity: Proximity;
}

// The soonest weekly table from now, in each event's own city clock.
// Fortnightly and monthly slots are skipped: the sheet does not say which
// week they fall on, so "next" would be a coin toss.
export function nextTable(data: SiteData, choice: CityChoice, now: Date): NextTable | null {
  let best: NextTable | null = null;
  for (const ev of allEvents(data, choice)) {
    if (ev.freq !== 'weekly') continue;
    const range = parseTimes(ev.time);
    if (!range) continue;
    const p = proximity(ev.dayIdx, range, cityTz(ev.city), now);
    const score = p.kind === 'now' ? -1 : p.minutesUntil;
    if (!best || score < (best.proximity.kind === 'now' ? -1 : best.proximity.minutesUntil)) best = { event: ev, proximity: p };
  }
  return best;
}

export function findStoreForVenue(stores: Store[], venue: string): Store | null {
  if (!venue) return null;
  const v = venue.trim().toLowerCase();
  return (
    stores.find((s) => {
      const n = s.name.trim().toLowerCase();
      return n.length > 3 && (v.includes(n) || n.includes(v));
    }) || null
  );
}

export function splitSpecial(special: SpecialEvent[], today: string): { upcoming: SpecialEvent[]; past: SpecialEvent[] } {
  return {
    upcoming: special.filter((e) => e.end >= today).sort((a, b) => a.start.localeCompare(b.start)),
    past: special.filter((e) => e.end < today).sort((a, b) => b.start.localeCompare(a.start)),
  };
}

export function recordedResults(special: SpecialEvent[]): SpecialEvent[] {
  return special.filter((e) => e.results.length > 0).sort((a, b) => b.start.localeCompare(a.start));
}

// Element accents for event types: Sorcery's four thresholds, used as a
// quiet colour key rather than a badge system.
export type Element = 'fire' | 'water' | 'earth' | 'air';
export function elementFor(type: string): Element {
  const t = type.toLowerCase();
  if (/draft|sealed|limited/.test(t)) return 'water';
  if (/tournament|contest|championship/.test(t)) return 'fire';
  if (/casual|learn|beginner|intro/.test(t)) return 'earth';
  return 'air';
}
