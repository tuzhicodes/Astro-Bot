// ==========================================
// ADVANCED DISCORD BOT - MAIN INDEX.JS
// ==========================================

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    REST,
    Routes,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const fs   = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// ── Client ─────────────────────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildMember],
    failIfNotExists: false,
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
});

client.commands      = new Collection();
client.prefixCommands = new Collection();
client.aliases       = new Collection();
client.cooldowns     = new Collection();

client.config = {
    globalPrefix: process.env.DEFAULT_PREFIX || '!',
    colors: {
        success:  process.env.COLOR_SUCCESS  || '#00FF00',
        warn:     process.env.COLOR_WARN     || '#FFD700',
        error:    process.env.COLOR_ERROR    || '#FF0000',
        cooldown: process.env.COLOR_COOLDOWN || '#808080',
        info:     process.env.COLOR_INFO     || '#0099FF',
    },
    developers: process.env.DEVELOPER_IDS?.split(',').map(s => s.trim()).filter(Boolean) || [],
    testGuild:  process.env.TEST_GUILD_ID?.trim() || null,
    production: process.env.NODE_ENV === 'production',
};

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// ── Logger ─────────────────────────────────────────────────────────────────

const C = {
    reset:   '\x1b[0m',
    red:     '\x1b[31m',
    green:   '\x1b[32m',
    yellow:  '\x1b[33m',
    blue:    '\x1b[34m',
    cyan:    '\x1b[36m',
};

const logger = {
    ts:      () => new Date().toLocaleTimeString('en-US', { hour12: false }),
    log:     (msg, c = 'reset') => console.log(`${C.cyan}[${logger.ts()}]${C.reset} ${C[c]}${msg}${C.reset}`),
    info:    (msg) => logger.log(`ℹ️  ${msg}`, 'blue'),
    success: (msg) => logger.log(`✅ ${msg}`, 'green'),
    warn:    (msg) => logger.log(`⚠️  ${msg}`, 'yellow'),
    error:   (msg) => logger.log(`❌ ${msg}`, 'red'),
    cmd:     (name, type) => {
        const icons = { slash: '🔷', prefix: '🔶', hybrid: '💎' };
        logger.log(`${icons[type] || '•'} ${type.toUpperCase().padEnd(6)} | ${name}`, 'green');
    },
    evt:     (name, file) => logger.log(`📡 ${name.padEnd(20)} | ${file}`, 'cyan'),
    divider: () => console.log(`${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`),
};

// ── Hasher ─────────────────────────────────────────────────────────────────

const hasher = {
    hashFile: './data/.command_hashes.json',
    async load() {
        try {
            if (await fs.pathExists(this.hashFile)) return await fs.readJson(this.hashFile);
        } catch { /* ignore */ }
        return {};
    },
    async save(hashes) {
        try {
            await fs.ensureDir('./data');
            await fs.writeJson(this.hashFile, hashes, { spaces: 2 });
        } catch (err) {
            logger.error(`Hash save failed: ${err.message}`);
        }
    },
    generate: (content) => crypto.createHash('md5').update(content).digest('hex'),
};

// ── Rate limiter ───────────────────────────────────────────────────────────

const rateLimiter = {
    users: new Map(),
    check(userId, command, cooldown = 3) {
        if (!this.users.has(userId)) this.users.set(userId, new Map());
        const cmds = this.users.get(userId);
        if (cmds.has(command)) {
            const exp = cmds.get(command);
            if (Date.now() < exp) return { allowed: false, remaining: Math.ceil((exp - Date.now()) / 1000) };
        }
        cmds.set(command, Date.now() + cooldown * 1000);
        setTimeout(() => cmds.delete(command), cooldown * 1000);
        return { allowed: true };
    },
};

// ── File scanner ───────────────────────────────────────────────────────────

async function scanDirectory(dir, ext = '.js') {
    const files = [];
    async function scan(cur) {
        if (!await fs.pathExists(cur)) return;
        for (const item of await fs.readdir(cur)) {
            const full = path.join(cur, item);
            (await fs.stat(full)).isDirectory() ? await scan(full) : item.endsWith(ext) && files.push(full);
        }
    }
    await scan(dir);
    return files;
}

