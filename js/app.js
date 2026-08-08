(function () {
  const DAY_DEFS = [
    ['MON', 'Monday'], ['TUE', 'Tuesday'], ['WED', 'Wednesday'], ['THU', 'Thursday'],
    ['FRI', 'Friday'], ['SAT', 'Saturday'], ['SUN', 'Sunday'],
  ];

  const FREQ_LABELS = {
    weekly: 'Weekly',
    fortnightly: 'Fortnightly',
    monthly: 'Monthly',
    irregular: 'Check dates',
  };
  function freqLabel(freq) { return FREQ_LABELS[freq] || FREQ_LABELS.irregular; }

  function todayIndex() { return (new Date().getDay() + 6) % 7; } // Mon = 0

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  const emptyEvents = () => ({ MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] });

  const ARCHIVE_PAGE_SIZE = 10;

  function cityFromURL() {
    try {
      const p = new URLSearchParams(location.search).get('city');
      if (!p) return null;
      return window.CONFIG.CITIES.find((c) => c.toLowerCase() === p.toLowerCase()) || null;
    } catch (e) { return null; }
  }

  const state = {
    view: 'weekly',
    activeCity: cityFromURL() || window.CONFIG.CITIES[0],
    cityData: null,
    special: null,
    stores: null,
    archivePage: 0,
    loading: true,
    mapWanted: false,
    discord: { status: 'loading' },
  };

  // one city selection drives the schedule, the store list and the map
  function setCity(city) {
    state.activeCity = city;
    renderTabs();
    renderGrid();
    renderMeta();
    renderStores();
    try {
      const u = new URL(location.href);
      u.searchParams.set('city', city);
      history.replaceState(null, '', u);
    } catch (e) { /* URL API unavailable: selection simply isn't shareable */ }
  }

  // ---- weekly / special view toggle ----

  function renderViewToggle() {
    [['view-tab-weekly', 'weekly'], ['view-tab-special', 'special']].forEach(([id, view]) => {
      const tab = document.getElementById(id);
      const active = state.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    const shown = document.getElementById(state.view === 'weekly' ? 'view-weekly' : 'view-special');
    const other = document.getElementById(state.view === 'weekly' ? 'view-special' : 'view-weekly');
    const wasHidden = shown.hidden;
    shown.hidden = false;
    other.hidden = true;
    if (wasHidden) {
      shown.classList.remove('view-enter');
      void shown.offsetWidth;
      shown.classList.add('view-enter');
    }
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

  function positionCityMarker() {
    const wrap = document.getElementById('city-tabs');
    const active = wrap.querySelector('.city-tab.active');
    const marker = wrap.querySelector('.city-marker');
    if (!active || !marker) return;
    const wr = wrap.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    marker.style.width = ar.width + 'px';
    marker.style.transform = 'translate(' + (ar.left - wr.left) + 'px,' + (ar.bottom - wr.top) + 'px)';
  }

  function renderTabs() {
    const wrap = document.getElementById('city-tabs');
    wrap.innerHTML = '';
    window.CONFIG.CITIES.forEach((city) => {
      const active = city === state.activeCity;
      const btn = el('button', 'city-tab' + (active ? ' active' : ''), city);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(active));
      btn.addEventListener('click', () => setCity(city));
      wrap.appendChild(btn);
    });
    wrap.appendChild(el('span', 'city-marker'));
    requestAnimationFrame(positionCityMarker);
  }

  // ---- weekly agenda ----

  function findStoreForVenue(venue) {
    const sheet = state.stores;
    if (!sheet || sheet.error || !venue) return null;
    const v = venue.trim().toLowerCase();
    return sheet.stores.find((s) => {
      const n = s.name.trim().toLowerCase();
      return v.includes(n) || n.includes(v);
    }) || null;
  }

  function goToStore(store) {
    state.mapWanted = true;
    renderStores();
    document.getElementById('stores').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => focusStore(store), 450);
  }

  function renderAgendaEvent(ev) {
    const item = el('div', 'agenda-event');
    item.appendChild(el('div', 'agenda-type', ev.type));

    // venue links through to the store explorer when we know the store
    const venueText = ev.venue + (ev.suburb ? ', ' + ev.suburb : '');
    const store = findStoreForVenue(ev.venue);
    if (store) {
      const wrap = el('div', 'agenda-venue');
      const btn = el('button', 'agenda-venue-link', venueText);
      btn.type = 'button';
      btn.title = 'Find this store on the map';
      btn.addEventListener('click', () => goToStore(store));
      wrap.appendChild(btn);
      item.appendChild(wrap);
    } else {
      item.appendChild(el('div', 'agenda-venue', venueText));
    }

    const line = el('div', 'agenda-time-line');
    if (ev.time) line.appendChild(el('span', null, ev.time));
    if (ev.freq && ev.freq !== 'weekly') line.appendChild(el('span', 'freq-tag', freqLabel(ev.freq)));
    if (ev.note) line.appendChild(el('span', 'agenda-note-inline', ev.note));
    if (line.childNodes.length) item.appendChild(line);
    return item;
  }

  function renderGrid() {
    const agenda = document.getElementById('week-grid');
    agenda.innerHTML = '';
    const idx = todayIndex();
    const city = (!state.loading && state.cityData) ? state.cityData[state.activeCity] : null;

    DAY_DEFS.forEach(([key, label], i) => {
      const isToday = i === idx;
      const events = city ? (city.events[key] || []) : [];
      const empty = events.length === 0;
      const row = el('div', 'agenda-day' + (isToday ? ' is-today' : '') + (empty ? ' is-empty' : ''));

      const head = el('div', 'agenda-day-head');
      head.appendChild(el('span', 'agenda-day-name', label));
      if (isToday) head.appendChild(el('span', 'today-flag', 'Today'));
      row.appendChild(head);

      const body = el('div', 'agenda-day-body');
      if (state.loading) {
        body.appendChild(el('p', 'agenda-note', 'Loading…'));
      } else if (empty) {
        body.appendChild(el('p', 'agenda-note', 'No regular events'));
      } else {
        events.forEach((ev) => body.appendChild(renderAgendaEvent(ev)));
      }
      row.appendChild(body);
      agenda.appendChild(row);
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
        ? ' · couldn’t load this city’s schedule, check the Discord'
        : ' · last updated ' + (city.updated || 'unknown')
    ));
  }

  // ---- special events ----

  // upcoming events render as notices pinned into the almanac
  function renderSpecialFeature(ev) {
    const card = el('article', 'special-feature' + (ev.tier ? ' tier-' + ev.tier : ''));

    const dateBlock = el('div', 'feature-date');
    dateBlock.appendChild(el('div', 'feature-date-day', ev.dayLabel));
    dateBlock.appendChild(el('div', 'feature-date-month', ev.monthLabel));
    card.appendChild(dateBlock);

    const main = el('div', 'feature-main');
    const nameRow = el('div', 'feature-name-row');
    if (ev.tier) nameRow.appendChild(el('span', 'tier-gem tier-gem-' + ev.tier));
    nameRow.appendChild(el('span', 'feature-name', ev.event));
    main.appendChild(nameRow);

    if (ev.format) main.appendChild(el('div', 'feature-subline', ev.format));
    if (ev.venue) main.appendChild(el('div', 'feature-venue', ev.venue));
    if (ev.time) main.appendChild(el('div', 'feature-meta', ev.time));

    if (ev.city || ev.entry) {
      const foot = el('div', 'feature-foot');
      foot.appendChild(el('span', 'feature-city', ev.city || ''));
      if (ev.entry) foot.appendChild(el('span', 'feature-entry', ev.entry));
      main.appendChild(foot);
    }

    if (ev.link) {
      const a = el('a', 'special-link', 'View event information');
      a.href = ev.link;
      a.target = '_blank';
      a.rel = 'noopener';
      main.appendChild(a);
    }

    card.appendChild(main);
    return card;
  }

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
    main.appendChild(top);
    const whereParts = [ev.venue, ev.city].filter(Boolean);
    if (whereParts.length) main.appendChild(el('div', 'special-venue', whereParts.join(' · ')));

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
      list.appendChild(el('p', 'special-heading', 'Upcoming gatherings'));
      sp.upcoming.forEach((ev) => list.appendChild(renderSpecialFeature(ev)));
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

  // ---- store locator ----
  // Primary source: the Stores sheet tab (name, address, website, lat/lng),
  // rendered as an interactive map plus a grouped list. If the tab is
  // missing, fall back to venues derived from the weekly schedule.

  let storeMap = null;
  const storeMarkers = new Map();
  // fixed Australia-wide opening view; sheet edits never reframe the map
  const STORE_MAP_BOUNDS = [[-42.88, 115.89], [-26.63, 152.96]];
  const STORE_MAP_FIT = { padding: [28, 28] };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // weekly events hosted at this store, for the map popup
  function storeWeeklyLines(store) {
    const lines = [];
    if (!state.cityData) return lines;
    const n = store.name.trim().toLowerCase();
    const cities = (store.city && state.cityData[store.city]) ? [store.city] : Object.keys(state.cityData);
    cities.forEach((city) => {
      const data = state.cityData[city];
      if (!data || data.error) return;
      DAY_DEFS.forEach(([key, label]) => {
        (data.events[key] || []).forEach((ev) => {
          const v = (ev.venue || '').trim().toLowerCase();
          if (!v || !(v.includes(n) || n.includes(v))) return;
          lines.push(
            label.slice(0, 3) + ' · ' + ev.type +
            (ev.time ? ' · ' + ev.time : '') +
            (ev.freq && ev.freq !== 'weekly' ? ' (' + freqLabel(ev.freq) + ')' : '')
          );
        });
      });
    });
    return lines;
  }

  function initStoreMap(stores) {
    const mapEl = document.getElementById('store-map');
    const located = stores.filter((s) => s.lat != null && s.lng != null);
    if (!window.L || located.length === 0 || !state.mapWanted) return;

    const firstInit = !storeMap;
    if (firstInit) {
      storeMap = L.map(mapEl, { scrollWheelZoom: false, zoomSnap: 0.25, zoomDelta: 1 });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(storeMap);
      mapEl.classList.add('is-live');
      window.addEventListener('resize', () => {
        storeMap.invalidateSize();
        storeMap.fitBounds(STORE_MAP_BOUNDS, STORE_MAP_FIT);
      });
    }

    storeMarkers.forEach((m) => m.remove());
    storeMarkers.clear();

    located.forEach((s) => {
      const dimmed = s.city && s.city !== state.activeCity;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: dimmed ? 6 : 8,
        color: '#C85F26',
        weight: 2,
        fillColor: '#C85F26',
        fillOpacity: dimmed ? 0.25 : 0.55,
        opacity: dimmed ? 0.45 : 1,
      }).addTo(storeMap);
      const weekly = storeWeeklyLines(s);
      const popup = '<strong>' + escapeHtml(s.name) + '</strong>' +
        (s.address ? '<br>' + escapeHtml(s.address) : '') +
        (weekly.length ? '<div class="popup-week">' + weekly.map((l) => '<div>' + escapeHtml(l) + '</div>').join('') + '</div>' : '') +
        (s.link ? '<div class="popup-site"><a href="' + escapeHtml(s.link) + '" target="_blank" rel="noopener">Website</a></div>' : '');
      marker.bindPopup(popup);
      storeMarkers.set(s.name.toLowerCase(), marker);
    });

    if (firstInit) storeMap.fitBounds(STORE_MAP_BOUNDS, STORE_MAP_FIT);
  }

  function focusStore(store) {
    if (!storeMap) return;
    const marker = storeMarkers.get(store.name.toLowerCase());
    if (!marker || store.lat == null) return;
    storeMap.flyTo([store.lat, store.lng], 14, { duration: 0.8 });
    marker.openPopup();
  }

  // venues in the active city's weekly schedule, for "hosts weekly play"
  function weeklyVenueSet() {
    const set = new Set();
    const data = state.cityData && state.cityData[state.activeCity];
    if (!data || data.error) return set;
    Object.values(data.events).forEach((list) => list.forEach((ev) => {
      if (ev.venue) set.add(ev.venue.trim().toLowerCase());
    }));
    return set;
  }

  function renderStores() {
    const section = document.getElementById('stores');
    const title = document.getElementById('store-city-title');
    const list = document.getElementById('store-list');
    if (!section || !list) return;

    title.textContent = state.activeCity;
    list.innerHTML = '';

    const sheet = state.stores;
    if (!sheet) {
      list.appendChild(el('li', 'store-note', 'Reading the store ledger…'));
      return;
    }
    if (sheet.error || sheet.stores.length === 0) {
      list.appendChild(el('li', 'store-note', 'Couldn’t load the stores right now. Check the Discord.'));
      return;
    }

    initStoreMap(sheet.stores);

    const hosts = weeklyVenueSet();
    const hostsWeekly = (s) => {
      const n = s.name.trim().toLowerCase();
      for (const v of hosts) { if (v.includes(n) || n.includes(v)) return true; }
      return false;
    };

    const items = sheet.stores.filter((s) => s.city === state.activeCity);
    if (items.length === 0) {
      list.appendChild(el('li', 'store-note', 'No stores listed for ' + state.activeCity + ' yet.'));
    }
    items.forEach((s) => {
      const li = el('li', 'store-item');
      if (s.lat != null) {
        const btn = el('button', 'store-name-btn', s.name);
        btn.type = 'button';
        btn.addEventListener('click', () => { state.mapWanted = true; initStoreMap(sheet.stores); focusStore(s); });
        li.appendChild(btn);
      } else {
        li.appendChild(el('span', 'store-name-plain', s.name));
      }
      if (s.address) li.appendChild(el('div', 'store-addr', s.address));
      const foot = el('div', 'store-foot');
      if (hostsWeekly(s)) foot.appendChild(el('span', 'events-here', 'Hosts weekly play'));
      if (s.link) {
        const a = el('a', 'store-site', 'Website');
        a.href = s.link;
        a.target = '_blank';
        a.rel = 'noopener';
        foot.appendChild(a);
      }
      if (foot.childNodes.length) li.appendChild(foot);
      list.appendChild(li);
    });
  }

  // the map's tiles only load once the section approaches the viewport
  function armMapLazyInit() {
    const section = document.getElementById('stores');
    if (!('IntersectionObserver' in window)) {
      state.mapWanted = true;
      renderStores();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        state.mapWanted = true;
        renderStores();
      }
    }, { rootMargin: '500px 0px' });
    io.observe(section);
  }

  // ---- navigation ----

  function wireNav() {
    const nav = document.querySelector('.site-nav');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });

    const links = Array.from(document.querySelectorAll('.nav-links a'));
    if (!('IntersectionObserver' in window) || links.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    ['schedule', 'decks', 'join', 'stores'].forEach((id) => {
      const target = document.getElementById(id);
      if (target) io.observe(target);
    });
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

    // live status as supporting evidence, not a dashboard widget
    const hall = el('div', 'hall-line');
    hall.appendChild(el('span', 'hall-dot'));
    const count = el('p', 'hall-count');
    const strong = el('strong', null, String(data.onlineCount));
    count.appendChild(strong);
    count.appendChild(document.createTextNode(
      data.onlineCount === 1 ? ' sorcerer is in the hall' : ' sorcerers are in the hall'
    ));
    count.style.margin = '0';
    hall.appendChild(count);
    wrap.appendChild(hall);

    if (data.avatars.length > 0) {
      const avatarsWrap = el('div', 'avatars');
      data.avatars.forEach((a) => {
        const img = document.createElement('img');
        img.className = 'avatar';
        img.src = a.url;
        img.alt = '';
        avatarsWrap.appendChild(img);
      });
      if (data.moreCount > 0) avatarsWrap.appendChild(el('span', 'avatar-more', '+' + data.moreCount));
      wrap.appendChild(avatarsWrap);
    }

    const voice = el('p', 'voice-line');
    if (data.voiceRooms.length > 0) {
      const rooms = data.voiceRooms.map((v) => v.name + ' (' + v.count + ')').join(' · ');
      const label = el('strong', null, 'In voice: ');
      voice.appendChild(label);
      voice.appendChild(document.createTextNode(rooms));
    } else {
      voice.textContent = 'Quiet in voice right now. Hop in and start a table.';
    }
    wrap.appendChild(voice);
  }

  // ---- bootstrap ----

  async function init() {
    wireViewToggle();
    renderViewToggle();
    wireNav();
    armMapLazyInit();
    window.addEventListener('resize', positionCityMarker);
    window.addEventListener('load', positionCityMarker);
    renderTabs();
    renderGrid();
    renderMeta();
    renderSpecial();
    renderStores();
    renderDiscordCard();

    const [cityData, specialData, storesData, discordResult] = await Promise.all([
      window.SheetData.fetchAllCities(),
      window.SheetData.fetchSpecialEvents(),
      window.SheetData.fetchStores(),
      window.DiscordWidget.fetchDiscordWidget(),
    ]);

    state.cityData = cityData;
    state.special = specialData;
    state.stores = storesData;
    state.loading = false;
    state.discord = discordResult;

    renderTabs();
    renderGrid();
    renderMeta();
    renderSpecial();
    renderStores();
    renderDiscordCard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
