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

    // Phone number (digits only) to pair with a code instead of scanning a QR.
    // Leave empty to use QR.
    PAIRING_NUMBER: process.env.PAIRING_NUMBER || '',

    PORT: parseInt(process.env.PORT, 10) || 3000,
};
