// Fetches the public Discord widget JSON (no auth needed, CORS-enabled) and
// shapes it into the fields the presence card needs. Requires Server
// Settings -> Widget -> Enable Server Widget on the Discord side.

import { DISCORD_GUILD_ID, DISCORD_INVITE_URL } from './config';

export interface DiscordPresence {
  serverName: string;
  inviteUrl: string;
  onlineCount: number;
  avatars: { url: string; status: string }[];
  moreCount: number;
  voiceRooms: { name: string; count: number }[];
}

interface WidgetMember {
  avatar_url?: string;
  status?: string;
  channel_id?: string;
}
interface WidgetPayload {
  name?: string;
  instant_invite?: string;
  presence_count?: number;
  members?: WidgetMember[];
  channels?: { id: string; name: string }[];
}

function shape(w: WidgetPayload): DiscordPresence {
  const onlineCount = w.presence_count || 0;
  const members = w.members || [];
  const avatars = members
    .filter((m) => m.avatar_url)
    .slice(0, 14)
    .map((m) => ({ url: m.avatar_url as string, status: m.status || 'online' }));
  const voiceRooms = (w.channels || [])
    .map((c) => ({ name: c.name, count: members.filter((m) => m.channel_id === c.id).length }))
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    serverName: w.name || 'Sorcery TCG Australia',
    inviteUrl: w.instant_invite || DISCORD_INVITE_URL,
    onlineCount,
    avatars,
    moreCount: Math.max(0, onlineCount - avatars.length),
    voiceRooms,
  };
}

export async function fetchDiscordPresence(timeoutMs = 7000): Promise<DiscordPresence | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`, { signal: controller.signal });
    if (!res.ok) return null;
    return shape((await res.json()) as WidgetPayload);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
