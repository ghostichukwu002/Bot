const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const config = require('../Config');
const { loadPlugins, findCommand } = require('./plugins/loader');

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

const state = {
    connection: 'starting', // starting | qr | pairing | open | closed
    user: null,
    startedAt: Date.now(),
};

let sock = null;
let onStatus = () => {};
// Each connect() gets a generation number. Event handlers from older sockets
// check it and do nothing, so stale sockets cannot start duplicate reconnects.
let generation = 0;
let reconnectTimer = null;

function setConnection(value) {
    state.connection = value;
    onStatus(getStatus());
}

// Full status, including the linked account. Use only for admin responses and logs.
function getStatus() {
    return {
        ...getPublicStatus(),
        user: state.user,
    };
}

// Status safe to show publicly. It omits the linked WhatsApp number.
function getPublicStatus() {
    return {
        connection: state.connection,
        linked: !!state.user,
        uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
        mode: config.MODE,
    };
}

function isOwner(jid) {
    const number = jidNormalizedUser(jid).split('@')[0];
    return config.OWNER_NUMBER && number === config.OWNER_NUMBER;
}

// Build a helper object passed to every plugin so they don't touch Baileys directly
function makeContext(msg) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

    return {
        sock,
        msg,
        from,
        sender,
        isGroup: from.endsWith('@g.us'),
        isOwner: isOwner(sender) || msg.key.fromMe,
        text,
        reply: content => sock.sendMessage(from, { text: content }, { quoted: msg }),
        react: emoji => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }),
    };
}

async function handleMessage(msg) {
    if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const ctx = makeContext(msg);
    if (!ctx.text) return;

    const prefix = config.PREFIX.find(p => ctx.text.startsWith(p));
    if (!prefix) return;

    const [name, ...args] = ctx.text.slice(prefix.length).trim().split(/\s+/);
    const command = findCommand(name?.toLowerCase());
    if (!command) return;

    if (config.MODE === 'private' && !ctx.isOwner) return;
    if (command.ownerOnly && !ctx.isOwner) {
        return ctx.reply('This command is for the bot owner only.');
    }
    if (command.groupOnly && !ctx.isGroup) {
        return ctx.reply('This command only works in groups.');
    }

    try {
        await command.run({ ...ctx, args, command: name.toLowerCase() });
    } catch (err) {
        logger.error(err);
        await ctx.reply(`Error running ${name}: ${err.message}`);
    }
}

async function connect() {
    const myGen = ++generation;
    const { state: authState, saveCreds } = await useMultiFileAuthState(config.AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    // A newer connect() started while we were waiting. Let it win.
    if (myGen !== generation) return;

    const thisSock = makeWASocket({
        version,
        auth: authState,
        logger,
        printQRInTerminal: false,
        browser: ['Kord-Clone', 'Chrome', '1.0.0'],
    });
    sock = thisSock;

    thisSock.ev.on('creds.update', saveCreds);

    // Pair with a number code when configured and this device is not yet registered
    if (config.PAIRING_NUMBER && !thisSock.authState.creds.registered) {
        setConnection('pairing');
        setTimeout(async () => {
            if (myGen !== generation) return;
            try {
                const code = await thisSock.requestPairingCode(config.PAIRING_NUMBER);
                console.log(`Pairing code: ${code.match(/.{1,4}/g).join('-')}`);
                console.log('WhatsApp > Linked devices > Link with phone number, then enter this code.');
            } catch (err) {
                console.error('Could not request pairing code:', err.message);
            }
        }, 3000);
    }

    thisSock.ev.on('connection.update', update => {
        if (myGen !== generation) return;
        const { connection, lastDisconnect, qr } = update;

        if (qr && !config.PAIRING_NUMBER) {
            setConnection('qr');
            console.log('Scan this QR code from WhatsApp > Linked devices:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            state.user = jidNormalizedUser(thisSock.user.id);
            console.log(`Connected as ${state.user}`);
            setConnection('open');
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const loggedOut = code === DisconnectReason.loggedOut;
            state.user = null;
            setConnection('closed');
            if (loggedOut) {
                console.error('Logged out from WhatsApp. Log out via the admin API or delete the auth folder, then pair again.');
                return;
            }
            console.log('Connection closed, reconnecting in 5s...');
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => connect().catch(err => console.error(err)), 5000);
        }
    });

    thisSock.ev.on('messages.upsert', ({ messages, type }) => {
        if (myGen !== generation || type !== 'notify') return;
        for (const msg of messages) {
            handleMessage(msg).catch(err => logger.error(err));
        }
    });
}

async function startBot({ onStatusChange } = {}) {
    if (onStatusChange) onStatus = onStatusChange;
    loadPlugins();
    await connect();
}

// Ask WhatsApp for a pairing code for this device. Used by the admin API.
async function requestPairingCode(phone) {
    if (!sock) throw new Error('Bot is not running yet');
    if (sock.authState.creds.registered) throw new Error('Already paired. Log out first to pair again.');
    return sock.requestPairingCode(phone);
}

// Log out of WhatsApp, delete local credentials and start again so a new pairing can be made.
async function logout() {
    if (!sock) throw new Error('Bot is not running yet');

    // Stop the current socket and any pending reconnect before touching credentials.
    // Bumping the generation makes the old socket's handlers ignore its own close event.
    clearTimeout(reconnectTimer);
    generation++;
    const old = sock;
    sock = null;
    try {
        await old.logout();
    } catch (err) {
        logger.error(err);
        try { old.end(undefined); } catch (_) { /* already closed */ }
    }

    fs.rmSync(config.AUTH_DIR, { recursive: true, force: true });
    state.user = null;
    setConnection('starting');
    setTimeout(() => connect().catch(err => console.error(err)), 1000);
}

module.exports = { startBot, getStatus, getPublicStatus, requestPairingCode, logout };