// ── Load commands ──────────────────────────────────────────────────────────

async function loadCommands() {
    logger.info('Loading commands...');
    logger.divider();

    const dir = path.join(__dirname, 'commands');
    if (!await fs.pathExists(dir)) { logger.warn('Commands directory not found!'); return; }

    const files        = await scanDirectory(dir);
    const slashCmds    = [];
    const cmdHashes    = new Map();
    let hybrid = 0, slash = 0, prefix = 0;

    for (const filePath of files) {
        try {
            delete require.cache[require.resolve(filePath)];
            const cmd = require(filePath);

            if (!cmd.execute || typeof cmd.execute !== 'function') continue;

            const isHybrid = cmd.data?.name && cmd.name;
            const isSlash  = !isHybrid && cmd.data?.name;
            const isPrefix = !isHybrid && !isSlash && cmd.name;

            if (isHybrid) {
                client.commands.set(cmd.data.name, cmd);
                slashCmds.push(cmd.data.toJSON());
                cmdHashes.set(cmd.data.name, hasher.generate(JSON.stringify(cmd.data.toJSON())));

                client.prefixCommands.set(cmd.name.toLowerCase(), cmd);
                cmd.aliases?.forEach(a => {
                    client.aliases.set(a.toLowerCase(), cmd.name.toLowerCase());
                    client.prefixCommands.set(a.toLowerCase(), cmd);
                });
                logger.cmd(cmd.name, 'hybrid');
                hybrid++;

            } else if (isSlash) {
                client.commands.set(cmd.data.name, cmd);
                slashCmds.push(cmd.data.toJSON());
                cmdHashes.set(cmd.data.name, hasher.generate(JSON.stringify(cmd.data.toJSON())));
                logger.cmd(cmd.data.name, 'slash');
                slash++;

            } else if (isPrefix) {
                client.prefixCommands.set(cmd.name.toLowerCase(), cmd);
                cmd.aliases?.forEach(a => {
                    client.aliases.set(a.toLowerCase(), cmd.name.toLowerCase());
                    client.prefixCommands.set(a.toLowerCase(), cmd);
                });
                logger.cmd(cmd.name, 'prefix');
                prefix++;
            }
        } catch (err) {
            logger.error(`Failed to load ${path.basename(filePath)}: ${err.message}`);
        }
    }

    logger.divider();

    // Register slash commands
    if (slashCmds.length > 0) {
        try {
            const oldHashes = await hasher.load();
            const hasChanges = [...cmdHashes].some(([name, hash]) => oldHashes[name] !== hash);

            if (hasChanges || !client.config.production) {
                logger.info('Registering slash commands...');

                const clientId = process.env.CLIENT_ID;
                const testGuild = client.config.testGuild;
                const validSnowflake = testGuild && /^\d{17,20}$/.test(testGuild);

                const route = validSnowflake && !client.config.production
                    ? Routes.applicationGuildCommands(clientId, testGuild)
                    : Routes.applicationCommands(clientId);

                await rest.put(route, { body: slashCmds });

                const hashObj = {};
                cmdHashes.forEach((v, k) => hashObj[k] = v);
                await hasher.save(hashObj);

                logger.success(`Registered ${slashCmds.length} slash command(s) ${validSnowflake && !client.config.production ? `to guild ${testGuild}` : 'globally'}`);
            } else {
                logger.info('No changes — skipping registration');
            }
        } catch (err) {
            logger.error(`Registration failed: ${err.message}`);
        }
    }

    logger.success(`Loaded: ${hybrid} hybrid, ${slash} slash, ${prefix} prefix`);
}

// ── Load events ────────────────────────────────────────────────────────────

