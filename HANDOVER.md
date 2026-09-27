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
  `.github/workflows/refresh-cards.yml` runs `scripts/fetch-cards.ts`
  daily on `main`: it fetches the 80-byte `registry.json.sha256` and only
  downloads the 6 MB export when that differs from the `sha256` in
  `src/data/cards.json`, as the registry's usage notes ask. It sends a
  `User-Agent` naming the site, which the registry requires. If
  `cards.json` or `schedule.json` changed, it runs the tests, commits both
  to `main` and starts a deploy. **Site builds never fetch cards**; they
  only read the committed files, so a build cannot change an answer.
- **New sets:** a new set's cards can be guessed as soon as the registry
  has them, and can be the answer from 14 days after the set's release
  (`GRACE_DAYS`). On the next daily run the schedule is replanned from a
  week out (`LOCK_DAYS`), so the new set is mixed in within about three
  weeks of release, taking a fair share of days (level with the cards
  still waiting their turn in the current round). A rehearsal with a
  300-card set gave it 30 to 42% of days, with no name repeats.
- **Seeding without network:** `npx tsx scripts/fetch-cards.ts
  path/to/sorcery-registry/export/registry.json` builds the pool (and
  replans the schedule) from a local clone of the registry repo. Commit
  both data files.
- **Adapter:** `src/lib/realmdle/adapter.ts` makes **one entry per card
  per release set**: Apprentice Wizard in Alpha (`C000001-001`) and in
  Beta (`C000001-002`) are separate guesses and separate answers, with
  the same stats and a different set. Foils and other finishes in a set
  are the same entry; its art comes from the set's standard booster
  printing. Stats come from the card record (`power`, not `attack`;
  `["None"]` elements are colourless). Tokens and promo printings are
  left out, and the promo set is not in the set order (it is dated before
  Alpha). Entries without a rarity (avatars) can be guessed but are never
  the answer.
- **Rules:** `src/lib/realmdle/engine.ts`, tested in `engine.test.ts`.
  Six guesses. The puzzle number is days since 28 Sep 2026 in Sydney.
- **One answer per puzzle:** a card can only be the answer if no other
  card shares all six of its clue values (its `signature`). Otherwise a
  player could turn every tile green and still be wrong. About 620 of the
  ~1,480 entries qualify, spread across every set including Beta; most
  Sites and all avatars do not.
- **Schedule:** `src/data/schedule.json` lists the answer for every
  puzzle about a year ahead (puzzle n is `answers[n - 1]`), plus the
  checksum of the card pool it was planned from. Days up to today never
  change; the next 7 days stay put unless their card stops being the only
  one fitting its clues; later days are replanned whenever the pool
  changes (`replan` in `engine.ts`). Otherwise it is topped up once a
  month. Each new day follows these rules in order: (1) a new set's cards
  wait out their grace period; (2) a card name is never the answer twice
  within 365 days, in any set (`NAME_GAP`), so the Alpha and Beta copies
  of a card are always at least a year apart; (3) the entry that has been
  the answer the fewest times goes next, and a newly eligible card joins
  level with the ones still waiting in the current round; (4) then the
  name that has waited longest, then a hash. Rule 2 can always be met
  because there are more eligible names (~465) than days in a year.
  `schedule.test.ts` checks the committed file on every CI run and stops
  the deploy if a name repeats within a year or a scheduled card is no
  longer eligible. Past its end the day falls back to a hash of the
  puzzle number over the pool.
- **Clues:** element (match, or close if one element is shared), type,
  cost and power (close within one, with a higher/lower chevron), rarity
  and set (with a rarer/newer chevron). Guessing the Alpha copy when the
  answer is the Beta copy shows every stat green and the set tile newer.
- **Hint:** on the sixth and last guess the answer's subtypes (Monster,
  Mortal, Spirit...) are revealed, or "no subtype" for most spells and
  sites. Subtypes are never a per-guess clue.
- **State:** guesses and streaks live in `localStorage` only, and the game
  works without it. Keys are versioned (`realmdle:v3:*`) so a rule change
  such as the guess count does not mix old boards with new. The copied result uses emoji squares because that is
  what renders in Discord; the page itself uses none.
