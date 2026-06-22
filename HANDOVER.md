# Handover — Sorcery TCG Australia Schedule Site

A reference doc so anyone (including future-you, or a future Claude session)
can pick this project back up, understand how it works, and troubleshoot it
without re-deriving everything from scratch.

## What this is

A static website showing the weekly Sorcery: Contested Realm organised-play
schedule for 7 Australian cities, plus a live "who's online" Discord card.
No backend, no build step — it's plain HTML/CSS/JS that fetches live data
straight from the visitor's browser.

- **Live site:** `https://sorcerytcgaustralia.github.io/sorcery-au-schedule/`
  (once GitHub Pages is enabled — see below)
- **Repo:** `https://github.com/sorcerytcgaustralia/sorcery-au-schedule`
- **Hosting:** GitHub Pages, free, serving directly from the `main` branch
- **Data source 1 — schedule:** Google Sheet
  `https://docs.google.com/spreadsheets/d/1DZiYwc0o4YKxtS_bn86jfXyIQKpV92XGhEJaL503uS8/edit`
  read live via Google's public `gviz` JSON endpoint (no API key, no backend).
  Must stay shared **"Anyone with the link" → Viewer**.
- **Data source 2 — Discord card:** Discord's public widget JSON
  (`https://discord.com/api/guilds/<id>/widget.json`). Requires
  **Server Settings → Widget → Enable Server Widget** turned on in the
  Discord server.

If either source is unreachable, the site falls back to a plain "check the
Discord" message rather than breaking.

## Project structure

```
index.html          page structure (hero, schedule grid, Discord card, footer)
css/styles.css       all styling
js/config.js         sheet ID, city list, Discord server ID/invite — edit here to retarget
js/sheet-data.js      fetches + parses the Google Sheet (gviz JSON), free-text cell parser
js/discord-widget.js  fetches the Discord widget JSON, shapes it for the card
js/app.js             renders everything, wires up city tabs, bootstraps on page load
.nojekyll            disables Jekyll processing on GitHub Pages
README.md            day-to-day "how to edit the schedule" guide for non-technical editors
project/, chats/      original Claude Design handoff bundle, kept for reference only
```

Read `README.md` first for the day-to-day "how do I update the schedule"
instructions (the sheet's free-text cell format, frequency keywords, the
`Updated: DD/MM/YY` row convention, etc). This document is the deeper
technical/troubleshooting layer underneath that.

## How the schedule parsing works

`js/sheet-data.js` fetches each city's tab from the Sheet as JSON
(`gviz/tq?tqx=out:json&sheet=<CityName>`) and runs each day's cell through
`parseCell(raw)` — a small state machine, not a strict format parser. It:

- Splits each cell into lines, treats the first non-time-like line as the
  event "type", looks for a `HH:MM - HH:MM`-style time line, and a
  `(weekly|fortnightly|monthly)` parenthetical for frequency.
- Supports **multiple events in one cell** (e.g. Melbourne's Saturday) by
  using a lookahead heuristic (`looksLikeNewEventStart`) that peeks up to 3
  lines ahead for a time-pattern before a frequency-parenthesis, to decide
  whether a blank line starts a new event block or is just spacing inside
  prose. This was validated against the real exported sheet data
  (`project/data_raw.json`) for all 7 cities before launch.
- Falls back to scanning the type/note text for frequency words
  (`inferFreqFromText`) when there's no explicit `(weekly)`-style tag.
- Strips the boilerplate "(Check on the Sorcery TCG Australia Discord)"
  parenthetical out of notes — matches the original design's editorial
  choice, not a bug if you see it disappear.
- A row whose first cell is `Updated: DD/MM/YY` sets that city's "last
  updated" date. If a tab has more than one such row (happened with
  Brisbane during testing), the **last** one found wins.

If you add a new city or change a tab name, update `CITIES` in
`js/config.js` to match the sheet's tab names exactly (case-sensitive).

## Known environment quirks

- **This was built inside a sandboxed Claude Code session that could not
  reach `google.com` or `discord.com` at all** (outbound network policy
  blocked those domains entirely, including plain `https://www.google.com`).
  This is a sandbox limitation, not a real-world issue — once deployed,
  visitors' browsers reach both fine. It just meant testing had to rely on
  the graceful-fallback path (loading → error state) rather than live data,
  plus the user manually confirming the Sheet's public sharing worked in an
  incognito browser.
- The CSS has one deliberately-added specificity fix:
  `.day-col.is-today.is-empty .day-label` — without it, "today" and "empty"
  day-column label colors could fight based on source order.

## Local preview

No build step needed. From the repo root:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Note the schedule and Discord card need
real network access to `docs.google.com` and `discord.com` to load — if
you're testing somewhere with restricted network access, you'll see the
fallback "check the Discord" states instead, which is expected.

## Deploying changes

GitHub Pages serves directly from `main`, root folder — there is no build
or Actions step. Any push to `main` updates the live site within a minute
or two. To enable Pages on a fresh clone of this repo: **Settings → Pages →
Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**

## Troubleshooting checklist

| Symptom | Likely cause |
|---|---|
| Schedule grid stuck on "Loading…" or shows the error fallback for every city | Sheet sharing got changed away from "Anyone with the link"; or the Sheet ID in `js/config.js` is wrong; or a tab was renamed and no longer matches `CITIES` in `js/config.js` |
| One city errors but others are fine | That city's tab name doesn't match `CITIES` exactly, or the tab was deleted/renamed |
| Discord card shows the static fallback ("Come on in") instead of live data | Server Widget got disabled (Server Settings → Widget), or `DISCORD_GUILD_ID` in `js/config.js` is wrong |
| An event is missing or merged into the wrong day | Check the raw cell in the Sheet — the parser is heuristic; keeping each field (type/venue/suburb/time/frequency/note) on its own line, and using a blank line between stacked events in the same cell, gives the most reliable result |
| Frequency badge shows "Check dates" when it shouldn't | No `(weekly)`/`(fortnightly)`/`(monthly)` parenthetical present and the fallback text-scan didn't find a frequency keyword either — add the parenthetical explicitly |
| Site looks fine locally but not on GitHub Pages | Check Settings → Pages is actually enabled and pointed at `main` / root; check browser console for 404s (path casing issues are case-sensitive on GitHub Pages even though some local dev servers aren't) |

## Getting a local copy on your machine

This project currently only exists in: (a) the GitHub repo, and (b) whatever
cloud session created it. To get a working local copy on your own computer:

```
cd C:\Users\micro\Desktop\STA
git clone https://github.com/sorcerytcgaustralia/sorcery-au-schedule.git .
```

(Or clone into a fresh `STA` folder if it doesn't exist yet:
`git clone https://github.com/sorcerytcgaustralia/sorcery-au-schedule.git C:\Users\micro\Desktop\STA`)

That gives you the full commit history and all files. From then on, `git
pull` in that folder will fetch any updates made elsewhere (including by a
future Claude Code session working against this same repo).

## Picking this back up with Claude Code

To resume work on this project in a future session, either:
- Point Claude Code at the cloned local folder (`C:\Users\micro\Desktop\STA`), or
- Start a new Claude Code on the web session with this GitHub repo as the source.

Either way, start by pointing the assistant at this `HANDOVER.md` and the
`README.md` — between the two, there's enough context to make changes,
debug data issues, or extend the site without re-discovering the parsing
heuristics or sandbox quirks from scratch.