async function loadEvents() {
    logger.info('Loading events...');
    logger.divider();

    const dir = path.join(__dirname, 'events');
    if (!await fs.pathExists(dir)) { logger.warn('Events directory not found!'); return; }

    const files = await scanDirectory(dir);
    let count = 0;

    for (const filePath of files) {
        try {
            delete require.cache[require.resolve(filePath)];
            const exported = require(filePath);

            // Handle both single event and array of events
            const events = Array.isArray(exported) ? exported : [exported];

            for (const evt of events) {
                if (!evt?.name || !evt?.execute) continue;

                const eventName = evt.name === 'ready' ? 'clientReady' : evt.name;
                const handler = (...args) => evt.execute(...args, client).catch(err => logger.error(`Event ${evt.name}: ${err.message}`));

                evt.once ? client.once(eventName, handler) : client.on(eventName, handler);

                logger.evt(evt.name, path.relative(__dirname, filePath));
                count++;
            }
        } catch (err) {
            logger.error(`Failed to load event ${path.basename(filePath)}: ${err.message}`);
        }
    }

    logger.divider();
    logger.success(`Loaded ${count} events`);
}

// ── Prefix handler ─────────────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.webhookId || !message.guild) return;

    const prefix = client.config.globalPrefix;
    if (!message.content.startsWith(prefix)) return;

    const args    = message.content.slice(prefix.length).trim().split(/ +/);
    const cmdName = args.shift()?.toLowerCase();
    if (!cmdName) return;

    const actualName = client.aliases.get(cmdName) || cmdName;
    const command    = client.prefixCommands.get(actualName);
    if (!command) return;

    if (command.devOnly && !client.config.developers.includes(message.author.id)) {
        const reply = await message.reply({ embeds: [new EmbedBuilder().setColor(client.config.colors.error).setDescription('⛔ Developer only')] }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 10_000);
        return;
    }

    if (command.permissions?.length) {
        const missing = command.permissions.filter(p => !message.member.permissions.has(PermissionFlagsBits[p]));
        if (missing.length) {
            const reply = await message.reply({ embeds: [new EmbedBuilder().setColor(client.config.colors.error).setDescription(`❌ Missing: ${missing.join(', ')}`)] }).catch(() => null);
            if (reply) setTimeout(() => reply.delete().catch(() => {}), 10_000);
            return;
        }
    }

    const limit = rateLimiter.check(message.author.id, command.name, command.cooldown ?? 3);
    if (!limit.allowed) {
        const reply = await message.reply({ embeds: [new EmbedBuilder().setColor(client.config.colors.cooldown).setDescription(`⏳ Wait ${limit.remaining}s`)] }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 10_000);
        return;
    }

    try {
        await command.execute(message, args, client, client.config);
    } catch (err) {
        logger.error(`Prefix ${command.name}: ${err.message}`);
        const reply = await message.reply({ embeds: [new EmbedBuilder().setColor(client.config.colors.error).setDescription('❌ An error occurred')] }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 10_000);
    }
});

// ── Slash handler ────────────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (command.devOnly && !client.config.developers.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(client.config.colors.error).setDescription('⛔ Developer only')], ephemeral: true });
    }

    const limit = rateLimiter.check(interaction.user.id, command.data.name, command.cooldown ?? 3);
    if (!limit.allowed) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(client.config.colors.cooldown).setDescription(`⏳ Wait ${limit.remaining}s`)], ephemeral: true });
    }

    const handler = command.slashExecute ?? command.execute;

    try {
        await handler(interaction, client, client.config);
    } catch (err) {
        logger.error(`Slash ${command.data.name}: ${err.message}`);
        const embed = new EmbedBuilder().setColor(client.config.colors.error).setDescription('❌ An error occurred');
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

// ── Error handling ─────────────────────────────────────────────────────────

client.on('error', err => logger.error(`Client: ${err.message}`));
process.on('unhandledRejection', err => logger.error(`Unhandled: ${err?.message || err}`));
process.on('uncaughtException',  err => { logger.error(`Fatal: ${err.message}`); process.exit(1); });

// ── Start ──────────────────────────────────────────────────────────────────

(async function start() {
    try {
        logger.divider();
        logger.info('Starting Bot...');
        logger.divider();

        await loadEvents();
        await loadCommands();

        await client.login(process.env.TOKEN);
    } catch (err) {
        logger.error(`Startup failed: ${err.message}`);
        process.exit(1);
    }
})();
  
