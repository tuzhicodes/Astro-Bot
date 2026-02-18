const { EmbedBuilder } = require('discord.js');
const config = require('./config');

module.exports = {
    // Send log to quarantine channel
    async sendLog(guild, settings, type, data, clientConfig) {
        const channel = await guild.channels.fetch(settings.quarantineChannel).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(config.getColor(clientConfig, data.color || 'error'))
            .setTimestamp();

        // Build message based on type
        let msgData;
        switch(type) {
            case 'detected':
                msgData = config.messages.detected(
                    config.emojis.shield,
                    data.user,
                    data.action,
                    data.target,
                    data.count,
                    data.limit
                );
                break;

            case 'punished':
                const pEmoji = config.punishmentEmojis[data.punishment] || config.emojis.warn;
                const extra = data.rolesSaved ? `\n**Roles Saved:** ${data.rolesSaved}` : '';
                msgData = config.messages.punished(pEmoji, data.user, data.punishment, data.reason, extra);
                break;

            case 'reverted':
                msgData = config.messages.reverted(data.user, data.action);
                break;

            case 'whitelisted':
                msgData = config.messages.whitelisted(data.user, data.action);
                break;

            case 'error':
                msgData = config.messages.error(data.error, data.action);
                break;

            case 'massAttack':
                msgData = config.messages.protectionTriggered(data.user, data.violations);
                break;
        }

        if (msgData) {
            embed.setTitle(msgData.title).setDescription(msgData.description);
        }

        // Add footer with user avatar
        if (data.user) {
            embed.setFooter({ 
                text: `ID: ${data.user.id}`, 
                iconURL: data.user.displayAvatarURL({ dynamic: true }) 
            });
        }

        // Add thumbnail
        if (data.user) {
            embed.setThumbnail(data.user.displayAvatarURL({ dynamic: true }));
        }

        await channel.send({ embeds: [embed] }).catch(() => {});
    },

    // Quick punishment log
    async punishLog(guild, settings, punishment, user, reason, clientConfig, extra = {}) {
        return this.sendLog(guild, settings, 'punished', {
            user,
            punishment,
            reason,
            rolesSaved: extra.rolesSaved,
            color: punishment === 'quarantine' || punishment === 'ban' ? 'error' : 'warn'
        }, clientConfig);
    }
};
      
