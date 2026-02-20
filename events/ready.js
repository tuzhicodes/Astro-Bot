const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,

    async execute(client) {
        const config = client.config;
        
        console.log(`✅ Logged in as ${client.user.tag}`);
        console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
        console.log(`👥 Total users: ${client.users.cache.size}`);

        // Resolve status text with placeholders
        const rawText = process.env.STATUS_TEXT || '{prefix}help | {commands} commands';
        
        const statusText = rawText
            .replace('{prefix}', config.globalPrefix)
            .replace('{commands}', client.commands.size + client.prefixCommands.size)
            .replace('{guilds}', client.guilds.cache.size)
            .replace('{users}', client.users.cache.reduce((acc, g) => acc + g.memberCount, 0));

        // Map status type
        const typeMap = {
            Playing: ActivityType.Playing,
            Streaming: ActivityType.Streaming,
            Listening: ActivityType.Listening,
            Watching: ActivityType.Watching,
            Competing: ActivityType.Competing
        };
        
        const activityType = typeMap[process.env.STATUS_TYPE] || ActivityType.Watching;

        // Set presence
        client.user.setPresence({
            status: process.env.STATUS_STATE || 'online',
            activities: [{
                name: statusText,
                type: activityType,
            }],
        });

        console.log(`🎮 Status: [${process.env.STATUS_TYPE || 'Watching'}] ${statusText}`);
    }
};

