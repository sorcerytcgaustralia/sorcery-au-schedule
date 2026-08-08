// Builds .ics calendar files in the browser — no backend, no library.
//
// Times in the sheet are local wall-clock times for the event's city, and
// Australia spans three offsets and two DST regimes, so each file carries a
// real VTIMEZONE definition. Without it a weekly event booked in August
// would show an hour out from October onwards.

(function () {
  const PRODID = '-//Sorcery TCG Australia//Organised Play//EN';
  const SITE = 'https://sorcerytcgaustralia.github.io/sorcery-au-schedule/';

  const CITY_TZ = {
    Sydney: 'Australia/Sydney',
    Canberra: 'Australia/Sydney',
    Melbourne: 'Australia/Melbourne',
    Hobart: 'Australia/Hobart',
    Brisbane: 'Australia/Brisbane',
    Adelaide: 'Australia/Adelaide',
    Perth: 'Australia/Perth',
  };

  // DST changeover: first Sunday in October (2am) and first Sunday in April (3am)
  function vtimezone(tzid, stdName, stdOffset, dstName, dstOffset) {
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

  const VTZ = {
    'Australia/Sydney': vtimezone('Australia/Sydney', 'AEST', '+1000', 'AEDT', '+1100'),
    'Australia/Melbourne': vtimezone('Australia/Melbourne', 'AEST', '+1000', 'AEDT', '+1100'),
    'Australia/Hobart': vtimezone('Australia/Hobart', 'AEST', '+1000', 'AEDT', '+1100'),
    'Australia/Adelaide': vtimezone('Australia/Adelaide', 'ACST', '+0930', 'ACDT', '+1030'),
    'Australia/Brisbane': vtimezone('Australia/Brisbane', 'AEST', '+1000', null, null),
    'Australia/Perth': vtimezone('Australia/Perth', 'AWST', '+0800', null, null),
  };

  const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  // RFC 5545 asks for lines of 75 octets or fewer, continued with a space
  function fold(line) {
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

  function pad(n) { return String(n).padStart(2, '0'); }

  function localStamp(d, h, m) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      'T' + pad(h) + pad(m) + '00';
  }

  function dateStamp(d) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function utcStamp(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
      'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }

  // "18:30 – 22:00", "from 18:00", "Store 10:00 AM, event 11:15 AM"
  function parseTimes(raw) {
    if (!raw) return null;
    const re = /(\d{1,2}):(\d{2})\s*(am|pm)?/gi;
    const found = [];
    let m;
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
    const isRange = /(\d{1,2}):(\d{2})\s*(am|pm)?\s*[–—-]\s*(\d{1,2}):(\d{2})/i.test(raw);
    return { start: found[0], end: isRange && found[1] ? found[1] : null };
  }

  function addHours(t, hours) {
    const total = t.h * 60 + t.m + hours * 60;
    return { h: Math.floor(total / 60) % 24, m: total % 60, wrapped: total >= 24 * 60 };
  }

  function nextWeekday(dayIdx) {  // 0 = Monday, matching the agenda
    const target = (dayIdx + 1) % 7;  // JS weeks start on Sunday
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
    return d;
  }

  function wrap(lines) {
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:' + PRODID, 'CALSCALE:GREGORIAN']
      .concat(lines, ['END:VCALENDAR']);
    return out.map(fold).join('\r\n') + '\r\n';
  }

  function download(filename, ics) {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- weekly agenda events ----

  function weeklyEvent(ev, city, dayIdx) {
    const tz = CITY_TZ[city] || 'Australia/Sydney';
    const times = parseTimes(ev.time);
    if (!times) return null;

    const date = nextWeekday(dayIdx);
    const end = times.end || addHours(times.start, 3);
    const endDate = new Date(date);
    if (!times.end && end.wrapped) endDate.setDate(endDate.getDate() + 1);
    if (times.end && (end.h * 60 + end.m) <= (times.start.h * 60 + times.start.m)) {
      endDate.setDate(endDate.getDate() + 1);   // finishes after midnight
    }

    const where = [ev.venue, ev.suburb, city].filter(Boolean).join(', ');
    // name the timezone: away from home the calendar grid shows only the
    // viewer's local time, so the event's own hours belong in the details
    const desc = [
      ev.venue ? 'Venue: ' + ev.venue + (ev.suburb ? ', ' + ev.suburb : '') : '',
      ev.time ? 'Times: ' + ev.time + ' (' + city + ' time)' : '',
      ev.note || '',
      'Schedule: ' + SITE,
    ].filter(Boolean).join('\n');

    return {
      filename: slug(ev.type + '-' + ev.venue) + '.ics',
      ics: wrap(VTZ[tz].concat([
        'BEGIN:VEVENT',
        'UID:' + slug(city + '-' + dayIdx + '-' + ev.type + '-' + ev.venue) + '@sorcerytcgaustralia',
        'DTSTAMP:' + utcStamp(new Date()),
        'DTSTART;TZID=' + tz + ':' + localStamp(date, times.start.h, times.start.m),
        'DTEND;TZID=' + tz + ':' + localStamp(endDate, end.h, end.m),
        'RRULE:FREQ=WEEKLY;BYDAY=' + ICS_DAYS[dayIdx],
        'SUMMARY:' + esc('Sorcery: ' + ev.type),
        'LOCATION:' + esc(where),
        'DESCRIPTION:' + esc(desc),
        'URL:' + SITE,
        'END:VEVENT',
      ])),
    };
  }

  // ---- special events ----

  function specialEvent(ev) {
    const tz = CITY_TZ[ev.city] || 'Australia/Sydney';
    const multiDay = ev.end && ev.start && ev.end.getTime() !== ev.start.getTime();
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

    const head = [
      'BEGIN:VEVENT',
      'UID:' + slug(ev.event + '-' + dateStamp(ev.start)) + '@sorcerytcgaustralia',
      'DTSTAMP:' + utcStamp(new Date()),
    ];

    let when;
    if (multiDay || !times) {
      // all-day: DTEND is exclusive, so add a day. Multi-day schedules differ
      // per day, so the per-day times stay in the description.
      const endExclusive = new Date(ev.end || ev.start);
      endExclusive.setDate(endExclusive.getDate() + 1);
      when = [
        'DTSTART;VALUE=DATE:' + dateStamp(ev.start),
        'DTEND;VALUE=DATE:' + dateStamp(endExclusive),
      ];
    } else {
      const end = times.end || addHours(times.start, 4);
      const endDate = new Date(ev.start);
      if (!times.end && end.wrapped) endDate.setDate(endDate.getDate() + 1);
      when = [
        'DTSTART;TZID=' + tz + ':' + localStamp(ev.start, times.start.h, times.start.m),
        'DTEND;TZID=' + tz + ':' + localStamp(endDate, end.h, end.m),
      ];
    }

    const body = head.concat(when, [
      'SUMMARY:' + esc(ev.event),
      'LOCATION:' + esc(where),
      'DESCRIPTION:' + esc(desc),
      ev.link ? 'URL:' + ev.link : 'URL:' + SITE,
      'END:VEVENT',
    ]);

    const needsTz = !(multiDay || !times);
    return {
      filename: slug(ev.event) + '.ics',
      ics: wrap(needsTz ? VTZ[tz].concat(body) : body),
    };
  }

  window.Calendar = {
    canExportWeekly: function (ev) { return ev.freq === 'weekly' && !!parseTimes(ev.time); },
    addWeekly: function (ev, city, dayIdx) {
      const file = weeklyEvent(ev, city, dayIdx);
      if (file) download(file.filename, file.ics);
    },
    addSpecial: function (ev) {
      const file = specialEvent(ev);
      if (file) download(file.filename, file.ics);
    },
  };
})();
