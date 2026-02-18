const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

// Config import for colors
const getColor = (config, type) => parseInt(config.colors[type]?.replace('#', '') || 'FF0000', 16);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('AntiNuke protection system')
        .addSubcommand(sub => sub.setName('setup').setDescription('Initialize AntiNuke'))
        .addSubcommand(sub => sub
            .setName('toggle')
            .setDescription('Toggle features')
            .addStringOption(opt => opt.setName('feature').setRequired(true)
                .addChoices(
                    { name: 'All', value: 'enabled' },
                    { name: 'Channel Create', value: 'channelCreate' },
                    { name: 'Channel Delete', value: 'channelDelete' },
                    { name: 'Channel Perm', value: 'channelPermUpdate' },
                    { name: 'Role Create', value: 'roleCreate' },
                    { name: 'Role Delete', value: 'roleDelete' },
                    { name: 'Role Perm', value: 'rolePermUpdate' },
                    { name: 'Ban', value: 'banAdd' },
                    { name: 'Kick', value: 'kickAdd' },
                    { name: 'Bot Add', value: 'botAdd' },
                    { name: 'Webhook', value: 'webhookCreate' },
                    { name: 'Role Spam', value: 'memberRoleUpdate' },
                    { name: 'Emoji', value: 'emojiCreate' },
                    { name: 'Sticker', value: 'stickerCreate' },
                    { name: 'Mention', value: 'mentionSpam' }
                ))
            .addBooleanOption(opt => opt.setName('state').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('limit')
            .setDescription('Set limits')
            .addStringOption(opt => opt.setName('action').setRequired(true)
                .addChoices(
                    { name: 'Channel Create', value: 'channelCreate' },
                    { name: 'Channel Delete', value: 'channelDelete' },
                    { name: 'Role Create', value: 'roleCreate' },
                    { name: 'Role Delete', value: 'roleDelete' },
                    { name: 'Ban', value: 'banAdd' },
                    { name: 'Kick', value: 'kickAdd' },
                    { name: 'Bot Add', value: 'botAdd' },
                    { name: 'Webhook', value: 'webhookCreate' }
                ))
            .addIntegerOption(opt => opt.setName('count').setRequired(true).setMinValue(1).setMaxValue(50))
            .addIntegerOption(opt => opt.setName('seconds').setRequired(true).setMinValue(1).setMaxValue(3600))
            .addStringOption(opt => opt.setName('punishment').setRequired(true)
                .addChoices(
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Warn', value: 'warn' }
                )))
        .addSubcommand(sub => sub
            .setName('whitelist')
            .setDescription('Manage whitelist')
            .addStringOption(opt => opt.setName('type').setRequired(true)
                .addChoices({ name: 'User', value: 'users' }, { name: 'Role', value: 'roles' }))
            .addStringOption(opt => opt.setName('action').setRequired(true)
                .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }, { name: 'List', value: 'list' }))
            .addMentionableOption(opt => opt.setName('target')))
        .addSubcommand(sub => sub
            .setName('extraowner')
            .setDescription('Manage extra owners')
            .addStringOption(opt => opt.setName('action').setRequired(true)
                .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }, { name: 'List', value: 'list' }))
            .addUserOption(opt => opt.setName('user')))
        .addSubcommand(sub => sub.setName('settings').setDescription('View settings'))
        .addSubcommand(sub => sub
            .setName('quarantine')
            .setDescription('Manual quarantine')
            .addUserOption(opt => opt.setName('user').setRequired(true))
            .addStringOption(opt => opt.setName('reason')))
        .addSubcommand(sub => sub
            .setName('unquarantine')
            .setDescription('Restore user')
            .addUserOption(opt => opt.setName('user').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    name: 'antinuke',
    description: 'AntiNuke protection system',
    aliases: ['an', 'nukeshield'],
    cooldown: 3,

    async execute(interaction, client, config) {
        const sub = interaction.options.getSubcommand();
        
        switch(sub) {
            case 'setup': return this.setup(interaction, client, config);
            case 'toggle': return this.toggle(interaction, client, config);
            case 'limit': return this.limit(interaction, client, config);
            case 'whitelist': return this.whitelist(interaction, client, config);
            case 'extraowner': return this.extraowner(interaction, client, config);
            case 'settings': return this.settings(interaction, client, config);
            case 'quarantine': return this.quarantine(interaction, client, config);
            case 'unquarantine': return this.unquarantine(interaction, client, config);
        }
    },

    async setup(interaction, client, config) {
        await interaction.deferReply();
        
        const guild = interaction.guild;
        const serverId = guild.id;
        const dataPath = path.join(__dirname, '..', 'data', 'antinuke', serverId);
        
        if (await fs.pathExists(path.join(dataPath, 'settings.json'))) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'warn')).setTitle('⚠️ Already Setup').setDescription('Use `/antinuke toggle` to manage')] });
        }

        try {
            // Create channel with bot name
            const botName = client.user.username.toLowerCase().replace(/\s+/g, '-');
            const quarantineChannel = await guild.channels.create({
                name: `${botName}-antinuke-logs`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            // Create quarantine role
            const quarantineRole = await guild.roles.create({
                name: 'Quarantine',
                color: 0x8B0000,
                permissions: [],
                reason: 'AntiNuke Protection'
            });

            // Apply to all channels
            const channels = await guild.channels.fetch();
            for (const [, channel] of channels) {
                if (channel.isThread()) continue;
                try {
                    await channel.permissionOverwrites.create(quarantineRole, {
                        ViewChannel: false,
                        SendMessages: false,
                        AddReactions: false,
                        Connect: false,
                        Speak: false
                    });
                } catch {}
            }

            // Initialize data
            await fs.ensureDir(dataPath);
            
            const defaultLimits = {
                channelCreate: { count: 3, time: 10000, action: 'quarantine' },
                channelDelete: { count: 3, time: 10000, action: 'quarantine' },
                channelPermUpdate: { count: 5, time: 10000, action: 'warn' },
                roleCreate: { count: 3, time: 10000, action: 'quarantine' },
                roleDelete: { count: 3, time: 10000, action: 'quarantine' },
                rolePermUpdate: { count: 5, time: 10000, action: 'warn' },
                banAdd: { count: 5, time: 60000, action: 'quarantine' },
                kickAdd: { count: 5, time: 60000, action: 'quarantine' },
                botAdd: { count: 1, time: 60000, action: 'quarantine' },
                webhookCreate: { count: 3, time: 60000, action: 'quarantine' },
                memberRoleUpdate: { count: 5, time: 10000, action: 'quarantine' },
                emojiCreate: { count: 5, time: 60000, action: 'quarantine' },
                emojiDelete: { count: 5, time: 60000, action: 'quarantine' },
                stickerCreate: { count: 5, time: 60000, action: 'quarantine' },
                stickerDelete: { count: 5, time: 60000, action: 'quarantine' },
                mentionSpam: { count: 3, time: 60000, action: 'quarantine' }
            };

            await fs.writeJson(path.join(dataPath, 'settings.json'), {
                enabled: true,
                quarantineChannel: quarantineChannel.id,
                quarantineRole: quarantineRole.id,
                ownerId: guild.ownerId,
                features: {},
                createdAt: Date.now()
            }, { spaces: 2 });

            await fs.writeJson(path.join(dataPath, 'limits.json'), defaultLimits, { spaces: 2 });
            await fs.writeJson(path.join(dataPath, 'whitelist.json'), { users: [], roles: [] }, { spaces: 2 });
            await fs.writeJson(path.join(dataPath, 'extraowners.json'), [], { spaces: 2 });
            await fs.writeJson(path.join(dataPath, 'quarantine.json'), {}, { spaces: 2 });

            const embed = new EmbedBuilder()
                .setColor(getColor(config, 'success'))
                .setTitle('🛡️ AntiNuke Initialized')
                .setDescription(`**Log Channel:** <#${quarantineChannel.id}>\n**Quarantine Role:** <@&${quarantineRole.id}>`)
                .addFields({ name: 'Protection Active', value: 'All features enabled by default', inline: false });

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setTitle('❌ Error').setDescription(err.message)] });
        }
    },

    async checkPerms(interaction, config, requireOwner = false) {
        const guild = interaction.guild;
        const serverId = guild.id;
        const dataPath = path.join(__dirname, '..', 'data', 'antinuke', serverId);
        const settingsPath = path.join(dataPath, 'settings.json');
        
        if (!await fs.pathExists(settingsPath)) {
            return { allowed: false, error: 'Run `/antinuke setup` first!' };
        }
        
        const settings = await fs.readJson(settingsPath);
        const extraOwners = await fs.readJson(path.join(dataPath, 'extraowners.json')).catch(() => []);
        
        const isOwner = interaction.user.id === settings.ownerId;
        const isExtraOwner = extraOwners.includes(interaction.user.id);
        
        if (requireOwner && !isOwner) return { allowed: false, error: 'Only server owner!' };
        if (!isOwner && !isExtraOwner) return { allowed: false, error: 'Only owner or extra owners!' };
        
        return { allowed: true, settings, dataPath, isOwner };
    },

    async toggle(interaction, client, config) {
        const check = await this.checkPerms(interaction, config);
        if (!check.allowed) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription(check.error)], ephemeral: true });

        const feature = interaction.options.getString('feature');
        const state = interaction.options.getBoolean('state');

        if (feature === 'enabled') {
            check.settings.enabled = state;
        } else {
            if (!check.settings.features) check.settings.features = {};
            check.settings.features[feature] = state;
        }

        await fs.writeJson(path.join(check.dataPath, 'settings.json'), check.settings, { spaces: 2 });

        const embed = new EmbedBuilder()
            .setColor(getColor(config, state ? 'success' : 'error'))
            .setTitle(`⚙️ ${feature}`)
            .setDescription(`Now **${state ? 'ENABLED' : 'DISABLED'}**`);

        await interaction.reply({ embeds: [embed] });
    },

    async limit(interaction, client, config) {
        const check = await this.checkPerms(interaction, config);
        if (!check.allowed) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription(check.error)], ephemeral: true });

        const action = interaction.options.getString('action');
        const count = interaction.options.getInteger('count');
        const seconds = interaction.options.getInteger('seconds');
        const punishment = interaction.options.getString('punishment');

        const limits = await fs.readJson(path.join(check.dataPath, 'limits.json'));
        limits[action] = { count, time: seconds * 1000, action: punishment };

        await fs.writeJson(path.join(check.dataPath, 'limits.json'), limits, { spaces: 2 });

        const embed = new EmbedBuilder()
            .setColor(getColor(config, 'success'))
            .setTitle('⚙️ Limit Updated')
            .setDescription(`**${action}:** ${count} per ${seconds}s\n**Punishment:** ${punishment}`);

        await interaction.reply({ embeds: [embed] });
    },

    async whitelist(interaction, client, config) {
        const check = await this.checkPerms(interaction, config);
        if (!check.allowed) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription(check.error)], ephemeral: true });

        const type = interaction.options.getString('type');
        const action = interaction.options.getString('action');
        const whitelist = await fs.readJson(path.join(check.dataPath, 'whitelist.json'));

        if (action === 'list') {
            const items = whitelist[type].map(id => type === 'users' ? `<@${id}>` : `<@&${id}>`).join('\n') || 'None';
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'info')).setTitle(`📋 Whitelisted ${type}`).setDescription(items)] });
        }

        const target = interaction.options.getMentionable('target');
        if (!target) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'warn')).setDescription('Provide a target')], ephemeral: true });

        if (action === 'add') {
            if (!whitelist[type].includes(target.id)) whitelist[type].push(target.id);
        } else {
            whitelist[type] = whitelist[type].filter(i => i !== target.id);
        }

        await fs.writeJson(path.join(check.dataPath, 'whitelist.json'), whitelist, { spaces: 2 });

        const embed = new EmbedBuilder()
            .setColor(getColor(config, 'success'))
            .setDescription(`${action === 'add' ? 'Added' : 'Removed'} ${target} from ${type}`);

        await interaction.reply({ embeds: [embed] });
    },

    async extraowner(interaction, client, config) {
        const check = await this.checkPerms(interaction, config, true);
        if (!check.allowed) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription(check.error)], ephemeral: true });

        const action = interaction.options.getString('action');
        const extraOwners = await fs.readJson(path.join(check.dataPath, 'extraowners.json'));

        if (action === 'list') {
            const list = extraOwners.length ? extraOwners.map(id => `<@${id}>`).join('\n') : 'None';
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'info')).setTitle('👑 Extra Owners').setDescription(list)] });
        }

        const user = interaction.options.getUser('user');
        if (!user) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'warn')).setDescription('Provide a user')], ephemeral: true });

        if (action === 'add') {
            if (!extraOwners.includes(user.id)) extraOwners.push(user.id);
        } else {
            const idx = extraOwners.indexOf(user.id);
            if (idx > -1) extraOwners.splice(idx, 1);
        }

        await fs.writeJson(path.join(check.dataPath, 'extraowners.json'), extraOwners, { spaces: 2 });

        const embed = new EmbedBuilder()
            .setColor(getColor(config, 'success'))
            .setDescription(`${action === 'add' ? 'Added' : 'Removed'} ${user.tag}`);

        await interaction.reply({ embeds: [embed] });
    },

    async settings(interaction, client, config) {
        const check = await this.checkPerms(interaction, config);
        if (!check.allowed) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription(check.error)], ephemeral: true });

        const limits = await fs.readJson(path.join(check.dataPath, 'limits.json'));
        const whitelist = await fs.readJson(path.join(check.dataPath, 'whitelist.json'));
        const extraOwners = await fs.readJson(path.join(check.dataPath, 'extraowners.json'));

        const embed = new EmbedBuilder()
            .setColor(getColor(config, 'info'))
            .setTitle('🛡️ AntiNuke Settings')
            .setDescription(`**Status:** ${check.settings.enabled ? '✅ Enabled' : '❌ Disabled'}`)
            .addFields(
                { name: 'Features', value: Object.entries(check.settings.features || {}).map(([k, v]) => `${v ? '✅' : '❌'} ${k}`).join('\n') || 'All default', inline: false },
                { name: 'Limits', value: Object.entries(limits).map(([k, v]) => `${k}: ${v.count}/${v.time/1000}s → ${v.action}`).join('\n').slice(0, 1000), inline: false },
                { name: 'Whitelist', value: `Users: ${whitelist.users.length}, Roles: ${whitelist.roles.length}`, inline: true },
                { name: 'Extra Owners', value: `${extraOwners.length}`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },

    async quarantine(interaction, client, config) {
        const check = await this.checkPerms(interaction, config);
        if (!check.allowed) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription(check.error)], ephemeral: true });

        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'Manual quarantine';

        if (!target) return interaction.reply({ embeds: [new EmbedBuilder().setColor(getColor(config, 'error')).setDescription('User not found')], ephemeral: true });

        // Backup roles
        const roles = target.roles.cache.filter(r => r.id !== interaction.guild.id && r.id !== check.settings.quarantineRole).map(r => r.id);
        const quarantineData = await fs.readJson(path.join(check.dataPath, 'quarantine.json')).catch(() => ({}));

        quarantineData[target.id] = { roles, reason, time: Date.now(), manual: true };
        await fs.writeJson(path.join(check.dataPath, 'quarantine.json'), quarantineData, { spaces: 2 });

        // Remove roles and add quarantine
        for (const roleId of roles) await target.roles.remove(roleId).catch(() => {});
        await target.roles.add(check.settings.quarantineRole).catch(() => {});

        const embed = new EmbedBuilder()
            .setColor(getColor(config, 'error'))
            .setTitle('🚨 Quarantined')
            .setDescription(`**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Roles:** ${roles.length} saved`);

        await interaction.reply({ embeds: [embed] });
    },

    async unquarantine(interaction, client, config) {
        const check = await this.checkPerms(interaction, config);
        if (!check.allowed) return interaction.repl
