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

- **Three typefaces, three jobs.** Marcellus SC for the nav brand, the
  masthead title, section and event headings and city names; Spectral for
  reading; IBM Plex Sans for measurements (times, dates, tabs, labels).
- **Near-black ground, one warm orange.** The orange (`--ember`) is the
  only accent: links, the active tab, today, buttons. Gold is reserved for
  Grand Contest events, red for Cornerstone. Tokens live in `:root` in
  `src/app/globals.css`.
- **No glyphs, no ornaments.** No decorative symbols, section marks,
  emoji, arrows in copy, double rules, clipped corners or stamps. Featured
  panels get a hairline border and a soft shadow instead. Icons are drawn
  SVG only where they mark an action (calendar, Discord, SorceryTCG).
- **Motion is the fan lifting, the city marker sliding and the map
  settling behind the masthead.** Nothing else.
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

Routes are static: `/`, `/hall`, `/daily` and the 404 page. Picking a city writes
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
| Deploy fails at "Build" | Read the log: the fetch script prints which tab failed; a total failure still builds. A type error or failing parser test stops the deploy on purpose |
| Preview URL not printed | Preview uploads only run for pushes to non-main branches; look for the `versions upload` step output |

## The map of the realm

`src/components/MapBackdrop.tsx` draws the real coast of Australia from
Natural Earth (`src/lib/australia.ts`, generated by `scripts/build-map.py`)
with hatching, ranges and the seven cities, as a faded, masked SVG behind
the masthead. It is decorative only (`aria-hidden`); the cities on it are
not controls. Its styles are the `.masthead-map` rules in `globals.css`.

## Realmdle (`/daily`)

A daily guess-the-card game for the Discord. Everyone gets the same card
each day with no server involved.

- **Data:** the [Sorcery Card Registry](https://github.com/sadkinglabs/sorcery-registry)
  export, served by KairosArchive at `api.kairosarchive.net/v3/registry.json`.
  `scripts/fetch-cards.ts` runs in `prebuild` after the sheet fetch. It
  first fetches the 80-byte `registry.json.sha256` and only downloads the
  6 MB export when that differs from the `sha256` stored in
  `src/data/cards.json`, as the registry's usage notes ask (the data
  changes a few times a year). It sends a `User-Agent` naming the site,
  which the registry requires. Any failure keeps the committed file and
  never fails the build; the page never calls the API.
- **Seeding without network:** `npx tsx scripts/fetch-cards.ts
  path/to/sorcery-registry/export/registry.json` builds the pool from a
  local clone of the registry repo.
- **Adapter:** `src/lib/realmdle/adapter.ts` maps registry cards to the
  game's shape: `codex_id` as the id, `["None"]` elements as colourless,
  `power` (not `attack`), and the first printing in a release set. Tokens
  and the few promo-only cards are left out, and promo sets are not in the
  set order (they are dated before Alpha). Cards without a rarity
  (avatars) can be guessed but are never the answer.
- **Rules:** `src/lib/realmdle/engine.ts`, tested in `engine.test.ts`.
  Six guesses. The puzzle number is days since 28 Sep 2026 in Sydney.
- **One answer per puzzle:** a card can only be the answer if no other
  card shares all six of its clue values (its `signature`). Otherwise a
  player could turn every tile green and still be wrong. About 465 of the
  ~1,050 cards qualify; most Sites and all avatars do not.
- **Schedule:** `src/data/schedule.json` lists the answer for every
  puzzle a year ahead (puzzle n is `answers[n - 1]`). The fetch script
  only ever appends to it, never edits it, so no rebuild or new set can
  change a day that is already set. Every eligible card is used once
  before any repeats. Past its end, or if a scheduled card later gains a
  twin, the day falls back to a hash of the puzzle number over the pool.
  Commit the file when it grows.
- **Clues:** element (match, or close if one element is shared), type,
  cost and power (close within one, with a higher/lower chevron), rarity
  and first set (with a rarer/newer chevron). A card in several sets only
  counts its first release set; promos never count.
- **Hint:** on the sixth and last guess the answer's subtypes (Monster,
  Mortal, Spirit...) are revealed, or "no subtype" for most spells and
  sites. Subtypes are never a per-guess clue.
- **State:** guesses and streaks live in `localStorage` only, and the game
  works without it. Keys are versioned (`realmdle:v2:*`) so a rule change
  such as the guess count does not mix old boards with new. The copied result uses emoji squares because that is
  what renders in Discord; the page itself uses none.
- **Images** are hotlinked from `api.kairosarchive.net/images/`, which the
  registry allows with credit to Erik's Curiosa (in the page footer).
