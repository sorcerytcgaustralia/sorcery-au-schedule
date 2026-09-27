// Sign-in with Discord (OAuth2, `identify` scope only) and the session
// cookie that remembers it.
//
// The session is a signed cookie, not a database row: the Discord user id
// and an expiry, plus an HMAC-SHA256 signature with SESSION_SECRET. The
// Worker can trust it without a lookup, and a tampered cookie fails the
// signature check. HttpOnly keeps it away from page scripts; SameSite=Lax
// means other sites cannot make a signed-in POST on a player's behalf.

import type { RealmdleEnv } from './env';

const SESSION_COOKIE = 'rd_session';
const STATE_COOKIE = 'rd_oauth';
const SESSION_DAYS = 30;

export type Session = { id: string; exp: number };

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = '';
  for (const b of view) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): string {
  return atob(text.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Compares without stopping at the first difference, so timing reveals nothing. */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

function cookie(request: Request, name: string, value: string, maxAge: number): string {
  // Secure everywhere but plain-http localhost, where browsers would drop it
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function sessionCookie(request: Request, env: RealmdleEnv, id: string): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ id, exp: Date.now() + SESSION_DAYS * 86_400_000 } satisfies Session)));
  return cookie(request, SESSION_COOKIE, `${payload}.${await hmac(env.SESSION_SECRET!, payload)}`, SESSION_DAYS * 86_400);
}

export function clearSessionCookie(request: Request): string {
  return cookie(request, SESSION_COOKIE, '', 0);
}

export async function readSession(request: Request, env: RealmdleEnv): Promise<Session | null> {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw || !env.SESSION_SECRET) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !equal(signature, await hmac(env.SESSION_SECRET, payload))) return null;
  try {
    const session = JSON.parse(fromBase64url(payload)) as Session;
    return typeof session.id === 'string' && session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

const callbackUrl = (request: Request) => `${new URL(request.url).origin}/api/auth/callback`;

/** Step 1: send the player to Discord, with a one-time `state` to check on return. */
export function startDiscordLogin(request: Request, env: RealmdleEnv): Response {
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: env.DISCORD_CLIENT_ID!,
    scope: 'identify',
    redirect_uri: callbackUrl(request),
    state,
    prompt: 'none',
  }).toString();
  return new Response(null, { status: 302, headers: { location: url.toString(), 'set-cookie': cookie(request, STATE_COOKIE, state, 600) } });
}

export type DiscordUser = { id: string; name: string };

/**
 * Step 2: Discord sends the player back with a `code`. Check the state
 * matches the cookie set in step 1 (so the sign-in was started here), swap
 * the code for a token, and ask Discord who the player is. The token is
 * used once and not stored.
 */
export async function finishDiscordLogin(request: Request, env: RealmdleEnv): Promise<DiscordUser | null> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const expected = readCookie(request, STATE_COOKIE);
  const code = url.searchParams.get('code');
  if (!code || !state || !expected || !equal(state, expected)) return null;

  const token = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(request),
    }),
  });
  if (!token.ok) return null;
  const { access_token } = (await token.json()) as { access_token: string };

  const me = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${access_token}` } });
  if (!me.ok) return null;
  const user = (await me.json()) as { id: string; username: string; global_name: string | null };
  return { id: user.id, name: user.global_name || user.username };
}

export function clearStateCookie(request: Request): string {
  return cookie(request, STATE_COOKIE, '', 0);
}
