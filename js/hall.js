// Hall of Fame: every special event that has recorded a result.
//
// The sheet stores eight paired columns (1st_place / 1st_deck ... 8th).
// Only the top four are ranked; fifth through eighth are shown together as
// the rest of the top eight, since below the cut the ordering is a Swiss
// tiebreak artefact rather than a meaningful placing.

(function () {
  const RANKS = ['1st', '2nd', '3rd', '4th'];

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function deckLink(entry, className) {
    if (!entry.deck) return el('span', className, entry.player);
    const a = el('a', className, entry.player);
    a.href = entry.deck;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'View deck on Curiosa';
    return a;
  }

  function renderEvent(ev) {
    const card = el('article', 'hall-event' + (ev.tier ? ' tier-' + ev.tier : ''));

    const head = el('div', 'hall-event-head');
    const nameRow = el('div', 'hall-name-row');
    if (ev.tier) nameRow.appendChild(el('span', 'tier-gem tier-gem-' + ev.tier));
    nameRow.appendChild(el('h2', 'hall-event-name', ev.event));
    head.appendChild(nameRow);
    const where = [ev.dateLabel, ev.city, ev.venue].filter(Boolean).join(' · ');
    head.appendChild(el('p', 'hall-event-meta', where));
    card.appendChild(head);

    const champion = ev.results.find((r) => r.place === 1);
    const runners = ev.results.filter((r) => r.place > 1 && r.place <= 4);
    const rest = ev.results.filter((r) => r.place > 4);

    // the champion gets the site's feature-card frame: one per event, so it
    // stays remarkable rather than becoming another decorated row
    if (champion) {
      const box = el('div', 'champion');
      box.appendChild(el('p', 'champion-label', 'Champion'));
      box.appendChild(el('p', 'champion-name', champion.player));
      if (champion.deck) {
        const a = el('a', 'champion-deck', 'View the winning deck');
        a.href = champion.deck;
        a.target = '_blank';
        a.rel = 'noopener';
        box.appendChild(a);
      }
      card.appendChild(box);
    }

    if (runners.length) {
      const ol = el('ol', 'podium');
      runners.forEach((r) => {
        const li = el('li', 'podium-row place-' + r.place);
        li.appendChild(el('span', 'podium-rank', RANKS[r.place - 1]));
        li.appendChild(deckLink(r, 'podium-player'));
        ol.appendChild(li);
      });
      card.appendChild(ol);
    }

    if (rest.length) {
      const wrap = el('div', 'top-eight');
      wrap.appendChild(el('h3', 'top-eight-label', 'Also in the top eight'));
      const ul = el('ul', 'top-eight-list');
      rest.forEach((r) => {
        const li = el('li');
        li.appendChild(deckLink(r, 'top-eight-player'));
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      card.appendChild(wrap);
    }

    return card;
  }

  function render(state) {
    const list = document.getElementById('hall-list');
    list.innerHTML = '';

    if (state.loading) {
      list.appendChild(el('p', 'hall-note', 'Reading the records…'));
      return;
    }
    if (state.error) {
      list.appendChild(el('p', 'hall-note', 'Couldn’t load the results right now. Check the Discord.'));
      return;
    }
    if (!state.events.length) {
      list.appendChild(el('p', 'hall-note', 'No results recorded yet. Once an event has its placings entered, it will appear here.'));
      return;
    }
    state.events.forEach((ev) => list.appendChild(renderEvent(ev)));
  }

  async function init() {
    render({ loading: true });
    const data = await window.SheetData.fetchSpecialEvents();
    if (data.error) { render({ error: true }); return; }

    // an event earns its place here only once someone has recorded a result
    const events = data.upcoming.concat(data.past)
      .filter((ev) => ev.results && ev.results.length)
      .sort((a, b) => b.start - a.start);

    render({ events });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
