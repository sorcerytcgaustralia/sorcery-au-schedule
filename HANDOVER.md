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

## Realmdle (the daily card game, in Discord)

Guess the Sorcery card of the day in six tries, with the `/realmdle` slash
command in the community server. Every step is private (Discord's
ephemeral replies, visible only to the player); the one public message is
the player's result, posted to #realmdle when they finish. There is no
game on the website.

```
/realmdle play                      your board for today (also the Play button on the midnight post)
/realmdle guess card:<name>         autocomplete lists each set separately, e.g. "Pudge Butcher (Beta)"
/realmdle stats [player]            your stats; someone else's only if they joined the leaderboard
/realmdle leaderboard [sort]        top ten by current streak, or by solved % (5+ games), plus your place
/realmdle settings leaderboard:<>   join or leave the leaderboard
/realmdle forget-me confirm:True    delete your record and every game
```

### Rules

- **Clues:** element (match, or close if one element is shared), type,
  cost and power (close within one, with a higher/lower arrow), rarity
  and set (with a rarer/newer arrow). The sixth and last guess also shows
  the answer's subtypes (Monster, Mortal, Spirit...) as a hint.
- **One entry per card per set:** Apprentice Wizard in Alpha
  (`C000001-001`) and in Beta (`C000001-002`) are separate guesses and
  answers, with the same stats and a different set. Foils and other
  finishes in a set are the same entry. Tokens and promo printings are
  left out.
- **One possible answer:** a card can only be the answer if no other card
  shares all six of its clue values; otherwise a player could turn every
  clue green and still be wrong. About 620 of ~1,480 entries qualify.
  Avatars (no rarity) can be guessed but are never the answer.

### Choosing each day's answer

`extendSchedule` in `src/lib/realmdle/engine.ts` picks each new day by
these rules, in order:

1. A new set's cards wait 14 days after release (`GRACE_DAYS`).
2. A card name is never the answer twice within 365 days, in any set
   (`NAME_GAP`); there are more eligible names than days, so this never
   has to bend.
3. The entry that has been the answer the fewest times goes next; a card
   that becomes eligible later joins level with those still waiting in
   the current round, so a new set gets a fair share of days.
4. Then the name that has waited longest, then a hash of the day mixed
   with the secret `PLAN_SALT`, so the public code cannot be used to work
   out answers.

The Worker keeps the `puzzles` table filled to a week ahead
(`LOCK_DAYS`), replaying the history in the table; rows are never changed
once written. Planning takes about 3 ms even after five years.

### Pieces

```
worker/index.ts            /api/discord/interactions and the hourly cron (every other path is the static site)
worker/discord.ts          signature check, the commands, posting results and the midnight message
worker/game.ts             planning, scoring guesses, stats and leaderboard queries
worker/env.ts              the bindings and secrets, all optional until set up
migrations/                D1 schema: puzzles, players, plays, announcements
src/lib/realmdle/          rules and planner (engine), stats, embed designs (discord), card adapter
src/data/cards.json        the card pool, refreshed daily by .github/workflows/refresh-cards.yml
scripts/fetch-cards.ts     builds cards.json from the Sorcery Card Registry
scripts/discord-commands.mjs  registers /realmdle on the server
scripts/discord-smoke.mjs  end-to-end rehearsal against the local Worker (25 checks)
```

- **One server:** commands from any server other than `DISCORD_GUILD_ID`,
  or from DMs, are refused, so the stats and leaderboard are the server's.
- **Trust:** Discord signs every interaction with the application's
  Ed25519 key; unsigned or altered requests get 401, so nobody can play as
  someone else by calling the endpoint directly.
- **Stats** (played, solved %, current and best streak, guess spread,
  average) are computed from `plays` by `stats.ts`, never stored. A streak
  survives until a whole day is missed.
- **The public result** shows the player's name (a mention, which does not
  ping them), score, squares, streak, solved % and the day's solve count.
  It never names the card. The bot posts it to `DISCORD_CHANNEL_ID`.
- **The midnight post** goes to the same channel on the first hourly run
  of the Sydney day: yesterday's card and solve count, and a Play button.
  The `announcements` table makes it once per day.
- **Privacy:** the database holds the Discord id, display name, avatar
  hash and guesses, nothing else. The leaderboard is opt-in, and
  `/realmdle forget-me` deletes everything for that player.

### Card data

`src/data/cards.json` comes from the [Sorcery Card Registry](https://github.com/sadkinglabs/sorcery-registry),
served by KairosArchive at `api.kairosarchive.net/v3/registry.json`. The
daily refresh workflow fetches the 80-byte `registry.json.sha256` and only
downloads the 6 MB export when it changed, as the registry asks, sending a
`User-Agent` that names the site. On a change it runs the tests, commits
`cards.json` to `main` and starts a deploy. Site builds never fetch cards.
To seed from a local clone of the registry:
`npx tsx scripts/fetch-cards.ts path/to/sorcery-registry/export/registry.json`.

### Setup (once, with the Cloudflare account and Discord admin rights)

1. **Database:** `npx wrangler d1 create realmdle`, paste the id into the
   commented `d1_databases` block in `wrangler.jsonc` and uncomment it,
   then `npx wrangler d1 migrations apply realmdle --remote`.
2. **Discord application** at https://discord.com/developers/applications:
   copy the Public Key (General Information) into `vars.DISCORD_PUBLIC_KEY`
   in `wrangler.jsonc`. Under Bot, reset the token and save it with
   `npx wrangler secret put DISCORD_BOT_TOKEN`.
3. **Server and channel:** with Developer Mode on, copy the server id into
   `vars.DISCORD_GUILD_ID` and the #realmdle channel id into
   `vars.DISCORD_CHANNEL_ID`.
4. **Planner salt:** `npx wrangler secret put PLAN_SALT` with a long random
   string (`openssl rand -base64 32`). Keep it once live.
5. **Deploy** (merge to `main`), then set the Interactions Endpoint URL
   (General Information) to `https://realmofoz.com/api/discord/interactions`.
   Discord checks it with a signed ping when you save.
6. **Invite the bot:** OAuth2 URL Generator, scopes `bot` and
   `applications.commands`, permissions View Channel, Send Messages and
   Embed Links.
7. **Register the command:**
   `DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... node scripts/discord-commands.mjs`.

Previews share the production database and secrets, so a preview version
plays with real data. Discord only ever calls the production URL.

### Local rehearsal

```sh
node scripts/discord-smoke.mjs keys > .dev.vars   # test key pair, fake server and channel ids
SKIP_SHEET_FETCH=1 npx next build                  # the Worker serves ./out
npm run api:dev -- --test-scheduled                # local D1 + Worker on :8787
npm run api:smoke                                  # 25 checks, with a stand-in Discord API on :8799
```
