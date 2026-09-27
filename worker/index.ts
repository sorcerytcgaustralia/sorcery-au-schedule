// The realmofoz.com Worker. Cloudflare serves the static site from ./out
// directly; only /api/* reaches this code (run_worker_first in wrangler.jsonc).
//
// Realmdle is played in Discord only:
//
//   POST /api/discord/interactions   the /realmdle slash command (see discord.ts)
//
// and an hourly cron plans the week ahead and posts the midnight message.

import { puzzleNumber } from '../src/lib/realmdle/engine';
import { announce, handleInteraction } from './discord';
import { gameReady, type RealmdleEnv } from './env';
import { ensurePlanned } from './game';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/discord/interactions' && request.method === 'POST') {
      try {
        return await handleInteraction(request, env, ctx);
      } catch (err) {
        console.error(err);
        return new Response('Something went wrong', { status: 500 });
      }
    }
    return new Response('Not found', { status: 404 });
  },

  // Hourly (see triggers in wrangler.jsonc): plan today and the week ahead,
  // so a player never waits on the planner, and post the day's message on
  // the first run after midnight in Sydney.
  async scheduled(_event, env, ctx) {
    if (!gameReady(env)) return;
    const today = puzzleNumber(new Date());
    ctx.waitUntil(ensurePlanned(env.DB, env.PLAN_SALT, today).then(() => announce(env, today)));
  },
} satisfies ExportedHandler<RealmdleEnv>;
