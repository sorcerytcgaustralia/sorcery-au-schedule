// Builds .ics calendar files in the browser. No backend, no library.
//
// Times in the sheet are local wall-clock times for the event's city, and
// Australia spans three offsets and two DST regimes, so each file carries a
// real VTIMEZONE definition. Without it a weekly event booked in August
// would show an hour out from October onwards.

import { SITE_URL } from './config';
import type { SpecialEvent, WeeklyEvent } from './sheet/types';
import { cityTz, parseIso, parseTimes, type ClockTime } from './time';

const PRODID = '-//Sorcery TCG Australia//Realm of Oz//EN';
const SITE = SITE_URL + '/';

// DST changeover: first Sunday in October (2am) and first Sunday in April (3am)
function vtimezone(tzid: string, stdName: string, stdOffset: string, dstName: string | null, dstOffset: string | null): string[] {
  if (!dstName) {
    return [
      'BEGIN:VTIMEZONE', 'TZID:' + tzid,
      'BEGIN:STANDARD', 'DTSTART:19700101T000000',
      'TZOFFSETFROM:' + stdOffset, 'TZOFFSETTO:' + stdOffset,
      'TZNAME:' + stdName, 'END:STANDARD', 'END:VTIMEZONE',
    ];
  }
  return [
    'BEGIN:VTIMEZONE', 'TZID:' + tzid,
    'BEGIN:DAYLIGHT', 'DTSTART:19701004T020000',
    'TZOFFSETFROM:' + stdOffset, 'TZOFFSETTO:' + dstOffset,
    'TZNAME:' + dstName, 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'DTSTART:19700405T030000',
    'TZOFFSETFROM:' + dstOffset, 'TZOFFSETTO:' + stdOffset,
    'TZNAME:' + stdName, 'RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

const VTZ: Record<string, string[]> = {
  'Australia/Sydney': vtimezone('Australia/Sydney', 'AEST', '+1000', 'AEDT', '+1100'),
  'Australia/Melbourne': vtimezone('Australia/Melbourne', 'AEST', '+1000', 'AEDT', '+1100'),
  'Australia/Hobart': vtimezone('Australia/Hobart', 'AEST', '+1000', 'AEDT', '+1100'),
  'Australia/Adelaide': vtimezone('Australia/Adelaide', 'ACST', '+0930', 'ACDT', '+1030'),
  'Australia/Brisbane': vtimezone('Australia/Brisbane', 'AEST', '+1000', null, null),
  'Australia/Perth': vtimezone('Australia/Perth', 'AWST', '+0800', null, null),
};

const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// RFC 5545 asks for lines of 75 octets or fewer, continued with a space
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    parts.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (d: Date, h: number, m: number) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
const dateStamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function addHours(t: ClockTime, hours: number) {
  const total = t.h * 60 + t.m + hours * 60;
  return { h: Math.floor(total / 60) % 24, m: total % 60, wrapped: total >= 24 * 60 };
}

function nextWeekday(dayIdx: number): Date {
  const target = (dayIdx + 1) % 7; // JS weeks start on Sunday
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
  return d;
}

function wrap(lines: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:' + PRODID, 'CALSCALE:GREGORIAN', ...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

function download(filename: string, ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Only weekly events can be booked as a true repeat: the sheet says an event
// is fortnightly or monthly but not which fortnight or which week.
export function canExportWeekly(ev: WeeklyEvent): boolean {
  return ev.freq === 'weekly' && !!parseTimes(ev.time);
}

export function weeklyIcs(ev: WeeklyEvent, city: string, dayIdx: number): { filename: string; ics: string } | null {
  const tz = cityTz(city);
  const times = parseTimes(ev.time);
  if (!times) return null;

  const date = nextWeekday(dayIdx);
  const end = times.end ? { ...times.end, wrapped: false } : addHours(times.start, 3);
  const endDate = new Date(date);
  if (!times.end && end.wrapped) endDate.setDate(endDate.getDate() + 1);
  if (times.end && end.h * 60 + end.m <= times.start.h * 60 + times.start.m) endDate.setDate(endDate.getDate() + 1);

  const where = [ev.venue, ev.suburb, city].filter(Boolean).join(', ');
  const desc = [
    ev.venue ? 'Venue: ' + ev.venue + (ev.suburb ? ', ' + ev.suburb : '') : '',
    ev.time ? 'Times: ' + ev.time + ' (' + city + ' time)' : '',
    ev.note || '',
    'Schedule: ' + SITE,
  ].filter(Boolean).join('\n');

  return {
    filename: slug(ev.type + '-' + ev.venue) + '.ics',
    ics: wrap([
      ...VTZ[tz],
      'BEGIN:VEVENT',
      'UID:' + slug(city + '-' + dayIdx + '-' + ev.type + '-' + ev.venue) + '@realmofoz.com',
      'DTSTAMP:' + utcStamp(new Date()),
      'DTSTART;TZID=' + tz + ':' + localStamp(date, times.start.h, times.start.m),
      'DTEND;TZID=' + tz + ':' + localStamp(endDate, end.h, end.m),
      'RRULE:FREQ=WEEKLY;BYDAY=' + ICS_DAYS[dayIdx],
      'SUMMARY:' + esc('Sorcery: ' + ev.type),
      'LOCATION:' + esc(where),
      'DESCRIPTION:' + esc(desc),
      'URL:' + SITE,
      'END:VEVENT',
    ]),
  };
}

export function specialIcs(ev: SpecialEvent): { filename: string; ics: string } {
  const tz = cityTz(ev.city);
  const start = parseIso(ev.start);
  const endDay = parseIso(ev.end);
  const multiDay = ev.end !== ev.start;
  const times = parseTimes(ev.time);

  const where = [ev.venue, ev.city].filter(Boolean).join(', ');
  const desc = [
    ev.venue ? 'Venue: ' + ev.venue : '',
    ev.time ? 'Times: ' + ev.time + (ev.city ? ' (' + ev.city + ' time)' : '') : '',
    ev.format ? 'Format: ' + ev.format : '',
    ev.entry ? 'Entry: ' + ev.entry : '',
    ev.link ? 'Details: ' + ev.link : '',
    'Schedule: ' + SITE,
  ].filter(Boolean).join('\n');

  const head = ['BEGIN:VEVENT', 'UID:' + slug(ev.event + '-' + dateStamp(start)) + '@realmofoz.com', 'DTSTAMP:' + utcStamp(new Date())];

  let when: string[];
  const allDay = multiDay || !times;
  if (allDay) {
    // all-day: DTEND is exclusive, so add a day. Multi-day schedules differ
    // per day, so the per-day times stay in the description.
    const endExclusive = new Date(endDay);
    endExclusive.setDate(endExclusive.getDate() + 1);
    when = ['DTSTART;VALUE=DATE:' + dateStamp(start), 'DTEND;VALUE=DATE:' + dateStamp(endExclusive)];
  } else {
    const end = times.end ? { ...times.end, wrapped: false } : addHours(times.start, 4);
    const endDate = new Date(start);
    if (!times.end && end.wrapped) endDate.setDate(endDate.getDate() + 1);
    when = ['DTSTART;TZID=' + tz + ':' + localStamp(start, times.start.h, times.start.m), 'DTEND;TZID=' + tz + ':' + localStamp(endDate, end.h, end.m)];
  }

  const body = [
    ...head,
    ...when,
    'SUMMARY:' + esc(ev.event),
    'LOCATION:' + esc(where),
    'DESCRIPTION:' + esc(desc),
    ev.link ? 'URL:' + ev.link : 'URL:' + SITE,
    'END:VEVENT',
  ];
  return { filename: slug(ev.event) + '.ics', ics: wrap(allDay ? body : [...VTZ[tz], ...body]) };
}

export function addWeeklyToCalendar(ev: WeeklyEvent, city: string, dayIdx: number) {
  const file = weeklyIcs(ev, city, dayIdx);
  if (file) download(file.filename, file.ics);
}

export function addSpecialToCalendar(ev: SpecialEvent) {
  const file = specialIcs(ev);
  download(file.filename, file.ics);
}