- **Images** are hotlinked from `api.kairosarchive.net/images/`, which the
  registry allows with credit to Erik's Curiosa (in the page footer).

## Realmdle backend (accounts, stats, leaderboard)

With the backend set up, players sign in with Discord and the server runs
the game: it holds the answer, scores every guess and keeps each play, so
streaks and stats follow a player across devices (and, later, into the
Discord slash commands). Until it is set up, `/api/*` answers
`503 not_configured` and `/daily` plays in the browser as before.

**Pieces**

```
worker/index.ts      routes /api/* (every other path is served from ./out untouched)
worker/auth.ts       Discord OAuth2 (identify scope) and the signed session cookie
worker/game.ts       planning, scoring, stats and leaderboard queries
worker/env.ts        the bindings and secrets, all optional until set up
migrations/          D1 schema: puzzles, players, plays
src/lib/realmdle/    rules, planner and stats, shared by the page and the Worker
scripts/api-smoke.mjs  end-to-end check against the local Worker
```

- **puzzles** holds every past day and the week ahead. The hourly cron
  (and the first request of a day, as a fallback) appends missing days with
  the same planner as `schedule.json`, replaying the history in the table.
  Rows are never changed once written.
- **Answers are secret.** The planner mixes in `PLAN_SALT`, so the public
  code and data cannot be used to work out future answers, and the API only
  returns the answer once a player's puzzle is over. (The committed
  `schedule.json` is only used by the in-browser fallback and does not
  match the server's answers.)
- **plays** is one row per player per puzzle. Stats (played, win rate,
  current and best streak, guess spread, average) are computed from it by
  `src/lib/realmdle/stats.ts`, never stored, so they cannot drift. A streak
  survives until a whole day is missed.
- **Sessions** are an HMAC-signed cookie (`SESSION_SECRET`), HttpOnly and
  SameSite=Lax, 30 days. Changes (`POST`/`DELETE`) must send JSON from this
  site's origin. Two guesses at once cannot both count: the update only
  applies if the play still has the number of guesses it was read with.
- **Privacy:** the database holds the Discord id, display name and guesses,
  nothing else. The leaderboard is opt-in; "delete my Realmdle data" on
  `/daily` removes the player and every play.

**Setup (once, by someone with the Cloudflare account and a Discord login)**

1. Create the database and apply the schema:
   `npx wrangler d1 create realmdle`, paste the id into the commented
   `d1_databases` block in `wrangler.jsonc` and uncomment it, then
   `npx wrangler d1 migrations apply realmdle --remote`.
2. At https://discord.com/developers/applications create an application
   ("Realmdle"). Under OAuth2 add the redirect
   `https://realmofoz.com/api/auth/callback`. Put its Client ID in
   `vars.DISCORD_CLIENT_ID` in `wrangler.jsonc` (it is public), then
   `npx wrangler secret put DISCORD_CLIENT_SECRET`.
3. `npx wrangler secret put SESSION_SECRET` and
   `npx wrangler secret put PLAN_SALT`, each a long random string
   (`openssl rand -base64 32`). Never change `PLAN_SALT` once live: only
   unplanned days would change, but keep it stable anyway.
4. Merge and deploy. Check `/api/today` returns a board, then sign in.

Preview versions share the production database and secrets, so a preview
is played with real accounts; Discord sign-in only works on origins listed
as redirects in step 2.

**Local development**

```sh
printf 'SESSION_SECRET=dev-secret-0123456789\nPLAN_SALT=dev-salt\n' > .dev.vars
SKIP_SHEET_FETCH=1 npx next build      # the Worker serves ./out
npm run api:dev                        # local D1 + Worker on http://127.0.0.1:8787
npm run api:smoke                      # in another terminal: 17 end-to-end checks
```

Open http://127.0.0.1:8787/api/auth/dev?id=123&name=Tester to sign in
without Discord. That route only exists when `DEV_LOGIN` is `"true"` (set
only in the `dev` environment) and the host is localhost.

**Next: Discord slash commands.** `/realmdle` in the server, answered by
the same Worker (Discord signs each interaction; verify with the
application's public key), writing `plays` rows with `source = 'discord'`,
so web and Discord share one play per day and one set of stats.
