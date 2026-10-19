const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const config = require('./Config');
const { startBot, getStatus } = require('./src/bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple JSON status endpoint for uptime checks (e.g. Render, Railway, Koyeb)
app.get('/health', (req, res) => res.json({ ok: true, bot: getStatus() }));

// Push status changes to the dashboard
io.on('connection', socket => socket.emit('status', getStatus()));

const emitStatus = () => io.emit('status', getStatus());

server.listen(config.PORT, () => {
    console.log(`Dashboard listening on http://localhost:${config.PORT}`);
});

startBot({ onStatusChange: emitStatus }).catch(err => {
    console.error('Fatal: bot failed to start:', err);
    process.exit(1);
});

// Exit cleanly so a process manager (PM2, Docker) can restart us
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
