(function () {
  const DAY_DEFS = [
    ['MON', 'Mon'], ['TUE', 'Tue'], ['WED', 'Wed'], ['THU', 'Thu'],
    ['FRI', 'Fri'], ['SAT', 'Sat'], ['SUN', 'Sun'],
  ];

  const FREQ_META = {
    weekly: { label: 'Weekly', bg: '#caa23f', fg: '#1a1009' },
    fortnightly: { label: 'Fortnightly', bg: '#e0731d', fg: '#1a0d05' },
    monthly: { label: 'Monthly', bg: '#3b8fe0', fg: '#08131f' },
    irregular: { label: 'Check dates', bg: '#5a4434', fg: '#f3e6d2' },
  };
  function freqMeta(freq) { return FREQ_META[freq] || FREQ_META.irregular; }

  function todayIndex() { return (new Date().getDay() + 6) % 7; } // Mon = 0

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  const emptyEvents = () => ({ MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] });

  const ARCHIVE_PAGE_SIZE = 10;

  const state = {
    view: 'weekly',
    activeCity: window.CONFIG.CITIES[0],
    cityData: null,
    special: null,
    archivePage: 0,
    loading: true,
    discord: { status: 'loading' },
  };

  // ---- weekly / special view toggle ----

  function renderViewToggle() {
    document.getElementById('view-tab-weekly').classList.toggle('active', state.view === 'weekly');
    document.getElementById('view-tab-special').classList.toggle('active', state.view === 'special');
    document.getElementById('view-weekly').hidden = state.view !== 'weekly';
    document.getElementById('view-special').hidden = state.view !== 'special';
  }

  function wireViewToggle() {
    [['view-tab-weekly', 'weekly'], ['view-tab-special', 'special']].forEach(([id, view]) => {
      document.getElementById(id).addEventListener('click', () => {
        state.view = view;
        renderViewToggle();
      });
    });
  }

  // ---- city tabs ----

  function renderTabs() {
    const wrap = document.getElementById('city-tabs');
    wrap.innerHTML = '';
    window.CONFIG.CITIES.forEach((city) => {
      const btn = el('button', 'city-tab' + (city === state.activeCity ? ' active' : ''), city);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.activeCity = city;
        renderTabs();
        renderGrid();
        renderMeta();
      });
      wrap.appendChild(btn);
    });
  }

  // ---- week grid ----

  function renderEventCard(ev) {
    const card = el('div', 'event-card');
    const meta = freqMeta(ev.freq);
    const badge = el('span', 'event-badge', meta.label);
    badge.style.background = meta.bg;
    badge.style.color = meta.fg;
    card.appendChild(badge);
    card.appendChild(el('div', 'event-type', ev.type));
    card.appendChild(el('div', 'event-venue', ev.venue));
    if (ev.suburb) card.appendChild(el('div', 'event-suburb', ev.suburb));

    const timeRow = el('div', 'event-time');
    timeRow.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e0731d" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';
    timeRow.appendChild(document.createTextNode(' ' + ev.time));
    card.appendChild(timeRow);

    if (ev.note) card.appendChild(el('div', 'event-note', ev.note));
    return card;
  }

  function renderGrid() {
    const grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    const idx = todayIndex();
    const city = (!state.loading && state.cityData) ? state.cityData[state.activeCity] : null;

    DAY_DEFS.forEach(([key, label], i) => {
      const isToday = i === idx;
      const events = city ? (city.events[key] || []) : [];
      const empty = events.length === 0;
      const col = el('div', 'day-col' + (isToday ? ' is-today' : '') + (empty ? ' is-empty' : ''));

      const header = el('div', 'day-header');
      header.appendChild(el('span', 'day-label', label));
      if (isToday) header.appendChild(el('span', 'today-badge', 'Today'));
      col.appendChild(header);

      const body = el('div', 'day-events');
      if (state.loading) {
        body.appendChild(el('div', 'day-empty-msg', 'Loading…'));
      } else if (empty) {
        body.appendChild(el('div', 'day-empty-msg', 'No events listed'));
      } else {
        events.forEach((ev) => body.appendChild(renderEventCard(ev)));
      }
      col.appendChild(body);
      grid.appendChild(col);
    });
  }

  function renderMeta() {
    const meta = document.getElementById('schedule-meta');
    meta.innerHTML = '';
    if (state.loading || !state.cityData) {
      meta.textContent = 'Loading the schedule…';
      return;
    }
    const city = state.cityData[state.activeCity] || {};
    meta.appendChild(document.createTextNode('Showing '));
    meta.appendChild(el('span', 'city-name', state.activeCity));
    meta.appendChild(document.createTextNode(
      city.error
        ? ' · couldn’t load this city’s schedule — check the Discord'
        : ' · last updated ' + (city.updated || 'unknown') + ' · scroll the grid sideways on smaller screens →'
    ));
  }

  // ---- special events ----

  function renderSpecialCard(ev) {
    const card = el('div', 'special-card' + (ev.tier ? ' tier-' + ev.tier : ''));

    const dateBlock = el('div', 'special-date');
    dateBlock.appendChild(el('div', 'special-date-day', ev.dayLabel));
    dateBlock.appendChild(el('div', 'special-date-month', ev.monthLabel));
    card.appendChild(dateBlock);

    const main = el('div', 'special-main');
    const top = el('div', 'special-top');
    if (ev.tier) top.appendChild(el('span', 'tier-gem tier-gem-' + ev.tier));
    top.appendChild(el('span', 'special-name', ev.event));
    if (ev.city) top.appendChild(el('span', 'city-badge', ev.city));
    main.appendChild(top);
    if (ev.venue) main.appendChild(el('div', 'special-venue', ev.venue));

    const meta = el('div', 'special-meta');
    meta.appendChild(el('span', null, ev.dateLabel));
    if (ev.time) meta.appendChild(el('span', null, ev.time));
    if (ev.format) meta.appendChild(el('span', null, ev.format));
    if (ev.entry) meta.appendChild(el('span', null, ev.entry));
    main.appendChild(meta);

    if (ev.link) {
      const a = el('a', 'special-link', 'Event details');
      a.href = ev.link;
      a.target = '_blank';
      a.rel = 'noopener';
      main.appendChild(a);
    }

    card.appendChild(main);
    return card;
  }

  function renderSpecial() {
    const list = document.getElementById('special-list');
    const archive = document.getElementById('special-archive');
    const archiveList = document.getElementById('special-archive-list');
    list.innerHTML = '';
    archiveList.innerHTML = '';
    archive.hidden = true;

    const sp = state.special;
    if (!sp) {
      list.appendChild(el('div', 'special-empty', 'Loading special events…'));
      return;
    }
    if (sp.error) {
      list.appendChild(el('div', 'special-empty', 'Couldn’t load the special events. Check the Discord for announcements.'));
      return;
    }
    if (sp.upcoming.length === 0) {
      list.appendChild(el('div', 'special-empty', 'No special events on the horizon right now. Keep an eye on the Discord for announcements.'));
    } else {
      sp.upcoming.forEach((ev) => list.appendChild(renderSpecialCard(ev)));
    }
    if (sp.past.length > 0) {
      archive.hidden = false;
      const pages = Math.ceil(sp.past.length / ARCHIVE_PAGE_SIZE);
      if (state.archivePage > pages - 1) state.archivePage = pages - 1;
      if (state.archivePage < 0) state.archivePage = 0;
      const from = state.archivePage * ARCHIVE_PAGE_SIZE;
      sp.past.slice(from, from + ARCHIVE_PAGE_SIZE).forEach((ev) => archiveList.appendChild(renderSpecialCard(ev)));
      if (pages > 1) archiveList.appendChild(renderArchivePager(pages));
    }
  }

  function renderArchivePager(pages) {
    const pager = el('div', 'archive-pager');

    const newer = el('button', 'pager-btn', '← Newer');
    newer.type = 'button';
    newer.disabled = state.archivePage === 0;
    newer.addEventListener('click', () => {
      state.archivePage--;
      renderSpecial();
    });

    const older = el('button', 'pager-btn', 'Older →');
    older.type = 'button';
    older.disabled = state.archivePage === pages - 1;
    older.addEventListener('click', () => {
      state.archivePage++;
      renderSpecial();
    });

    pager.appendChild(newer);
    pager.appendChild(el('span', 'pager-label', `Page ${state.archivePage + 1} of ${pages}`));
    pager.appendChild(older);
    return pager;
  }

  // ---- discord realm-status card ----

  function renderDiscordCard() {
    const wrap = document.getElementById('discord-card-state');
    wrap.innerHTML = '';
    const d = state.discord;

    if (d.status === 'loading') {
      const box = el('div', 'discord-loading');
      box.appendChild(el('span', 'spinner'));
      box.appendChild(el('span', 'discord-loading-text', 'Reading the realm…'));
      wrap.appendChild(box);
      return;
    }

    if (d.status === 'error') {
      const box = el('div', 'discord-error');
      box.innerHTML = '<svg width="42" height="42" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.245.198.372.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
      box.appendChild(el('div', 'discord-error-name', 'Sorcery TCG Australia'));
      box.appendChild(el('div', 'discord-error-text', 'The whole community lives on Discord. Come on in.'));
      wrap.appendChild(box);
      return;
    }

    const data = d.data;

    const liveRow = el('div', 'live-row');
    const liveLabel = el('span', 'live-label');
    liveLabel.appendChild(el('span', 'live-dot'));
    liveLabel.appendChild(document.createTextNode('Live now'));
    liveRow.appendChild(liveLabel);
    liveRow.appendChild(el('span', 'server-name', data.serverName));
    wrap.appendChild(liveRow);

    const onlineRow = el('div', 'online-row');
    onlineRow.appendChild(el('span', 'online-count', String(data.onlineCount)));
    onlineRow.appendChild(el('span', 'online-label', data.onlineCount === 1 ? 'sorcerer online now' : 'sorcerers online now'));
    wrap.appendChild(onlineRow);

    if (data.avatars.length > 0) {
      const avatarsWrap = el('div', 'avatars');
      data.avatars.forEach((a) => {
        const img = document.createElement('img');
        img.className = 'avatar';
        img.src = a.url;
        img.alt = '';
        img.style.boxShadow = '0 0 0 2px ' + a.ring;
        avatarsWrap.appendChild(img);
      });
      if (data.moreCount > 0) avatarsWrap.appendChild(el('span', 'avatar-more', '+' + data.moreCount));
      wrap.appendChild(avatarsWrap);
    }

    wrap.appendChild(el('div', 'divider'));

    if (data.voiceRooms.length > 0) {
      wrap.appendChild(el('div', 'voice-label', 'In voice right now'));
      const rooms = el('div', 'voice-rooms');
      data.voiceRooms.forEach((v) => {
        const row = el('div', 'voice-room');
        const nameWrap = el('span', 'voice-room-name');
        nameWrap.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" style="flex:none;"><path d="M11 5 6 9H2v6h4l5 4z" fill="#3ba55d"/><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="#3ba55d" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
        nameWrap.appendChild(el('span', null, v.name));
        row.appendChild(nameWrap);
        row.appendChild(el('span', 'voice-room-count', String(v.count)));
        rooms.appendChild(row);
      });
      wrap.appendChild(rooms);
    } else {
      wrap.appendChild(el('div', 'no-voice', 'Quiet in voice right now. Hop in and start a table.'));
    }
  }

  // ---- bootstrap ----

  async function init() {
    wireViewToggle();
    renderViewToggle();
    renderTabs();
    renderGrid();
    renderMeta();
    renderSpecial();
    renderDiscordCard();

    const [cityData, specialData, discordResult] = await Promise.all([
      window.SheetData.fetchAllCities(),
      window.SheetData.fetchSpecialEvents(),
      window.DiscordWidget.fetchDiscordWidget(),
    ]);

    state.cityData = cityData;
    state.special = specialData;
    state.loading = false;
    state.discord = discordResult;

    renderTabs();
    renderGrid();
    renderMeta();
    renderSpecial();
    renderDiscordCard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
