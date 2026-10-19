const fs = require('fs');
const path = require('path');

// Every .js file in this folder (except this loader) exports an array of command objects:
// module.exports = [{ name, aliases, description, run(ctx), ownerOnly, groupOnly }]
const commands = new Map();

function loadPlugins() {
    commands.clear();
    const dir = __dirname;

    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.js') || file === 'loader.js') continue;

        const mod = require(path.join(dir, file));
        for (const cmd of mod) {
            for (const key of [cmd.name, ...(cmd.aliases || [])]) {
                commands.set(key.toLowerCase(), cmd);
            }
        }
    }
    console.log(`Loaded ${new Set(commands.values()).size} commands`);
}

function findCommand(name) {
    return name ? commands.get(name) : undefined;
}

function listCommands() {
    return [...new Set(commands.values())];
}

module.exports = { loadPlugins, findCommand, listCommands };
