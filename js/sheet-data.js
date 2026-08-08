// Fetches and parses the Organised Play Schedule from the public Google Sheet.
//
// Each city is a separate sheet tab. Below the MON..SUN header row, every
// non-empty cell holds one or more events as free-text lines:
//
//   Event type
//   Venue (optionally "@Venue")
//   Suburb                <- optional, own line
//   Time (contains H:MM)
//   (frequency)            <- optional, e.g. (weekly), (fortnightly - notes)
//   Any extra note lines
//
// Multiple events in one cell are separated by starting a new "type" line;
// we detect that by looking ahead for an upcoming time-pattern line before
// any frequency parenthesis. A trailing "Updated: DD/MM/YY" row gives the
// last-updated date.

(function () {
  const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const TIME_LINE_RE = /\d{1,2}:\d{2}/;
  const FREQ_PAREN_RE = /^\((.+)\)$/;
  const FREQ_KEYWORD_RE = /\b(fortnightly|biweekly|monthly|weekly)\b/i;
  const DISCORD_BOILERPLATE_RE = /^(check|see|ask|register|confirm)\b.*\bdiscord\b.*$/i;
  const WEEKDAY_PREFIX_RE = /^(mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b[^\d]*/i;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function normalizeFreqKeyword(word) {
    const w = word.toLowerCase();
    return w === 'biweekly' ? 'fortnightly' : w;
  }

  function inferFreqFromText(text) {
    const m = text.match(FREQ_KEYWORD_RE);
    if (m) return normalizeFreqKeyword(m[1]);
    return 'irregular';
  }

  function normalizeType(raw) {
    return raw.replace(/\s*-\s*/g, ' · ').replace(/\s*\/\s*/g, ' · ').trim();
  }

  function normalizeTime(raw) {
    return raw.replace(WEEKDAY_PREFIX_RE, '').trim().replace(/\s*-\s*/g, ' – ');
  }

  function consumeFreqParen(line, block) {
    const inner = line.replace(FREQ_PAREN_RE, '$1').trim();
    const m = inner.match(FREQ_KEYWORD_RE);
    if (m) {
      block.freq = normalizeFreqKeyword(m[1]);
      block.freqExplicit = true;
      const leftover = inner.slice(inner.toLowerCase().indexOf(m[1].toLowerCase()) + m[1].length)
        .replace(/^[\s,:-]+/, '').trim();
      if (leftover) block.notes.push(leftover);
    } else if (!DISCORD_BOILERPLATE_RE.test(inner)) {
      block.notes.push(inner);
    }
  }

  function looksLikeNewEventStart(lines, idx) {
    for (let k = idx; k < Math.min(idx + 3, lines.length); k++) {
      if (FREQ_PAREN_RE.test(lines[k])) return false;
      if (TIME_LINE_RE.test(lines[k])) return true;
    }
    return false;
  }

  function finalizeBlock(block) {
    const venue = (block.venueLines[0] || '').replace(/^@\s*/, '').trim();
    const suburb = block.venueLines.slice(1).join(', ').trim();
    const freq = block.freqExplicit ? block.freq : inferFreqFromText(block.typeRaw + ' ' + block.notes.join(' '));
    return {
      type: normalizeType(block.typeRaw),
      venue,
      suburb,
      time: normalizeTime(block.time),
      freq,
      note: block.notes.join(' ').trim(),
    };
  }

  function parseCell(raw) {
    if (!raw || !raw.trim()) return [];
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return [];

    const events = [];
    let i = 0;
    while (i < lines.length) {
      const block = { typeRaw: lines[i], venueLines: [], time: '', freq: '', freqExplicit: false, notes: [] };
      i++;

      while (i < lines.length && !TIME_LINE_RE.test(lines[i]) && !FREQ_PAREN_RE.test(lines[i])) {
        block.venueLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && TIME_LINE_RE.test(lines[i])) {
        block.time = lines[i];
        i++;
      }
      if (i < lines.length && FREQ_PAREN_RE.test(lines[i])) {
        consumeFreqParen(lines[i], block);
        i++;
      }
      while (i < lines.length) {
        if (FREQ_PAREN_RE.test(lines[i])) {
          consumeFreqParen(lines[i], block);
          i++;
          continue;
        }
        if (looksLikeNewEventStart(lines, i)) break;
        block.notes.push(lines[i]);
        i++;
      }
      events.push(finalizeBlock(block));
    }
    return events;
  }

  function formatUpdatedDate(raw) {
    if (!raw) return '';
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return raw;
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yy = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    const month = MONTHS[mm - 1] || m[2];
    return `${dd} ${month} ${yy}`;
  }

  function parseSheetRows(rows) {
    const events = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
    let headerRowIdx = -1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r].map((c) => (c || '').toString().trim().toUpperCase());
      if (DAY_KEYS.every((d, idx) => row[idx] === d)) { headerRowIdx = r; break; }
    }
    if (headerRowIdx === -1) return { events, updated: '' };

    let updatedRaw = '';
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      const first = (row[0] || '').toString().trim();
      const updatedMatch = first.match(/^updated:?\s*(.+)$/i);
      if (updatedMatch) { updatedRaw = updatedMatch[1].trim(); continue; }
      for (let d = 0; d < 7; d++) {
        const cell = (row[d] || '').toString();
        if (!cell.trim()) continue;
        events[DAY_KEYS[d]].push(...parseCell(cell));
      }
    }
    return { events, updated: formatUpdatedDate(updatedRaw) };
  }

  async function fetchCitySheet(tabName) {
    const url = `https://docs.google.com/spreadsheets/d/${window.CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Sheet fetch failed: ' + res.status);
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const rows = (json.table.rows || []).map((row) =>
      (row.c || []).map((cell) => (cell && cell.v != null) ? String(cell.v) : '')
    );
    return rows;
  }

  // ---- special events (ledger tab) ----
  //
  // A "Special Events" tab acts as an append-only ledger of one-off events.
  // Header row: Date | Event | City | Venue | Time | Format | Entry | Link.
  // Date is DD/MM/YY (or DD/MM/YYYY); a range like "14/11/26 - 15/11/26"
  // keeps the event visible until the end date passes. Rows are never
  // deleted; past rows render in the collapsed archive section.

  const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parseSpecialDate(str) {
    if (!str) return null;
    str = str.trim();
    let m = str.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2], +m[3]);
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      const d = new Date(y, +m[2] - 1, +m[1]);
      return isNaN(d) ? null : d;
    }
    return null;
  }

  function specialDateLabels(start, end) {
    const oneDay = start.getTime() === end.getTime();
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (oneDay) {
      return {
        dayLabel: String(start.getDate()),
        monthLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
        dateLabel: `${WEEKDAYS_SHORT[start.getDay()]} ${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      };
    }
    if (sameMonth) {
      return {
        dayLabel: `${start.getDate()}–${end.getDate()}`,
        monthLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
        dateLabel: `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      };
    }
    return {
      dayLabel: String(start.getDate()),
      monthLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      dateLabel: `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`,
    };
  }

  async function fetchTabFormatted(tabName) {
    const url = `https://docs.google.com/spreadsheets/d/${window.CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Sheet fetch failed: ' + res.status);
    const text = await res.text();
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const rows = (json.table.rows || []).map((row) =>
      (row.c || []).map((cell) => {
        if (!cell) return '';
        if (cell.f != null) return String(cell.f);
        if (cell.v != null) return String(cell.v);
        return '';
      })
    );
    const colLabels = (json.table.cols || []).map((c) => (c.label || '').trim());
    return { rows, colLabels };
  }

  function buildColMap(labels) {
    const lower = labels.map((h) => h.trim().toLowerCase());
    if (!lower.includes('date') || !lower.some((h) => h === 'event' || h === 'event name')) return null;
    const map = {};
    lower.forEach((h, i) => { if (h && map[h] == null) map[h] = i; });
    return map;
  }

  async function fetchSpecialEvents() {
    try {
      const { rows, colLabels } = await fetchTabFormatted(window.CONFIG.SPECIAL_EVENTS_TAB);

      // When the Date column is date-typed, gviz promotes the header row into
      // column metadata (parsedNumHeaders), so check the labels first, then
      // fall back to scanning the rows for a header row.
      let colMap = buildColMap(colLabels);
      let headerIdx = -1;
      if (!colMap) {
        for (let r = 0; r < rows.length; r++) {
          colMap = buildColMap(rows[r]);
          if (colMap) { headerIdx = r; break; }
        }
      }
      if (!colMap) return { upcoming: [], past: [], error: true };

      const col = (row, names) => {
        for (const n of names) {
          if (colMap[n] != null) return (row[colMap[n]] || '').trim();
        }
        return '';
      };

      const events = [];
      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const rawDate = col(row, ['date', 'dates', 'start date', 'start']);
        const name = col(row, ['event', 'event name', 'name']);
        if (!rawDate || !name) continue;
        // Preferred: a separate date-typed "End Date" column. Inline text
        // ranges ("03/10/26 - 04/10/26") also work, but only if the Date
        // column is plain text; in a date-typed column gviz drops them.
        const parts = rawDate.split(/\s*[–—-]\s*/).map((s) => s.trim()).filter(Boolean);
        const start = parseSpecialDate(parts[0]);
        if (!start) continue;
        let end = parseSpecialDate(col(row, ['end date', 'end', 'until', 'to']));
        if (!end && parts.length > 1) end = parseSpecialDate(parts[1]);
        if (!end || end < start) end = start;
        const link = col(row, ['link', 'url']);
        const inferTier = (s) => /grand\s*contest/i.test(s) ? 'grand' : (/cornerstone/i.test(s) ? 'cornerstone' : '');
        events.push(Object.assign({
          start, end,
          event: name,
          tier: inferTier(col(row, ['tier', 'event tier', 'type', 'event type'])) || inferTier(name),
          city: col(row, ['city']),
          venue: col(row, ['venue']),
          time: col(row, ['time', 'times']),
          format: col(row, ['format']),
          entry: col(row, ['entry', 'entry fee', 'cost']),
          link: /^https?:\/\//i.test(link) ? link : '',
        }, specialDateLabels(start, end)));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        upcoming: events.filter((e) => e.end >= today).sort((a, b) => a.start - b.start),
        past: events.filter((e) => e.end < today).sort((a, b) => b.start - a.start),
      };
    } catch (err) {
      return { upcoming: [], past: [], error: true };
    }
  }

  // ---- stores tab ----
  // Header: Store | City | Address | Website | Lat | Lng. Lat/Lng power
  // the locator map; rows without coordinates still show in the list.

  async function fetchStores() {
    try {
      const { rows, colLabels } = await fetchTabFormatted(window.CONFIG.STORES_TAB);
      const lower = colLabels.map((h) => h.trim().toLowerCase());
      let colMap = null;
      let headerIdx = -1;
      const looksLikeHeader = (arr) => arr.includes('store') || arr.includes('name') || arr.includes('venue');
      if (looksLikeHeader(lower)) {
        colMap = {};
        lower.forEach((h, i) => { if (h && colMap[h] == null) colMap[h] = i; });
      } else {
        for (let r = 0; r < rows.length; r++) {
          const rl = rows[r].map((c) => c.trim().toLowerCase());
          if (looksLikeHeader(rl)) {
            headerIdx = r;
            colMap = {};
            rl.forEach((h, i) => { if (h && colMap[h] == null) colMap[h] = i; });
            break;
          }
        }
      }
      if (!colMap) return { stores: [], error: true };

      const col = (row, names) => {
        for (const n of names) {
          if (colMap[n] != null) return (row[colMap[n]] || '').trim();
        }
        return '';
      };

      const stores = [];
      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const name = col(row, ['store', 'name', 'venue']);
        if (!name) continue;
        const link = col(row, ['website', 'link', 'url']);
        const lat = parseFloat(col(row, ['lat', 'latitude']));
        const lng = parseFloat(col(row, ['lng', 'lon', 'long', 'longitude']));
        stores.push({
          name,
          city: col(row, ['city']),
          address: col(row, ['address']),
          link: /^https?:\/\//i.test(link) ? link : '',
          lat: isFinite(lat) ? lat : null,
          lng: isFinite(lng) ? lng : null,
        });
      }
      return { stores };
    } catch (err) {
      return { stores: [], error: true };
    }
  }

  // ---- featured decks tab ----
  // Header: Card | Deck | Pilot | Link. Card names the fan artwork
  // (Imposter, Necromancer, Pathfinder, Archimago, Avatar of Air).

  async function fetchFeaturedDecks() {
    try {
      const { rows, colLabels } = await fetchTabFormatted(window.CONFIG.FEATURED_DECKS_TAB);
      const findMap = (arr) => {
        const lower = arr.map((c) => c.trim().toLowerCase());
        if (!lower.includes('card') || !lower.includes('deck')) return null;
        const map = {};
        lower.forEach((h, i) => { if (h && map[h] == null) map[h] = i; });
        return map;
      };
      let colMap = findMap(colLabels);
      let headerIdx = -1;
      if (!colMap) {
        for (let r = 0; r < rows.length; r++) {
          colMap = findMap(rows[r]);
          if (colMap) { headerIdx = r; break; }
        }
      }
      if (!colMap) return { decks: [], error: true };

      const col = (row, name) => (colMap[name] != null ? (row[colMap[name]] || '').trim() : '');
      const decks = [];
      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const card = col(row, 'card');
        if (!card) continue;
        const link = col(row, 'link');
        decks.push({
          card,
          deck: col(row, 'deck'),
          pilot: col(row, 'pilot'),
          link: /^https?:\/\//i.test(link) ? link : '',
        });
      }
      return { decks };
    } catch (err) {
      return { decks: [], error: true };
    }
  }

  async function fetchAllCities() {
    const result = {};
    await Promise.all(window.CONFIG.CITIES.map(async (city) => {
      try {
        const rows = await fetchCitySheet(city);
        result[city] = parseSheetRows(rows);
      } catch (err) {
        result[city] = { events: { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] }, updated: '', error: true };
      }
    }));
    return result;
  }

  window.SheetData = { fetchAllCities, fetchSpecialEvents, fetchStores, fetchFeaturedDecks, parseCell, parseSheetRows };
})();
