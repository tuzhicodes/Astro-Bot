module.exports = {
    // Emojis
    emojis: {
        shield: '🛡️',
        warn: '⚠️',
        ban: '🔨',
        kick: '👢',
        quarantine: '🚨',
        timeout: '⏰',
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        revert: '↩️',
        delete: '🗑️',
        create: '✨',
        update: '📝',
        bot: '🤖',
        channel: '📁',
        role: '👑',
        webhook: '🔗',
        emoji: '😀',
        sticker: '🎨',
        soundboard: '🔊',
        mention: '📢'
    },

    // Get color from config
    getColor: (config, type) => parseInt(config.colors[type]?.replace('#', '') || 'FF0000', 16),

    // Message templates
    messages: {
        detected: (emoji, user, action, target, count, limit) => ({
            title: `${emoji} THREAT DETECTED`,
            description: `**User:** ${user.tag} (${user.id})\n**Action:** ${action}\n**Target:** ${target || 'N/A'}\n**Count:** ${count}/${limit}`
        }),

        punished: (emoji, user, punishment, reason, extra = '') => ({
            title: `${emoji} ${punishment.toUpperCase()} EXECUTED`,
            description: `**User:** ${user.tag}\n**Reason:** ${reason}${extra}`
        }),

        reverted: (user, action) => ({
            title: `↩️ ACTION REVERTED`,
            description: `**User:** ${user.tag}\n**Reverted:** ${action}`
        }),

        whitelisted: (user, action) => ({
            title: `✅ WHITELISTED ACTION`,
            description: `**User:** ${user.tag}\n**Action:** ${action}\n**Reason:** User is protected`
        }),

        error: (error, action) => ({
            title: `❌ PROTECTION ERROR`,
            description: `**Error:** ${error}\n**Action:** ${action}`
        }),

        protectionTriggered: (user, violations) => ({
            title: `🚨 MASS ATTACK DETECTED`,
            description: `**User:** ${user.tag}\n**Violations:** ${violations.join(', ')}`
        })
    },

    // Action to emoji mapping
    actionEmojis: {
        channelCreate: '✨',
        channelDelete: '🗑️',
        channelPermUpdate: '📝',
        roleCreate: '✨',
        roleDelete: '🗑️',
        rolePermUpdate: '📝',
        banAdd: '🔨',
        kickAdd: '👢',
        botAdd: '🤖',
        webhookCreate: '🔗',
        memberRoleUpdate: '👑',
        emojiCreate: '😀',
        emojiDelete: '🗑️',
        stickerCreate: '🎨',
        stickerDelete: '🗑️',
        soundboardCreate: '🔊',
        soundboardDelete: '🗑️',
        mentionSpam: '📢'
    },

    // Punishment emojis
    punishmentEmojis: {
        quarantine: '🚨',
        ban: '🔨',
        kick: '👢',
        timeout: '⏰',
        warn: '⚠️',
        delete: '🗑️'
    }
};
          
