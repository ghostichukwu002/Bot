const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const config = require('./Config');
const { startBot, getStatus, getPublicStatus, requestPairingCode, logout } = require('./src/bot');
const { listCommands } = require('./src/plugins/loader');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Landing page at /, status dashboard at /dashboard
app.use(express.static(path.join(__dirname, 'landing')));
app.use('/dashboard', express.static(path.join(__dirname, 'public')));

// Simple fixed-window rate limiter, per client IP, for admin routes.
// Limits guessing of the admin token and abuse of pairing requests.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ADMIN_REQUESTS = 10;
const hits = new Map();

function rateLimit(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.start > WINDOW_MS) {
        hits.set(ip, { start: now, count: 1 });
        return next();
    }
    entry.count++;
    if (entry.count > MAX_ADMIN_REQUESTS) {
        res.set('Retry-After', String(Math.ceil((entry.start + WINDOW_MS - now) / 1000)));
        return res.status(429).json({ error: 'too many requests, try again later' });
    }
    next();
}

// Admin routes need ADMIN_TOKEN, sent as "Authorization: Bearer <token>".
// If ADMIN_TOKEN is not set, these routes refuse every request.
function requireAdmin(req, res, next) {
    const token = process.env.ADMIN_TOKEN;
    if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN is not set on the server' });

    const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(given);
    const b = Buffer.from(token);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    next();
}

// Public endpoints. These never include the linked WhatsApp number.
app.get('/health', (req, res) => res.json({ ok: true, bot: getPublicStatus() }));

app.get('/api/status', (req, res) => res.json(getPublicStatus()));

app.get('/api/commands', (req, res) => {
    res.json(
        listCommands().map(c => ({
            name: c.name,
            aliases: c.aliases || [],
            description: c.description || '',
            ownerOnly: !!c.ownerOnly,
            groupOnly: !!c.groupOnly,
        }))
    );
});

// Admin endpoints
// Pair the owner's number only. Other numbers are refused, so the server never
// becomes a public pairing service.
app.post('/api/pair', rateLimit, requireAdmin, async (req, res) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    if (!config.OWNER_NUMBER || phone !== config.OWNER_NUMBER) {
        return res.status(403).json({ error: 'Only the owner number can be paired' });
    }
    try {
        const code = await requestPairingCode(phone);
        res.json({ code: code.match(/.{1,4}/g).join('-') });
    } catch (err) {
        res.status(409).json({ error: err.message });
    }
});

app.post('/api/logout', rateLimit, requireAdmin, async (req, res) => {
    try {
        await logout();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Push status changes to the dashboard
io.on('connection', socket => socket.emit('status', getPublicStatus()));
const emitStatus = () => io.emit('status', getPublicStatus());

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

server.listen(config.PORT, () => {
    console.log(`Server listening on http://localhost:${config.PORT}`);
});

startBot({ onStatusChange: emitStatus }).catch(err => {
    console.error('Fatal: bot failed to start:', err);
    process.exit(1);
});

// Exit cleanly so a process manager (PM2, Docker) can restart us
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
