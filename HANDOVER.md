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
3. September 2026: rebuilt on Next.js keeping the original design and
   UX, with a build-time snapshot plus browser refresh, a TypeScript port
   of the sheet parser with tests, and preview deploys per branch.

## Design intent

The page is the original site's structure and interaction, kept on
purpose: hero, Organised Play (Weekly / Special toggle, All plus seven
city tabs, seven-day agenda), the three dispatches (decks, Hall of Fame,
community with the live Discord card), the store explorer, the footer.
If you add something, keep to this system:

- **Two typefaces, two jobs.** Marcellus SC for the nav brand, the
  masthead title and section headings; Spectral for everything else.
- **Near-black ground, one warm orange.** The orange (`--ember`) is the
  only accent: links, the active tab, today, buttons. Gold is reserved for
  Grand Contest events, red for Cornerstone. Tokens live in `:root` in
  `src/app/globals.css`.
- **No glyphs, no ornaments.** No decorative symbols, section marks,
  emoji, arrows in copy, double rules, clipped corners or stamps. Featured
  panels get a hairline border and a soft shadow instead. Icons are drawn
  SVG only where they mark an action (calendar, Discord, Curiosa).
- **Motion is the fan lifting and the city marker sliding.** Nothing else.
- **The Discord card exists to show how many people are live**, to entice
  participation. Keep it prominent.
- No em dashes anywhere in copy or code, by request.

## Where things are

```
src/components/SiteDataProvider.tsx   snapshot -> state, browser refresh, the one city selection
src/components/Masthead.tsx           hero art, title, two hero links
src/components/Schedule.tsx           Weekly / Special toggle, agenda, special events + archive
src/components/CityTabs.tsx           the shared city row with its travelling marker
src/components/Dispatches.tsx         decks fan, Hall of Fame teaser, community + Discord card
src/components/Hall.tsx               the /hall ledger
src/components/Stores.tsx, StoreMap.tsx   city-synced store explorer, lazy Leaflet map (CARTO tiles)
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

## The map of the realm (available, not placed)

`src/components/Chart.tsx` draws an ink map of Australia on parchment in
the manner of Tolkien's maps: the real coast from Natural Earth
(`src/lib/australia.ts`, generated by `scripts/build-map.py`), hatching on
the sea side, ranges as pen strokes, sea names, a compass and a cartouche,
with the seven cities as buttons that select the city for the page. It was
built during the Register of the Realm exploration and is kept here ready
to place; its styles live in that exploration's stylesheet in git history
(commit `fd95bcf`, the `.map` rules) and need to be brought across with it.
