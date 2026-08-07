# Sorcery TCG Australia — Organised Play Schedule

A static site for the Sorcery: Contested Realm community in Australia. It shows
the weekly organised-play schedule for 7 cities (Sydney, Canberra, Melbourne,
Perth, Adelaide, Brisbane, Hobart) plus a live "who's online" Discord card.
Fan-made, community-run, not affiliated with Erik's Curiosa.

No build step. No backend. Just static files that fetch live data straight
from the browser.

## How the data flows

- **Schedule** — read live from the [Google Sheet](https://docs.google.com/spreadsheets/d/1DZiYwc0o4YKxtS_bn86jfXyIQKpV92XGhEJaL503uS8/edit) on every page load, via Google's public `gviz` JSON endpoint (no API key). The sheet must stay shared as **"Anyone with the link" → Viewer** or the fetch will fail for visitors.
- **Discord realm-status card** — read live from Discord's public widget JSON (`https://discord.com/api/guilds/<id>/widget.json`), which requires **Server Settings → Widget → Enable Server Widget** to be turned on in the Discord server.

If either source is unreachable, the site falls back to a plain "check the
Discord" message instead of breaking.

## Updating the schedule

Just edit the Google Sheet — the site re-reads it on every visit, nothing to
redeploy.

Each city has its own tab. Below the `MON…SUN` header row, put each event in
the cell under its day, one line per field:

```
Event type
Venue Name
Suburb            <- optional, only if you want it shown separately
18:00 - 21:00
(weekly)
Any extra note for players
```

- Frequency word in `(parentheses)` should be `weekly`, `fortnightly`,
  `monthly`, or left out entirely (treated as "check dates").
- To put more than one event in the same day's cell, leave a blank line and
  start the next event the same way (Type / Venue / Time / …).
- A row whose first cell is `Updated: DD/MM/YY` sets that city's
  "last updated" date — add one at the bottom of each city's events.

The parser (`js/sheet-data.js`) is tolerant of this free-text shape, but it's
a heuristic, not a strict format — keeping each field on its own line gives
the most reliable result. If venue and suburb are run together on one line
(e.g. `Mighty Cool Games Hornsby`), the site just shows it as one venue name;
put the suburb on its own line if you want it broken out.

## Special events (one-off tournaments, launches, regionals)

The site has a **Weekly Events / Special Events** toggle above the schedule.
The Special Events page reads a sheet tab named exactly `Special Events`,
which works as an append-only ledger — one event per row, and rows are
**never deleted**. Header row (order doesn't matter, names do):

```
Date | End Date | Event | City | Venue | Time | Format | Entry | Link
```

- **Date** — `DD/MM/YY` or `DD/MM/YYYY`. Date and Event are the only
  required fields.
- **End Date** — optional, for multi-day events (e.g. a weekend regional).
  The event stays visible until the end date passes. Use this column for
  ranges rather than typing "03/10/26 - 04/10/26" into Date — Google's
  API silently drops non-date text from a date-formatted column, and the
  event would vanish from the site.
- **Event** — the event name shown on the card.
- **City / Venue / Time / Format / Entry** — optional; shown on the card
  when present. Entry is free text (e.g. `$45`, `Free`).
- **Link** — optional full URL (`https://…`); renders as an
  "Event details" button.

Upcoming events are listed soonest-first. Once an event's date passes, it
automatically moves into the collapsed "Past events" archive at the bottom
of the page — so the tab doubles as a permanent record of everything the
community has run.

## Project structure

```
index.html          page structure
css/styles.css       all styling
js/config.js         sheet ID, city list, Discord server ID/invite — edit here to retarget
js/sheet-data.js      fetches + parses the Google Sheet
js/discord-widget.js  fetches the Discord widget JSON
js/app.js             renders everything, wires up city tabs
project/assets/       source art (river-of-flame.jpg, screamer.png) used directly by the page
project/, chats/      the original Claude Design handoff bundle, kept for reference
```

## Hosting on GitHub Pages (free)

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Source**: deploy from branch, pick `main` and
   `/ (root)`.
3. Done — no build, no Actions workflow needed. GitHub serves `index.html`
   as-is.

## Local preview

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. Note the schedule and Discord card need
real network access to `docs.google.com` and `discord.com` to load.
