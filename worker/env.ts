/**
 * What the Worker is given by Cloudflare. Everything Realmdle needs is
 * optional: until the database and secrets exist the API answers "not
 * configured" and the page plays in the browser instead.
 */
export type RealmdleEnv = {
  ASSETS: Fetcher;
  DB?: D1Database;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  /** Signs session cookies. Any long random string. */
  SESSION_SECRET?: string;
  /** Mixed into the answer planner so answers cannot be worked out from the public code. */
  PLAN_SALT?: string;
  /** "true" enables /api/auth/dev on localhost, for local testing only. */
  DEV_LOGIN?: string;
};

/** The database and secrets the game itself needs (Discord sign-in is checked separately). */
export const gameReady = (env: RealmdleEnv): env is RealmdleEnv & { DB: D1Database; SESSION_SECRET: string; PLAN_SALT: string } =>
  Boolean(env.DB && env.SESSION_SECRET && env.PLAN_SALT);

export const discordReady = (env: RealmdleEnv) => Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
