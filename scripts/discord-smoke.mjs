// End-to-end check of Realmdle's Discord side against the local Worker,
// with a stand-in for Discord's API that records what the bot posts.
//
//   node scripts/discord-smoke.mjs keys   # prints .dev.vars lines (a test key pair)
//   npm run api:dev                        # with those lines in .dev.vars
//   node scripts/discord-smoke.mjs         # signs interactions like Discord does
//
// Checks: signatures, private boards, autocomplete, the hint, the public
// result (and that it never names the card), stats privacy, the
// leaderboard, the Play button, web results reaching the channel and the
// once-a-day midnight post.

import { execSync } from 'node:child_process';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

if (process.argv[2] === 'keys') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const priv = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('hex');
  console.log(`DISCORD_PUBLIC_KEY=${pub}\nDISCORD_TEST_PRIVATE_KEY=${priv}\nDISCORD_BOT_TOKEN=test-token\nDISCORD_CHANNEL_ID=555\nDISCORD_API=http://127.0.0.1:8799`);
  process.exit(0);
}

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:8787';
const vars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const key = createPrivateKey({ key: Buffer.from(vars.DISCORD_TEST_PRIVATE_KEY, 'hex'), format: 'der', type: 'pkcs8' });
const cards = JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8')).cards;

// ---- a stand-in for discord.com/api that records posts ----
const posts = [];
const mock = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    posts.push({ path: req.url, auth: req.headers.authorization ?? null, body: JSON.parse(body || '{}') });
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"id":"1"}');
  });
});
await new Promise((r) => mock.listen(8799, '127.0.0.1', r));
const waitForPost = async (n) => {
  for (let i = 0; i < 50 && posts.length < n; i++) await new Promise((r) => setTimeout(r, 100));
  return posts[n - 1];
};

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
};

