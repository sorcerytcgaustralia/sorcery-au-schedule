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

  window.SheetData = { fetchAllCities, parseCell, parseSheetRows };
})();
