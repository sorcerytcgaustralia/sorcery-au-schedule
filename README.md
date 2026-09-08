# Sorcery TCG Australia

The community website of Sorcery: Contested Realm players in Australia,
live at https://realmofoz.com. Weekly organised play in seven cities,
tournaments and their results, featured decks on SorceryTCG, local stores and
the Discord. Fan-made and community-run, not affiliated with Erik's Curiosa.

Built with Next.js as a fully static site and served by Cloudflare Workers
static assets. There is no server and no database: every fact on the page
comes from one shared Google Sheet that organisers edit directly.

## How the data flows

```
Google Sheet  --(build time)-->  src/data/site-data.json  -->  static HTML
     |                                                            |
     +-------------------(in the browser, every visit)------------+
```

1. **At build time** `scripts/fetch-data.ts` reads every tab of the
   [sheet](https://docs.google.com/spreadsheets/d/1DZiYwc0o4YKxtS_bn86jfXyIQKpV92XGhEJaL503uS8/edit)
   through Google's public `gviz` endpoint, parses it, and writes
   `src/data/site-data.json`. The pages are rendered from that snapshot, so
   the first paint, link previews and search engines all see real content.
   A tab that cannot be read keeps its previous snapshot; if the sheet is
   unreachable altogether the committed snapshot is kept and the build
   still succeeds.
2. **In the browser**, after the page loads, the same parser re-reads the
   sheet and swaps in anything that changed. An edit to the sheet is live
   for visitors within a minute, without a deploy.
3. **Every six hours** GitHub Actions rebuilds `main` so the snapshot itself
   stays fresh.

The Discord presence card reads Discord's public widget JSON in the browser
(needs **Server Settings > Widget > Enable Server Widget** on the server).

The sheet must stay shared as **Anyone with the link, Viewer**, or both the
build and the browser refresh will fail and the site will show its last
snapshot.

## Editing the schedule

Edit the sheet. That is the whole workflow.

Each city has its own tab. Below the `MON ... SUN` header row, put each event
in the cell under its day, one line per field:

```
Event type
Venue Name
Suburb            <- optional, only if you want it shown separately
18:00 - 21:00
(weekly)
Any extra note for players
```

- The frequency in `(parentheses)` should be `weekly`, `fortnightly`,
  `monthly`, or left out (shown as "check dates"). Only weekly events get
  an "add to calendar" button: the sheet does not say which
  fortnight a fortnightly event falls on.
- To stack a second event in the same cell, leave a blank line and start
  again with the type line.
- A row whose first cell is `Updated: DD/MM/YY` sets that city's
  "sheet updated" date.

The parser (`src/lib/sheet/parse.ts`) is a heuristic and is tested against
a real export of the sheet in `src/lib/sheet/parse.test.ts`. Keeping each
field on its own line gives the most reliable result.

### Special Events tab

Append-only ledger, one event per row, rows never deleted. Header names
matter, order does not:

```
Date | End Date | Event | City | Venue | Time | Format | Entry | Link | Tier | 1st_place | 1st_deck | ... | 8th_place | 8th_deck
```

- **Date** is `DD/MM/YY`; Date and Event are the only required fields.
- **End Date** keeps a multi-day event visible until it ends. Use it rather
  than a text range in Date: Google drops non-date text from a date-typed
  column.
- **Tier** is inferred from the name (`Cornerstone`, `Grand Contest`); add
  the column only when the name does not say.
- **Placings** in `1st_place` / `1st_deck` pairs put the event in the Hall
  of Fame. Deck cells should be SorceryTCG URLs.

Upcoming events show under the Special events tab; past ones move to the
collapsed Past events archive and, if they have placings, to the Hall of Fame.

### Stores tab

```
Store | City | Address | Website | Lat | Lng
```

Lat/Lng (decimal degrees) place the store on the map; look them up on
openstreetmap.org (search the address, right-click, "Show address"). Venue
names in the weekly schedule that match a store name become links to it.

### Featured Decks tab

```
Card | Deck | Pilot | Link
```

Card is one of the five avatars in the fan (Imposter, Necromancer,
Pathfinder, Archimago, Avatar of Air); Link is the deck's SorceryTCG URL.

## Developing

```
npm install
npm run dev          # http://localhost:3000, hot reload
npm test             # parser tests against the real sheet export
npm run typecheck
npm run build        # fetches the sheet, then writes the static site to out/
```

Set `SKIP_SHEET_FETCH=1` to build from the committed snapshot without
touching the network (handy in a sandbox that cannot reach Google).

```
src/app/                 routes: /, /hall, 404, robots, sitemap
src/components/          one file per section of the page
src/lib/config.ts        sheet ID, city list, Discord IDs, timezones
src/lib/sheet/           gviz client, parsers, loader, tests
src/lib/time.ts          city-local clocks and date labels
src/lib/calendar.ts      .ics export with real VTIMEZONE blocks
src/data/site-data.json  build-time snapshot (last known good)
scripts/fetch-data.ts    refreshes the snapshot before every build
public/art/              artwork used by the pages
project/, chats/         the original design handoff, kept for reference
```

## Deploying

`.github/workflows/deploy.yml` runs on every push:

- `main` deploys to production with `wrangler deploy`.
- any other branch uploads a preview version (`wrangler versions upload`)
  whose URL is printed in the job log, without touching production.
- a schedule rebuilds `main` every six hours.

It needs two repository secrets, `CLOUDFLARE_API_TOKEN` (Workers Scripts:
Edit, scoped to the account) and `CLOUDFLARE_ACCOUNT_ID`. The custom domain
is bound to the `realmofoz` Worker in the Cloudflare dashboard.
