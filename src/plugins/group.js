// Group administration commands. The bot must be an admin in the group for these to work.

async function isBotAdmin(sock, groupJid) {
    const meta = await sock.groupMetadata(groupJid);
    // sock.user.id looks like "2348012345678:12@s.whatsapp.net"; compare the number part only
    const botNumber = sock.user.id.split(':')[0].split('@')[0];
    return meta.participants.some(p => p.id.split('@')[0] === botNumber && p.admin);
}

function mentionedTargets(msg) {
    return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

module.exports = [
    {
        name: 'groupinfo',
        description: 'Show group name and member count',
        groupOnly: true,
        async run({ sock, from, reply }) {
            const meta = await sock.groupMetadata(from);
            await reply(`*${meta.subject}*\nMembers: ${meta.participants.length}`);
        },
    },
    {
        name: 'tagall',
        description: 'Mention every group member',
        groupOnly: true,
        async run({ sock, from, text }) {
            const meta = await sock.groupMetadata(from);
            const ids = meta.participants.map(p => p.id);
            const note = text.split(/\s+/).slice(1).join(' ');
            const body = `${note ? note + '\n\n' : ''}${ids.map(id => '@' + id.split('@')[0]).join(' ')}`;
            await sock.sendMessage(from, { text: body, mentions: ids });
        },
    },
    {
        name: 'kick',
        description: 'Remove mentioned members from the group',
        groupOnly: true,
        async run({ sock, from, msg, reply, isOwner }) {
            if (!isOwner && !(await isBotAdmin(sock, from))) {
                return reply('I need to be a group admin to do that.');
            }
            const targets = mentionedTargets(msg);
            if (!targets.length) return reply('Mention the members to remove.');
            await sock.groupParticipantsUpdate(from, targets, 'remove');
            await reply(`Removed ${targets.length} member(s).`);
        },
    },
];
