const fs = require('fs-extra');
const path = require('path');
const sendMessage = require('./sendMessage');
const config = require('./config');

// Cache
const RECENT_ACTIONS = new Map();
const AUDIT_CACHE = new Set();

// Data path helper
const getDataPath = (guildId) => path.join(__dirname, '..', '..', 'data', 'antinuke', guildId);

// Loaders
async function loadSettings(guildId) {
    const file = path.join(getDataPath(guildId), 'settings.json');
    return fs.pathExists(file) ? fs.readJson(file) : null;
}

async function loadLimits(guildId) {
    const file = path.join(getDataPath(guildId), 'limits.json');
    return fs.pathExists(file) ? fs.readJson(file) : {};
}

async function loadWhitelist(guildId) {
    const file = path.join(getDataPath(guildId), 'whitelist.json');
    return fs.pathExists(file) ? fs.readJson(file) : { users: [], roles: [] };
}

async function loadExtraOwners(guildId) {
    const file = path.join(getDataPath(guildId), 'extraowners.json');
    return fs.pathExists(file) ? fs.readJson(file) : [];
}

async function loadQuarantine(guildId) {
    const file = path.join(getDataPath(guildId), 'quarantine.json');
    return fs.pathExists(file) ? fs.readJson(file) : {};
}

// Check if user is protected (owner, extra owner, whitelisted)
async function isProtected(guild, userId) {
    // Server owner
    if (userId === guild.ownerId) return { protected: true, reason: 'Server Owner' };
    
    // Bot itself
    if (userId === guild.client.user.id) return { protected: true, reason: 'Bot' };
    
    // Extra owners
    const extraOwners = await loadExtraOwners(guild.id);
    if (extraOwners.includes(userId)) return { protected: true, reason: 'Extra Owner' };
    
    // Whitelisted users
    const whitelist = await loadWhitelist(guild.id);
    if (whitelist.users.includes(userId)) return { protected: true, reason: 'Whitelisted User' };
    
    // Whitelisted roles
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.some(r => whitelist.roles.includes(r.id))) {
        return { protected: true, reason: 'Whitelisted Role' };
    }
    
    return { protected: false };
}

// Check rate limit
async function checkLimit(guildId, userId, actionType, limit) {
    const key = `${guildId}-${userId}-${actionType}`;
    const now = Date.now();
    
    if (!RECENT_ACTIONS.has(key)) RECENT_ACTIONS.set(key, []);
    const actions = RECENT_ACTIONS.get(key).filter(t => now - t < limit.time);
    actions.push(now);
    RECENT_ACTIONS.set(key, actions);
    
    return { count: actions.length, exceeded: actions.length >= limit.count };
}

// Execute punishment
async function executePunishment(guild, user, punishmentType, reason, settings, client) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return false;
    
    const dataPath = getDataPath(guild.id);
    const quarantineData = await loadQuarantine(guild.id);
    
    try {
        switch(punishmentType) {
            case 'quarantine': {
                // Backup roles
                const roles = member.roles.cache
                    .filter(r => r.id !== guild.id && r.id !== settings.quarantineRole)
                    .map(r => r.id);
                
                quarantineData[user.id] = {
                    roles,
                    reason,
                    time: Date.now(),
                    type: 'quarantine'
                };
                await fs.writeJson(path.join(dataPath, 'quarantine.json'), quarantineData, { spaces: 2 });
                
                // Remove all and add quarantine
                for (const roleId of roles) {
                    await member.roles.remove(roleId).catch(() => {});
                }
                await member.roles.add(settings.quarantineRole).catch(() => {});
                
                await sendMessage.punishLog(guild, settings, 'quarantine', user, reason, client.config, { rolesSaved: roles.length });
                return true;
            }
            
            case 'ban':
                await member.ban({ reason: `AntiNuke: ${reason}`, deleteMessageDays: 1 });
                await sendMessage.punishLog(guild, settings, 'ban', user, reason, client.config);
                return true;
                
            case 'kick':
                await member.kick(`AntiNuke: ${reason}`);
                await sendMessage.punishLog(guild, settings, 'kick', user, reason, client.config);
                return true;
                
            case 'timeout':
                await member.timeout(3600000, `AntiNuke: ${reason}`); // 1 hour
                await sendMessage.punishLog(guild, settings, 'timeout', user, `${reason} (1h)`, client.config);
                return true;
                
            case 'warn':
                await sendMessage.punishLog(guild, settings, 'warn', user, reason, client.config);
                return true;
                
            default:
                return false;
        }
    } catch (err) {
        console.error(`[Punishment] ${punishmentType} failed:`, err.message);
        await sendMessage.sendLog(guild, settings, 'error', { error: err.message, action: punishmentType, color: 'error' }, client.config);
        return false;
    }
}

