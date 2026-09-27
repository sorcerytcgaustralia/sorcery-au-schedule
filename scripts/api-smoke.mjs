// End-to-end check of the Realmdle API against the local Worker.
//
//   npm run api:dev        (in one terminal: local D1 + Worker on :8787)
//   npm run api:smoke      (in another)
//
// Signs in test players with the localhost-only dev login, plays through a
// loss and a win, and checks the refusals (wrong origin, form posts, stale
// day, tampered cookie), the leaderboard opt-in and data deletion. It reads
// today's answer straight from the local database, which only works locally.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:8787';
const cards = JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8')).cards;

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
};
const login = async (id, name) =>
  (await fetch(`${BASE}/api/auth/dev?id=${id}&name=${encodeURIComponent(name)}`, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
const get = (path, cookie) => fetch(BASE + path, { headers: cookie ? { cookie } : {} });
const send = (method, path, cookie, body, headers = {}) =>
  fetch(BASE + path, { method, headers: { 'content-type': 'application/json', origin: BASE, ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body) });
const post = (path, cookie, body, headers) => send('POST', path, cookie, body, headers);

const first = await (await get('/api/today')).json();
const today = first.puzzle;
const sql = `SELECT card_id FROM puzzles WHERE puzzle = ${today}`;
const ANSWER = JSON.parse(execSync(`npx wrangler d1 execute realmdle --local --env dev --json --command "${sql}"`, { stdio: ['ignore', 'pipe', 'ignore'] }))[0].results[0].card_id;
const answer = cards.find((c) => c.id === ANSWER);
const wrong = cards.filter((c) => c.name !== answer.name).slice(0, 7).map((c) => c.id);
const run = Date.now().toString().slice(-6); // fresh player ids on every run
const id = (n) => `9${run}${String(n).padStart(11, '0')}`;

check('signed out: a board with no player and no answer', first.player === null && first.answer === null);

const alice = await login(id(1), 'Alice');
let b = await (await get('/api/today', alice)).json();
check('dev sign-in: the board knows the player', b.player?.name === 'Alice' && b.guesses.length === 0);

let r = await fetch(`${BASE}/api/guess`, { method: 'POST', headers: { cookie: alice, 'content-type': 'text/plain' }, body: JSON.stringify({ puzzle: today, cardId: wrong[0] }) });
check('refuses a form-style (non-JSON) request', r.status === 403);
r = await post('/api/guess', alice, { puzzle: today, cardId: wrong[0] }, { origin: 'https://evil.example' });
check('refuses another origin', r.status === 403);
r = await post('/api/guess', alice, { puzzle: today + 1, cardId: wrong[0] });
check('refuses a guess for another day', r.status === 409 && (await r.json()).code === 'stale_puzzle');
r = await post('/api/guess', alice, { puzzle: today, cardId: 'C999999-001' });
check('refuses an unknown card', r.status === 400);
r = await post('/api/guess', null, { puzzle: today, cardId: wrong[0] });
check('refuses a signed-out guess', r.status === 401);
r = await post('/api/guess', alice.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), { puzzle: today, cardId: wrong[0] });
check('a tampered session cookie counts as signed out', r.status === 401);

for (let i = 0; i < 5; i++) b = await (await post('/api/guess', alice, { puzzle: today, cardId: wrong[i] })).json();
check('five wrong guesses: feedback and the hint, answer still hidden', b.guesses.length === 5 && b.hint !== null && b.answer === null && !JSON.stringify(b).includes(ANSWER));
r = await post('/api/guess', alice, { puzzle: today, cardId: wrong[0] });
check('refuses a card already guessed', r.status === 400);
b = await (await post('/api/guess', alice, { puzzle: today, cardId: wrong[5] })).json();
check('sixth wrong guess: over, lost, answer revealed', b.over && !b.won && b.answer === ANSWER && b.stats.currentStreak === 0);
r = await post('/api/guess', alice, { puzzle: today, cardId: wrong[6] });
check('no guesses after the end', r.status === 409);

const bob = await login(id(2), 'Bob');
b = await (await post('/api/guess', bob, { puzzle: today, cardId: ANSWER })).json();
check('a first-try win', b.won && b.over && b.stats.won === 1 && b.stats.currentStreak === 1 && b.stats.distribution[0] === 1);

let lb = await (await get('/api/leaderboard', bob)).json();
const listed = (rows) => rows.some((row) => row.you);
check('not on the leaderboard until opting in', !listed(lb));
await post('/api/settings', bob, { leaderboard: true });
lb = await (await get('/api/leaderboard', bob)).json();
check('opted in: listed and marked as you', listed(lb));

const carol = await login(id(3), 'Carol');
const both = await Promise.all([post('/api/guess', carol, { puzzle: today, cardId: wrong[0] }), post('/api/guess', carol, { puzzle: today, cardId: wrong[1] })]);
const accepted = both.filter((x) => x.status === 200).length;
b = await (await get('/api/today', carol)).json();
check('two guesses at once: the board records exactly the accepted ones', b.guesses.length === accepted && accepted >= 1, `${accepted} accepted`);

r = await send('DELETE', '/api/me', alice, {});
b = await (await get('/api/today', alice)).json();
check('deleting my data signs me out and removes me', r.status === 200 && b.player === null);

console.log(failures ? `\n${failures} failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
