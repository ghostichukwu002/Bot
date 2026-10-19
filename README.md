# Kord-AI Clone

A modular WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys), with a plugin loader, group admin commands, and a small status dashboard. It is a clean rebuild written from the public description of Kord-AI, not a copy of its code.

> **Warning:** Baileys is an unofficial WhatsApp client. Accounts that automate messages can be banned. Use a spare number.

## Setup

Requires Node.js 18 or newer.

```bash
npm install
npm start                # set variables in your shell first, see Configuration
```

On first start, the bot shows a QR code in the terminal. Scan it from WhatsApp → Linked devices. To pair with a code instead, set `PAIRING_NUMBER` to your number with country code and no `+`.

The dashboard runs at http://localhost:3000 and `/health` returns JSON for uptime checks.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OWNER_NUMBER` | empty | Owner's number, digits only |
| `OWNER_NAME` | `Owner` | Shown by `.owner` |
| `PREFIX` | `.,/` | Comma-separated command prefixes |
| `MODE` | `public` | `private` restricts commands to the owner |
| `PAIRING_NUMBER` | empty | Pair with a code instead of QR |
| `AUTH_DIR` | `auth_info` | Where login credentials are stored |
| `PORT` | `3000` | Dashboard and health port |
| `LOG_LEVEL` | `silent` | Baileys log level, e.g. `info` or `debug` |

Keep `auth_info/` private. Anyone with it can act as your WhatsApp account.

## Commands

| Command | Who | Description |
| --- | --- | --- |
| `.ping` | everyone | Check the bot is responding |
| `.menu` / `.help` | everyone | List commands |
| `.echo <text>` | everyone | Repeat text |
| `.owner` | everyone | Show the owner |
| `.groupinfo` | groups | Show group name and size |
| `.tagall [note]` | groups | Mention all members |
| `.kick @user` | groups, admin | Remove mentioned members |
| `.restart` | owner | Exit so PM2 or Docker restarts the bot |

## Adding a command

Create a file in `src/plugins/`. It should export an array of command objects. The loader picks it up on start.

```js
module.exports = [{
    name: 'hello',
    aliases: ['hi'],
    description: 'Say hello',
    async run({ reply, sender }) {
        await reply(`Hello, ${sender.split('@')[0]}`);
    },
}];
```

Each `run` receives `sock`, `msg`, `from`, `sender`, `args`, `text`, `isGroup`, `isOwner`, `reply(text)` and `react(emoji)`. Options are `ownerOnly` and `groupOnly`.

## Running in production

- **PM2:** `npx pm2 start index.js --name kord-ai`
- **Docker or a VPS:** run `npm start` under systemd or PM2 so it restarts after a crash.
- The process exits on `.restart` so the manager brings it back.

## Notes

- Session credentials persist in `AUTH_DIR`. Do not share pairing codes or session IDs with third-party sites.
- This project is MIT licensed. Credit the original Kord-AI authors if you reuse or fork their work.
