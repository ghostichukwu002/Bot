// Runtime configuration. Values can be overridden with environment variables.
// Never commit real phone numbers, session data or tokens.

module.exports = {
    // Bot owner, digits only with country code, e.g. "2348012345678"
    OWNER_NUMBER: process.env.OWNER_NUMBER || '',
    OWNER_NAME: process.env.OWNER_NAME || 'Owner',

    // Command prefixes. Any of these starts a command, e.g. ".menu" or "/menu"
    PREFIX: (process.env.PREFIX || '.,/').split(',').map(p => p.trim()).filter(Boolean),

    // "public": anyone can use commands. "private": only the owner can use commands.
    MODE: process.env.MODE || 'public',

    // Folder where Baileys stores login credentials between restarts
    AUTH_DIR: process.env.AUTH_DIR || 'auth_info',

    // Secret for the admin API (/api/pair, /api/logout). Required to use those routes.
    // Use a long random value, e.g. `openssl rand -hex 32`.
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',

    // Phone number (digits only) to pair with a code instead of scanning a QR.
    // Leave empty to use QR.
    PAIRING_NUMBER: process.env.PAIRING_NUMBER || '',

    // Pterodactyl sets SERVER_PORT for the port assigned to the server. PORT is used elsewhere.
    PORT: parseInt(process.env.PORT || process.env.SERVER_PORT, 10) || 3000,
};
