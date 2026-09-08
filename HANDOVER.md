# Handover notes

Technical context for whoever picks this project up next, human or
assistant. Read `README.md` first for how the data and the deploy work;
this file is the layer underneath.

## What this is

Sorcery TCG Australia, https://realmofoz.com: a static Next.js site for the Sorcery:
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
3. September 2026: rebuilt on Next.js with a build-time snapshot plus
   browser refresh, a TypeScript port of the sheet parser with tests, and
   preview deploys per branch.
4. September 2026: redesigned as the Register of the Realm (see Design
   intent).

## Design intent: the Register of the Realm

Read the design document first (Phase 1 critique, three directions, the
chosen system): it is the brief this page is built to. In short:

- **The chart of the realm is the identity and the place selector.** Seven
  cities at their true relative positions on a 44 by 20 degree graticule
  (`src/lib/chart.ts`), with coastal routes and coordinates. Selecting a
  city sets the place for the whole page; the live line, the register and
  the places follow. There is no coastline on purpose: the community is the
  seven places, not the landmass.
- **One register of time.** Weekly tables and special tournaments are one
  stream on a ruled spine: this week (only days that have tables, starting
  from today), coming up, recorded. The week ribbon carries a needle at the
  real day and hour; it moves each minute.
- **Three faces, three jobs.** Marcellus SC for the identity, places and
  champions; Spectral for reading; IBM Plex Sans for anything that is a
  measurement (times, coordinates, labels, the record table).
- **Ink ground, one ember.** Gold only for Grand Contest, red only for
  Cornerstone. No gradients as decoration, no glow, no glyphs, no
  ornaments, no eyebrow labels above headings, no numbered sections.
- **Artwork as works.** River of Flame is Plate I, full bleed and captioned;
  the avatars are a catalogue with museum labels (card, artist, the deck
  recorded against it). Only artwork already in the repo is used.
- **Motion explains state.** Marks arrive and routes draw once on load; the
  spine draws with scroll; the needle is live; entries rise in. Nothing
  scales on hover. Everything honours prefers-reduced-motion.
- No em dashes anywhere in copy or code, by request.

## Where things are

```
src/components/SiteDataProvider.tsx   snapshot -> state, browser refresh, the one city selection
src/components/Realm.tsx, Chart.tsx   the statement, the live line, the Discord note, the chart
src/components/Register.tsx           week ribbon with needle, the spine: this week, coming up, recorded
src/components/Plate.tsx              Plate I, River of Flame
src/components/Meta.tsx               the avatar catalogue with deck labels
src/components/Record.tsx             the record table (home) and the full record (/hall)
src/components/Places.tsx, StoreMap.tsx   places with their stores, lazy Leaflet map (CARTO tiles)
src/lib/chart.ts                      projection, city points, routes, label sides
src/lib/events.ts                     selectors: events per day, special events split, store matching
src/lib/time.ts                       city-local clocks via Intl, proximity, date labels
```

Routes are static: `/`, `/hall`, and the 404 page. Picking a city writes
`?city=Sydney` into the address bar with `history.replaceState`, so a
selection is shareable, and the same query opens on that city.

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
  same merge.
- The clock (`now`) is `null` until after hydration, so server and client
  markup match; the Today marker and the upcoming/past split of special
  events render once mounted.

## Known environment quirks

- Claude Code sandboxes (and some CI runners) cannot reach
  `docs.google.com`, `discord.com` or the CARTO tile servers. Build with
  `SKIP_SHEET_FETCH=1` there; the committed snapshot is used. GitHub
  Actions can reach all three, so production builds fetch the real sheet.
- `next/font/google` downloads the two fonts at build time from Google
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
| Deploy fails at "Build" | Read the log: the fetch script prints which tab failed; a total failure still builds. A type error or failing parser test stops the deploy on purpose |
| Preview URL not printed | Preview uploads only run for pushes to non-main branches; look for the `versions upload` step output |