// Process action
async function processAction(guild, executor, actionType, data, client) {
    // Skip bot
    if (executor.id === client.user.id) return;
    
    const settings = await loadSettings(guild.id);
    if (!settings?.enabled) return;
    
    // Check feature enabled
    if (settings.features?.[actionType] === false) return;
    
    // Check protected
    const protection = await isProtected(guild, executor.id);
    if (protection.protected) {
        await sendMessage.sendLog(guild, settings, 'whitelisted', { 
            user: executor, 
            action: actionType,
            color: 'info'
        }, client.config);
        return;
    }
    
    // Get limits
    const limits = await loadLimits(guild.id);
    const limit = limits[actionType];
    if (!limit) return;
    
    // Check limit
    const check = await checkLimit(guild.id, executor.id, actionType, limit);
    
    // Log detection at half limit
    if (check.count >= Math.ceil(limit.count / 2) && !check.exceeded) {
        await sendMessage.sendLog(guild, settings, 'detected', {
            user: executor,
            action: actionType,
            target: data.target,
            count: check.count,
            limit: limit.count,
            color: 'warn'
        }, client.config);
    }
    
    // Punish if exceeded
    if (!check.exceeded) return;
    
    console.log(`[AntiNuke] PUNISHING: ${executor.tag} for ${actionType}`);
    
    // Revert first
    if (data.revert) {
        try {
            await data.revert();
            await sendMessage.sendLog(guild, settings, 'reverted', { user: executor, action: actionType, color: 'success' }, client.config);
        } catch (err) {
            console.error('[Revert failed]:', err.message);
        }
    }
    
    // Execute punishment
    await executePunishment(guild, executor, limit.action, `${actionType} spam detected`, settings, client);
}