const run = Date.now().toString().slice(-6);
const user = (n, name) => ({ id: `8${run}${String(n).padStart(11, '0')}`, username: name.toLowerCase(), global_name: name, avatar: null });
let seq = 0;
async function interact(body, { signed = true } = {}) {
  const text = JSON.stringify({ id: String(++seq), application_id: 'app1', token: `tok${seq}`, ...body });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signed ? sign(null, Buffer.from(timestamp + text), key).toString('hex') : '00'.repeat(64);
  const res = await fetch(`${BASE}/api/discord/interactions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp }, body: text });
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
}
const command = (u, sub, options = [], resolved) => interact({ type: 2, member: { user: u }, data: { name: 'realmdle', options: [{ type: 1, name: sub, options }], resolved } });
const guess = (u, card) => command(u, 'guess', [{ type: 3, name: 'card', value: card }]);

// ---- today's answer, read from the local database ----
const today = (await (await fetch(`${BASE}/api/today`)).json()).puzzle;
const sql = `SELECT card_id FROM puzzles WHERE puzzle = ${today}`;
const ANSWER = JSON.parse(execSync(`npx wrangler d1 execute realmdle --local --env dev --json --command "${sql}"`, { stdio: ['ignore', 'pipe', 'ignore'] }))[0].results[0].card_id;
const answer = cards.find((c) => c.id === ANSWER);
const wrong = cards.filter((c) => c.name !== answer.name && !cards.some((o) => o.name === c.name && o.id !== c.id)).slice(0, 6);

const eve = user(1, 'Eve');
const finn = user(2, 'Finn');

let r = await interact({ type: 1 }, { signed: false });
check('refuses an unsigned request', r.status === 401);
r = await interact({ type: 1 });
check('answers Discord’s ping', r.body.type === 1);

r = await command(eve, 'play');
check('play: a private board, guess 1 of 6', r.body.data.flags === 64 && r.body.data.embeds[0].title === `Realmdle #${today} · guess 1 of 6`);

r = await interact({ type: 4, member: { user: eve }, data: { name: 'realmdle', options: [{ type: 1, name: 'guess', options: [{ type: 3, name: 'card', value: 'apprentice wiz', focused: true }] }] } });
const names = r.body.data.choices.map((c) => c.name);
check('autocomplete offers each set separately', r.body.type === 8 && names.includes('Apprentice Wizard (Alpha)') && names.includes('Apprentice Wizard (Beta)'), names.join(', '));

r = await guess(eve, 'Apprentice Wizard');
check('a typed name in two sets asks which one', r.body.data.content.includes('Alpha and Beta'));

for (let i = 0; i < 5; i++) r = await guess(eve, wrong[i].id);
const board5 = JSON.stringify(r.body.data);
check('five wrong guesses: private board with the hint, no answer', r.body.data.flags === 64 && board5.includes('Last guess, a hint') && !board5.includes(answer.name));

r = await interact({ type: 4, member: { user: eve }, data: { name: 'realmdle', options: [{ type: 1, name: 'guess', options: [{ type: 3, name: 'card', value: wrong[0].name, focused: true }] }] } });
check('autocomplete leaves out cards already guessed', !r.body.data.choices.some((c) => c.value === wrong[0].id));

r = await guess(eve, ANSWER);
check('solving it: the private board reveals the card', r.body.data.flags === 64 && r.body.data.embeds[0].title === `Solved in 6: ${answer.name}`);
const result = await waitForPost(1);
const resultText = JSON.stringify(result?.body);
check('then the result is posted publicly in the channel', result?.path === `/webhooks/app1/tok${seq}` && result.body.flags === undefined && result.body.embeds[0].author.name === `Eve · Realmdle #${today} · 6/6`);
check('the public result never names the card', !resultText.includes(answer.name) && !resultText.includes(answer.image ?? 'no-image'));
check('the result mentions the player without pinging', resultText.includes(`<@${eve.id}>`) && result.body.allowed_mentions.parse.length === 0);

r = await guess(eve, wrong[5].id);
check('no guesses after finishing', r.body.data.content.includes('already finished'));

r = await command(eve, 'stats');
check('stats: private, with streak and solved %', r.body.data.flags === 64 && r.body.data.embeds[0].fields[1].value === '100%' && r.body.data.embeds[0].description.includes('Solved today'));

r = await command(finn, 'stats', [{ type: 6, name: 'player', value: eve.id }], { users: { [eve.id]: eve } });
check('someone else’s stats stay private until they join the leaderboard', r.body.data.content.includes('private'));
r = await command(eve, 'settings', [{ type: 5, name: 'leaderboard', value: true }]);
check('joining the leaderboard', r.body.data.content.includes('You are on the leaderboard'));
r = await command(finn, 'stats', [{ type: 6, name: 'player', value: eve.id }], { users: { [eve.id]: eve } });
check('then others can see them', r.body.data.embeds?.[0].author.name === 'Eve · Realmdle stats');

r = await command(finn, 'leaderboard');
check('leaderboard by streak lists Eve, with a tip for Finn to join', r.body.data.embeds[0].description.includes(`<@${eve.id}>`) && r.body.data.content.includes('not on the leaderboard'));
r = await command(finn, 'leaderboard', [{ type: 3, name: 'sort', value: 'solved' }]);
check('leaderboard by solved % needs 5 games', r.body.data.embeds[0].title.includes('solved %') && !r.body.data.embeds[0].description.includes(eve.id));

r = await interact({ type: 3, member: { user: finn }, data: { custom_id: 'realmdle:play' } });
check('the Play button opens Finn’s private board', r.body.data.flags === 64 && r.body.data.embeds[0].title.includes('guess 1 of 6'));

// a web player finishing: the bot posts the result in the channel
const cookie = (await fetch(`${BASE}/api/auth/dev?id=${finn.id}&name=Finn`, { redirect: 'manual' })).headers.get('set-cookie').split(';')[0];
await fetch(`${BASE}/api/guess`, { method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ puzzle: today, cardId: ANSWER }) });
const webPost = await waitForPost(2);
check('a web finish is posted to the Realmdle channel by the bot', webPost?.path === '/channels/555/messages' && webPost.auth === 'Bot test-token' && webPost.body.embeds[0].footer.text.includes('realmofoz.com'));

// the midnight post: once, however often the hourly job runs
await fetch(`${BASE}/cdn-cgi/handler/scheduled?cron=7+*+*+*+*`);
await fetch(`${BASE}/cdn-cgi/handler/scheduled?cron=7+*+*+*+*`);
await new Promise((res) => setTimeout(res, 1500));
const announcements = posts.filter((p) => p.body.components);
check('the midnight post goes out once, with a Play button', announcements.length === 1 && announcements[0].body.components[0].components[0].custom_id === 'realmdle:play', `${announcements.length} posted`);

mock.close();
console.log(failures ? `\n${failures} failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
