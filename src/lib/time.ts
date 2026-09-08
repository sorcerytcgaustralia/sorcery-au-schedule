// Clock helpers that respect the fact that every city column in the sheet
// is written in that city's own wall-clock time.

import { CITY_TZ, type City } from './config';
import { DAY_KEYS, type DayKey } from './sheet/types';

export interface ClockTime {
  h: number;
  m: number;
}

export interface TimeRange {
  start: ClockTime;
  end: ClockTime | null;
}

// "18:30 to 22:00", "from 18:00", "Store 10:00 AM, event 11:15 AM"
export function parseTimes(raw: string): TimeRange | null {
  if (!raw) return null;
  const re = /(\d{1,2}):(\d{2})\s*(am|pm)?/gi;
  const found: ClockTime[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const mer = (m[3] || '').toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23) found.push({ h, m: min });
  }
  if (!found.length) return null;
  // only treat a second time as the finish when the two are a written range,
  // so "Store 10:00 AM, event 11:15 AM" isn't read as a 75-minute event
  const isRange = /(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:[\u2013\u2014-]|to)\s*(\d{1,2}):(\d{2})/i.test(raw);
  return { start: found[0], end: isRange && found[1] ? found[1] : null };
}

export function minutesOf(t: ClockTime): number {
  return t.h * 60 + t.m;
}

export function dayIndexOf(key: DayKey): number {
  return DAY_KEYS.indexOf(key);
}

// Weekday (Monday = 0) and minutes since midnight as currently observed in
// the given IANA timezone, plus the calendar day for date labels.
export function nowIn(tz: string, now: Date = new Date()): { dayIdx: number; minutes: number; date: string } {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday').slice(0, 3).toUpperCase() as DayKey;
  const hour = parseInt(get('hour'), 10) % 24;
  const minute = parseInt(get('minute'), 10);
  return {
    dayIdx: Math.max(0, DAY_KEYS.indexOf(weekday)),
    minutes: hour * 60 + minute,
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export function cityTz(city: string): string {
  return CITY_TZ[city as City] ?? 'Australia/Sydney';
}

export type Proximity =
  | { kind: 'now'; minutesLeft: number }
  | { kind: 'today'; minutesUntil: number }
  | { kind: 'upcoming'; minutesUntil: number; daysUntil: number };

// How far away the next run of a weekly slot is, in that city's clock.
export function proximity(dayIdx: number, range: TimeRange, tz: string, now: Date = new Date()): Proximity {
  const local = nowIn(tz, now);
  const start = minutesOf(range.start);
  const end = range.end ? minutesOf(range.end) : start + 180;
  let daysUntil = (dayIdx - local.dayIdx + 7) % 7;
  if (daysUntil === 0) {
    if (local.minutes >= start && local.minutes < end) return { kind: 'now', minutesLeft: end - local.minutes };
    if (local.minutes < start) return { kind: 'today', minutesUntil: start - local.minutes };
    daysUntil = 7;
  }
  return { kind: 'upcoming', minutesUntil: daysUntil * 1440 + start - local.minutes, daysUntil };
}

export function formatClock(t: ClockTime): string {
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
}

export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function longDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export interface DateLabels {
  dayLabel: string;
  monthLabel: string;
  dateLabel: string;
  weekday: string;
}

export function specialDateLabels(startIso: string, endIso: string): DateLabels {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const weekday = WEEKDAYS_SHORT[start.getDay()];
  const oneDay = startIso === endIso;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (oneDay) {
    return {
      weekday,
      dayLabel: String(start.getDate()),
      monthLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      dateLabel: `${weekday} ${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
    };
  }
  if (sameMonth) {
    return {
      weekday,
      dayLabel: `${start.getDate()} to ${end.getDate()}`,
      monthLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      dateLabel: `${start.getDate()} to ${end.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
    };
  }
  return {
    weekday,
    dayLabel: String(start.getDate()),
    monthLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
    dateLabel: `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} to ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`,
  };
}

// The date column of a special event: one line per calendar date so each
// can be its own <time> element. "Sat 3 Oct" then "to Sun 4 Oct", with
// the year kept apart. A single day is one line.
export interface DatePart {
  iso: string;
  text: string;
}
export interface DateParts {
  lines: DatePart[];
  year: string;
}

export function specialDateParts(startIso: string, endIso: string): DateParts {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const fmt = (d: Date) => `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  const lines: DatePart[] = [{ iso: startIso, text: fmt(start) }];
  if (endIso !== startIso) lines.push({ iso: endIso, text: `to ${fmt(end)}` });
  return { lines, year: String(end.getFullYear()) };
}

export function relativeDays(iso: string, today: string): string {
  const diff = Math.round((parseIso(iso).getTime() - parseIso(today).getTime()) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return 'next week';
  const weeks = Math.round(diff / 7);
  if (diff < 60) return `in ${weeks} weeks`;
  return `in ${Math.round(diff / 30)} months`;
}
