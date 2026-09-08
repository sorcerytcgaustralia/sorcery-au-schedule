# Handover notes

Technical context for whoever picks this project up next, human or
assistant. Read `README.md` first for how the data and the deploy work;
this file is the layer underneath.

## What this is

Realm of Oz, https://realmofoz.com: a static Next.js site for the Sorcery:
Contested Realm community in Australia. Repo:
`https://github.com/sorcerytcgaustralia/sorcery-au-schedule`.

- **Hosting:** Cloudflare Workers static assets (`wrangler.jsonc`, assets
  directory `./out`, no Worker script). Deployed by GitHub Actions.
- **Data:** one public Google Sheet, read at build time into
  `src/data/site-data.json` and again in the browser after load.
- **Live data in the browser:** Discord widget JSON for the presence card.

## History

1. Original site: hand-written HTML/CSS/JS on GitHub Pages under
   `/sorcery-au-schedule/`, reading the sheet purely in the browser.
2. September 2026: moved hosting to Cloudflare Workers under realmofoz.com.
3. September 2026: rebuilt on Next.js with a new design ("the community
   gazette"), build-time snapshot plus browser refresh, a TypeScript port
   of the sheet parser with tests, per-city pages, and preview deploys.

## Design intent

The page is set like a periodical, not a product landing page. If you add
a section, keep to the system rather than importing a new one:

- **Three typefaces, three jobs.** Fraunces (display: nameplate, section
  titles, big dates and champion names; the `opsz`, `SOFT` and `WONK` axes
  are on so it sets soft and slightly irregular), Instrument Sans (reading
  and UI), IBM Plex Mono (labels, times, anything that reads like a
  timetable). Tokens live in `:root` in `src/app/globals.css`.
- **Two grounds.** Warm ink for most of the page, cream paper for Notices
  and the Hall of Fame, so the page "turns". Sections alternate on purpose.
- **Section furniture.** A mono section number, a Fraunces title with an
  italic second half, a right-aligned mono note, a double rule. Every
  section uses the same head.
- **One live number on the nameplate.** The "next table" callout is the
  only animated element (a pulsing dot). Everything else is still.
- **Four element colours** (fire, water, earth, air) are a quiet key for
  event types, as small rotated squares, not badges.
- **The emblem is the O in "Oz"** on the nameplate. Keep it.
- No em dashes anywhere in copy or code, by request.

## Where things are

```
src/components/SiteDataProvider.tsx   snapshot -> state, browser refresh, the one city selection
src/components/Masthead.tsx           nameplate, dateline, "next table"
src/components/WeekBoard.tsx          city index + seven day rows
src/components/Notices.tsx            special events (upcoming + past ledger)
src/components/Decks.tsx              featured decks + the card fan
src/components/Hall.tsx               Hall preview on the home page and the /hall ledger
src/components/Community.tsx          Discord presence + "how this page stays true"
src/components/Stores.tsx, StoreMap.tsx   list + lazy Leaflet map (CARTO dark tiles)
src/lib/events.ts                     selectors: events per day, next table, store matching
src/lib/time.ts                       city-local clocks via Intl, proximity, date labels
```

Routes are static. `/schedule/<city>` renders the home page pinned to that
city and carries its own title and description; the city buttons rewrite
the URL with `history.replaceState` so any selection is shareable. The old
`?city=Sydney` query still works on `/`.

## How the sheet parsing works

`src/lib/sheet/parse.ts` is a small state machine, not a strict format
parser. For each day cell it treats the first line as the event type, then
venue lines until a line containing `H:MM`, then an optional
`(frequency ...)` parenthetical, then notes. A second event in the same
cell is detected by looking ahead up to three lines for a time pattern
before any parenthesis. The Discord boilerplate line
`(Check on the Sorcery TCG Australia Discord)` is dropped on purpose.

`src/lib/sheet/parse.test.ts` runs the parser against
`project/data_raw.json`, the real sheet export from launch, and pins the
event count per city and a few tricky cells (stacked events, suburb lines,
a non-frequency parenthetical, a weekday prefix on the time). Run
`npm test` after touching the parser.

## Snapshot and refresh

- `scripts/fetch-data.ts` runs as `prebuild`. It merges: a tab that fails
  keeps its previous snapshot section; total failure keeps the file as is.
  So `src/data/site-data.json` is always the last known good data and is
  committed.
- In the browser `SiteDataProvider` calls the same loader and applies the
  same merge, then shows "Live from the sheet" or "Showing the last
  snapshot" in the board footer.
- The clock (`now`) is `null` until after hydration, so server and client
  markup match; anything date-dependent (today marker, day numbers, "next
  table", relative dates) renders once mounted.

## Known environment quirks

- Claude Code sandboxes (and some CI runners) cannot reach
  `docs.google.com`, `discord.com` or the CARTO tile servers. Build with
  `SKIP_SHEET_FETCH=1` there; the committed snapshot is used. GitHub
  Actions can reach all three, so production builds fetch the real sheet.
- `next/font/google` downloads the three fonts at build time from Google
  Fonts and self-hosts them in `out/_next/static/media`. That needs network
  at build time but nothing at runtime.
- Leaflet is imported dynamically inside `StoreMap` and only once the
  section is near the viewport, so it never runs during the static build.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Board shows "Showing the last snapshot" for everyone | Sheet sharing changed away from "Anyone with the link", or a tab was renamed (names in `src/lib/config.ts` are case-sensitive) |
| One city is empty | Its tab name no longer matches `CITIES`, or the `MON ... SUN` header row is missing |
| An event merged into another or landed on the wrong day | Free-text cell shape; keep type / venue / time / (freq) on separate lines, blank line between stacked events |
| "Next table" says nothing is listed | Only weekly events with a parseable `H:MM` time count |
| Deploy fails at "Build" | Read the log: the fetch script prints which tab failed; a total failure still builds. A type error or failing parser test stops the deploy on purpose |
| Preview URL not printed | Preview uploads only run for pushes to non-main branches; look for the `versions upload` step output |
