// Fetches the public Discord widget JSON (no auth needed, CORS-enabled) and
// shapes it into the fields the "realm status" card needs.
// Requires Server Settings -> Widget -> Enable Server Widget on the Discord side.

(function () {
  const RING_FOR_STATUS = { online: '#3ba55d', idle: '#faa61a', dnd: '#ed4245' };

  function shapeWidget(w) {
    const onlineCount = w.presence_count || 0;
    const members = w.members || [];
    const avatars = members
      .filter((m) => m.avatar_url)
      .slice(0, 16)
      .map((m) => ({ url: m.avatar_url, ring: RING_FOR_STATUS[m.status] || '#747f8d' }));
    const moreCount = Math.max(0, onlineCount - avatars.length);
    const channels = w.channels || [];
    const voiceRooms = channels
      .map((c) => ({ name: c.name, count: members.filter((m) => m.channel_id === c.id).length }))
      .filter((v) => v.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      serverName: w.name || 'Sorcery TCG Australia',
      inviteUrl: w.instant_invite || window.CONFIG.DISCORD_INVITE_URL,
      onlineCount,
      avatars,
      moreCount,
      voiceRooms,
    };
  }

  function fetchDiscordWidget(timeoutMs = 7000) {
    const url = `https://discord.com/api/guilds/${window.CONFIG.DISCORD_GUILD_ID}/widget.json`;
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve({ status: 'error' }); }
      }, timeoutMs);

      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status: 'ok', data: shapeWidget(data) });
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status: 'error' });
        });
    });
  }

  window.DiscordWidget = { fetchDiscordWidget };
})();