// Audit fetch with retry
async function fetchAudit(guild, type, targetId, retries = 3) {
    for (let i = 0; i < retries; i++) {
        const audit = await guild.fetchAuditLogs({ limit: 10, type }).catch(() => null);
        if (audit) {
            const entry = audit.entries.find(e => {
                if (targetId && e.target?.id !== targetId) return false;
                return (Date.now() - e.createdTimestamp) < 10000;
            });
            if (entry) return entry;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return null;
}

// Check duplicate
function isDuplicate(guildId, auditId) {
    const key = `${guildId}-${auditId}`;
    if (AUDIT_CACHE.has(key)) return true;
    AUDIT_CACHE.add(key);
    setTimeout(() => AUDIT_CACHE.delete(key), 10000);
    return false;
}

// ==========================================
// EVENT HANDLERS
// ==========================================

module.exports = {
    // Initialize all events
    init(client) {
        // Channel events
        client.on('channelCreate', (ch) => this.handleChannelCreate(ch, client));
        client.on('channelDelete', (ch) => this.handleChannelDelete(ch, client));
        client.on('channelUpdate', (oldCh, newCh) => this.handleChannelUpdate(oldCh, newCh, client));
        
        // Role events
        client.on('roleCreate', (role) => this.handleRoleCreate(role, client));
        client.on('roleDelete', (role) => this.handleRoleDelete(role, client));
        client.on('roleUpdate', (oldRole, newRole) => this.handleRoleUpdate(oldRole, newRole, client));
        
        // Member events
        client.on('guildBanAdd', (ban) => this.handleBanAdd(ban, client));
        client.on('guildMemberRemove', (member) => this.handleMemberRemove(member, client));
        client.on('guildMemberAdd', (member) => this.handleMemberAdd(member, client));
        client.on('guildMemberUpdate', (oldM, newM) => this.handleMemberUpdate(oldM, newM, client));
        
        // Webhook
        client.on('webhookUpdate', (ch) => this.handleWebhook(ch, client));
        
        // Emoji/Sticker
        client.on('emojiCreate', (emoji) => this.handleEmojiCreate(emoji, client));
        client.on('emojiDelete', (emoji) => this.handleEmojiDelete(emoji, client));
        client.on('stickerCreate', (sticker) => this.handleStickerCreate(sticker, client));
        client.on('stickerDelete', (sticker) => this.handleStickerDelete(sticker, client));
        
        // Mention spam
        client.on('messageCreate', (msg) => this.handleMessage(msg, client));
        
        console.log('[AntiNuke] All event handlers registered');
    },

    // ========== CHANNEL HANDLERS ==========
    async handleChannelCreate(channel, client) {
        if (!channel.guild) return;
        const entry = await fetchAudit(channel.guild, 10, channel.id);
        if (!entry || isDuplicate(channel.guild.id, entry.id)) return;
        
        await processAction(channel.guild, entry.executor, 'channelCreate', {
            target: channel.name,
            revert: async () => await channel.delete('AntiNuke revert').catch(() => {})
        }, client);
    },

    async handleChannelDelete(channel, client) {
        if (!channel.guild) return;
        const entry = await fetchAudit(channel.guild, 12, channel.id);
        if (!entry || isDuplicate(channel.guild.id, entry.id)) return;
        
        await processAction(channel.guild, entry.executor, 'channelDelete', {
            target: channel.name
        }, client);
    },

    async handleChannelUpdate(oldCh, newCh, client) {
        if (!oldCh.guild) return;
        
        // Check permission changes
        const permChanged = oldCh.permissionOverwrites.cache.size !== newCh.permissionOverwrites.cache.size ||
            [...oldCh.permissionOverwrites.cache].some(([id, po]) => {
                const newPo = newCh.permissionOverwrites.cache.get(id);
                return !newPo || po.allow.bitfield !== newPo.allow.bitfield || po.deny.bitfield !== newPo.deny.bitfield;
            });
        
        if (!permChanged) return;
        
        const entry = await fetchAudit(newCh.guild, 11, newCh.id);
        if (!entry || isDuplicate(newCh.guild.id, entry.id)) return;
        
        await processAction(newCh.guild, entry.executor, 'channelPermUpdate', {
            target: newCh.name
        }, client);
    },

    // ========== ROLE HANDLERS ==========
    async handleRoleCreate(role, client) {
        const entry = await fetchAudit(role.guild, 30, role.id);
        if (!entry || isDuplicate(role.guild.id, entry.id)) return;
        
        await processAction(role.guild, entry.executor, 'roleCreate', {
            target: role.name,
            revert: async () => await role.delete('AntiNuke revert').catch(() => {})
        }, client);
    },

    async handleRoleDelete(role, client) {
        const entry = await fetchAudit(role.guild, 32, role.id);
        if (!entry || isDuplicate(role.guild.id, entry.id)) return;
        
        await processAction(role.guild, entry.executor, 'roleDelete', {
            target: role.name
        }, client);
    },

    async handleRoleUpdate(oldRole, newRole, client) {
        const permChanged = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
        if (!permChanged) return;
        
        const entry = await fetchAudit(newRole.guild, 31, newRole.id);
        if (!entry || isDuplicate(newRole.guild.id, entry.id)) return;
        
        await processAction(newRole.guild, entry.executor, 'rolePermUpdate', {
            target: newRole.name
        }, client);
    },

    // ========== MEMBER HANDLERS ==========
    async handleBanAdd(ban, client) {
        const entry = await fetchAudit(ban.guild, 22, ban.user.id);
        if (!entry || isDuplicate(ban.guild.id, entry.id)) return;
        
        await processAction(ban.guild, entry.executor, 'banAdd', {
            target: ban.user.tag,
            revert: async () => await ban.guild.members.unban(ban.user.id, 'AntiNuke revert').catch(() => {})
        }, client);
    },

    async handleMemberRemove(member, client) {
        const audit = await member.guild.fetchAuditLogs({ limit: 5, type: 20 }).catch(() => null);
        if (!audit) return;
        
        const entry = audit.entries.find(e => e.target?.id === member.id && (Date.now() - e.createdTimestamp) < 10000);
        if (!entry || isDuplicate(member.guild.id, entry.id)) return;
        
        await processAction(member.guild, entry.executor, 'kickAdd', {
            target: member.user.tag
        }, client);
    },

    async handleMemberAdd(member, client) {
        if (!member.user.bot) return;
        
        const entry = await fetchAudit(member.guild, 28, member.id);
        if (!entry || isDuplicate(member.guild.id, entry.id)) return;
        
        await processAction(member.guild, entry.executor, 'botAdd', {
            target: member.user.tag,
            revert: async () => await member.kick('AntiNuke: Unauthorized bot').catch(() => {})
        }, client);
    },

    async handleMemberUpdate(oldM, newM, client) {
        if (oldM.roles.cache.size >= newM.roles.cache.size) return;
        
        const entry = await fetchAudit(newM.guild, 25, newM.id);
        if (!entry || isDuplicate(newM.guild.id, entry.id)) return;
        
        const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
        
        await processAction(newM.guild, entry.executor, 'memberRoleUpdate', {
            target: newM.user.tag,
            revert: async () => {
                for (const [, role] of added) {
                    await newM.roles.remove(role).catch(() => {});
                }
            }
        }, client);
    },

    // ========== WEBHOOK ==========
    async handleWebhook(channel, client) {
        const entry = await fetchAudit(channel.guild, 50);
        if (!entry || isDuplicate(channel.guild.id, entry.id)) return;
        
        await processAction(channel.guild, entry.executor, 'webhookCreate', {
            target: channel.name,
            revert: async () => {
                const hooks = await channel.fetchWebhooks().catch(() => []);
                const hook = hooks.find(h => h.id === entry.target?.id);
                if (hook) await hook.delete('AntiNuke').catch(() => {});
            }
        }, client);
    },

    // ========== EMOJI ==========
    async handleEmojiCreate(emoji, client) {
        const entry = await fetchAudit(emoji.guild, 60, emoji.id);
        if (!entry || isDuplicate(emoji.guild.id, entry.id)) return;
        
        await processAction(emoji.guild, entry.executor, 'emojiCreate', {
            target: emoji.name,
            revert: async () => await emoji.delete('AntiNuke revert').catch(() => {})
        }, client);
    },

    async handleEmojiDelete(emoji, client) {
        const entry = await fetchAudit(emoji.guild, 62, emoji.id);
        if (!entry || isDuplicate(emoji.guild.id, entry.id)) return;
        
        await processAction(emoji.guild, entry.executor, 'emojiDelete', {
            target: emoji.name
        }, client);
    },

    // ========== STICKER ==========
    async handleStickerCreate(sticker, client) {
        const entry = await fetchAudit(sticker.guild, 90, sticker.id);
        if (!entry || isDuplicate(sticker.guild.id, entry.id)) return;
        
        await processAction(sticker.guild, entry.executor, 'stickerCreate', {
            target: sticker.name,
            revert: async () => await sticker.delete('AntiNuke revert').catch(() => {})
        }, client);
    },

    async handleStickerDelete(sticker, client) {
        const entry = await fetchAudit(sticker.guild, 92, sticker.id);
        if (!entry || isDuplicate(sticker.guild.id, entry.id)) return;
        
        await processAction(sticker.guild, entry.executor, 'stickerDelete', {
            target: sticker.name
        }, client);
    },

    // ========== MENTION SPAM ==========
    async handleMessage(message, client) {
        if (!message.guild || message.author.bot) return;
        
        const hasMassMention = message.content.includes('@everyone') || 
                              message.content.includes('@here') ||
                              message.mentions.roles.size > 5;
        
        if (!hasMassMention) return;
        
        const canMention = message.member.permissions.has('MentionEveryone');
        if (!canMention) return;
        
        await processAction(message.guild, message.author, 'mentionSpam', {
            target: message.content.includes('@everyone') ? '@everyone' : message.mentions.roles.size > 5 ? 'mass roles' : '@here',
            revert: async () => await message.delete().catch(() => {})
        }, client);
    }
};

