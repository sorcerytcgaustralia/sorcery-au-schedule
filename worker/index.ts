// The realmofoz.com Worker. Cloudflare serves the static site from ./out
// directly; only /api/* reaches this code (run_worker_first in wrangler.jsonc).
//
//   GET    /api/today          today's board for whoever is signed in (or signed out)
//   POST   /api/guess          { puzzle, cardId }: record a guess, return the board
//   GET    /api/leaderboard    players who opted in
//   POST   /api/settings       { leaderboard: boolean }
//   DELETE /api/me             delete my player record and every play
//   GET    /api/auth/discord   start Discord sign-in
//   GET    /api/auth/callback  Discord sends the player back here
//   POST   /api/auth/logout
//   GET    /api/auth/dev       localhost-only sign-in for testing (DEV_LOGIN)
//   POST   /api/discord/interactions  the /realmdle slash command (see discord.ts)

import type { ApiError, ApiErrorCode } from '../src/lib/realmdle/api';
import { puzzleNumber } from '../src/lib/realmdle/engine';
import { clearSessionCookie, clearStateCookie, finishDiscordLogin, readSession, sessionCookie, startDiscordLogin } from './auth';
import { announce, handleInteraction, postResultToChannel } from './discord';
import { discordReady, gameReady, type RealmdleEnv } from './env';
import { answerFor, board, deletePlayer, ensurePlanned, getPlayer, guess, leaderboard, setLeaderboard, upsertPlayer } from './game';

const STATUS: Record<ApiErrorCode, number> = {
  not_configured: 503,
  signed_out: 401,
  stale_puzzle: 409,
  bad_guess: 400,
  over: 409,
  conflict: 409,
  forbidden: 403,
  not_found: 404,
  server: 500,
};

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  // personal data: never cache in a shared cache
  headers.set('cache-control', 'private, no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

const fail = (code: ApiErrorCode, error: string, headers?: HeadersInit) => json({ code, error } satisfies ApiError, { status: STATUS[code], headers });

/**
 * Changes must come from this site's own pages: a JSON body (which a plain
 * cross-site form cannot send) and, when the browser says, the same origin.
 */
function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return (request.headers.get('content-type') ?? '').startsWith('application/json');
}

async function route(request: Request, env: RealmdleEnv, url: URL, ctx: ExecutionContext): Promise<Response> {
  const { pathname } = url;
  const method = request.method;
  // Discord authenticates these with its own signature, not a session
  if (pathname === '/api/discord/interactions' && method === 'POST') return handleInteraction(request, env, ctx);
  if (!gameReady(env)) return fail('not_configured', 'Realmdle accounts are not set up on this site yet.');

  // ---- sign-in ----
  if (pathname === '/api/auth/discord' && method === 'GET') {
    if (!discordReady(env)) return fail('not_configured', 'Discord sign-in is not set up yet.');
    return startDiscordLogin(request, env);
  }
  if (pathname === '/api/auth/callback' && method === 'GET') {
    if (!discordReady(env)) return fail('not_configured', 'Discord sign-in is not set up yet.');
    const user = await finishDiscordLogin(request, env);
    const headers = new Headers({ location: user ? '/daily' : '/daily?signin=failed' });
    headers.append('set-cookie', clearStateCookie(request));
    if (user) {
      await upsertPlayer(env.DB, user.id, user.name, user.avatar);
      headers.append('set-cookie', await sessionCookie(request, env, user.id));
    }
    return new Response(null, { status: 302, headers });
  }
  if (pathname === '/api/auth/dev' && method === 'GET') {
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (env.DEV_LOGIN !== 'true' || !local) return fail('not_found', 'Not found.');
    const id = url.searchParams.get('id') ?? '100000000000000001';
    await upsertPlayer(env.DB, id, url.searchParams.get('name') ?? `Tester ${id.slice(-3)}`);
    return new Response(null, { status: 302, headers: { location: '/daily', 'set-cookie': await sessionCookie(request, env, id) } });
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    if (!sameSite(request)) return fail('forbidden', 'Refused.');
    return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie(request) } });
  }

  // ---- the game ----
  const today = puzzleNumber(new Date());
  await ensurePlanned(env.DB, env.PLAN_SALT, today);
  const answer = await answerFor(env.DB, today);
  if (!answer) return fail('server', 'Today’s puzzle is missing.');

  const session = await readSession(request, env);
  // a valid cookie for a player who has since deleted their data counts as signed out
  const playerId = session && (await getPlayer(env.DB, session.id)) ? session.id : null;

  if (pathname === '/api/today' && method === 'GET') {
    return json(await board(env.DB, today, answer, playerId));
  }

  if (pathname === '/api/leaderboard' && method === 'GET') {
    return json(await leaderboard(env.DB, today, playerId, url.searchParams.get('sort') === 'solved' ? 'solved' : 'streak'));
  }

  if (!sameSite(request)) return fail('forbidden', 'Refused.');
  if (!playerId) return fail('signed_out', 'Sign in with Discord to play.');

  if (pathname === '/api/guess' && method === 'POST') {
    const body = (await request.json().catch(() => null)) as { puzzle?: number; cardId?: string } | null;
    if (!body || typeof body.cardId !== 'string') return fail('bad_guess', 'Send { puzzle, cardId }.');
    if (body.puzzle !== today) return fail('stale_puzzle', 'A new puzzle has started. Reload to play it.');
    const result = await guess(env.DB, playerId, today, answer, body.cardId, 'web');
    if (!result.ok) return fail(result.code, result.error);
    const b = await board(env.DB, today, answer, playerId);
    // finishing on the web posts the same public result in the Realmdle channel
    if (b.over) {
      const player = await getPlayer(env.DB, playerId);
      ctx.waitUntil(postResultToChannel(env, b, { id: playerId, name: player?.display_name ?? 'A player', avatar: player?.avatar ?? null }));
    }
    return json(b);
  }

  if (pathname === '/api/settings' && method === 'POST') {
    const body = (await request.json().catch(() => null)) as { leaderboard?: boolean } | null;
    if (typeof body?.leaderboard !== 'boolean') return fail('bad_guess', 'Send { leaderboard: true | false }.');
    await setLeaderboard(env.DB, playerId, body.leaderboard);
    return json(await board(env.DB, today, answer, playerId));
  }

  if (pathname === '/api/me' && method === 'DELETE') {
    await deletePlayer(env.DB, playerId);
    return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie(request) } });
  }

  return fail('not_found', 'Not found.');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url, ctx);
    } catch (err) {
      console.error(err);
      return fail('server', 'Something went wrong. Try again in a moment.');
    }
  },

  // Hourly (see triggers in wrangler.jsonc): plan today and the week ahead,
  // so the first player of the day never waits on the planner, and post the
  // day's announcement on the first run after midnight in Sydney.
  async scheduled(_event, env, ctx) {
    if (!gameReady(env)) return;
    const today = puzzleNumber(new Date());
    ctx.waitUntil(ensurePlanned(env.DB, env.PLAN_SALT, today).then(() => announce(env, today)));
  },
} satisfies ExportedHandler<RealmdleEnv>;
