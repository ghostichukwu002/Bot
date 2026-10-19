const os = require('os');
const config = require('../../Config');
const { listCommands } = require('./loader');

const started = Date.now();

module.exports = [
    {
        name: 'ping',
        description: 'Check that the bot is responding',
        async run({ reply }) {
            const latency = Date.now() - started;
            await reply(`Pong! Up for ${Math.floor(latency / 1000)}s on ${os.hostname()}.`);
        },
    },
    {
        name: 'menu',
        aliases: ['help'],
        description: 'List available commands',
        async run({ reply, isOwner }) {
            const lines = listCommands()
                .filter(c => isOwner || !c.ownerOnly)
                .map(c => `• ${config.PREFIX[0]}${c.name} - ${c.description || ''}`);
            await reply(`*Commands*\n\n${lines.join('\n')}`);
        },
    },
    {
        name: 'echo',
        aliases: ['say'],
        description: 'Repeat the text you send',
        async run({ args, reply }) {
            if (!args.length) return reply('Usage: .echo <text>');
            await reply(args.join(' '));
        },
    },
    {
        name: 'owner',
        description: 'Show the bot owner',
        async run({ reply }) {
            await reply(`Owner: ${config.OWNER_NAME}`);
        },
    },
    {
        name: 'restart',
        description: 'Exit so the process manager restarts the bot',
        ownerOnly: true,
        async run({ reply }) {
            await reply('Restarting...');
            setTimeout(() => process.exit(0), 500);
        },
    },
];
