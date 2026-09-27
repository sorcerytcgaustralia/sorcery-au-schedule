// Registers the /realmdle slash command with Discord. Run once, and again
// whenever the definitions below change:
//
//   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... node scripts/discord-commands.mjs
//
// Add DISCORD_GUILD_ID=... to register on one server only, which updates
// instantly (global commands can take up to an hour to appear).

const { DISCORD_APPLICATION_ID: app, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guild } = process.env;
if (!app || !token) {
  console.error('Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN.');
  process.exit(1);
}

const SUB = 1;
const STRING = 3;
const BOOLEAN = 5;
const USER = 6;

const commands = [
  {
    name: 'realmdle',
    description: 'Guess the Sorcery card of the day',
    // usable in servers and in DMs with the bot
    contexts: [0, 1],
    options: [
      { type: SUB, name: 'play', description: 'Show your board for today (only you can see it)' },
      {
        type: SUB,
        name: 'guess',
        description: 'Guess a card',
        options: [{ type: STRING, name: 'card', description: 'Start typing a card name', required: true, autocomplete: true }],
      },
      {
        type: SUB,
        name: 'stats',
        description: 'Your streak, solved % and guess spread',
        options: [{ type: USER, name: 'player', description: 'Someone else on the leaderboard' }],
      },
      {
        type: SUB,
        name: 'leaderboard',
        description: 'Longest streaks, or best solved %',
        options: [
          {
            type: STRING,
            name: 'sort',
            description: 'What to rank by',
            choices: [
              { name: 'Current streak', value: 'streak' },
              { name: 'Solved % (5+ games)', value: 'solved' },
            ],
          },
        ],
      },
      {
        type: SUB,
        name: 'settings',
        description: 'Join or leave the leaderboard',
        options: [{ type: BOOLEAN, name: 'leaderboard', description: 'Show your streak and solved % to the server', required: true }],
      },
    ],
  },
];

const url = `https://discord.com/api/v10/applications/${app}${guild ? `/guilds/${guild}` : ''}/commands`;
const res = await fetch(url, { method: 'PUT', headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(commands) });
if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}
console.log(`Registered /realmdle ${guild ? `on server ${guild}` : 'globally'}.`);
