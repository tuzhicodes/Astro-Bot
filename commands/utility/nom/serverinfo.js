// commands/utility/serverinfo.js
const {
  SlashCommandBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ChannelType,
} = require('discord.js');

// ── Emojis (change here to update everywhere) ─────────────────────────────
const EMOJIS = {
    header: '🏰',

  cat_general:  '📋',
  cat_members:  '👥',
  cat_channels: '💬',
  cat_boost:    '💎',
  cat_security: '🔒',
  cat_features: '✨',
  cat_banner:   '🎌'
 
};

const FEATURE_MAP = {
  COMMUNITY:               ' Community',
  VERIFIED:                ' Verified',
  PARTNERED:               ' Partnered',
  DISCOVERABLE:            ' Discoverable',
  ANIMATED_ICON:           ' Animated Icon',
  ANIMATED_BANNER:         ' Animated Banner',
  BANNER:                  ' Banner',
  VANITY_URL:              ' Vanity URL',
  INVITE_SPLASH:           ' Invite Splash',
  WELCOME_SCREEN_ENABLED:  ' Welcome Screen',
  MORE_EMOJI:              ' More Emoji',
  MORE_STICKERS:           ' More Stickers',
  ROLE_ICONS:              ' Role Icons',
  NEWS:                    ' News Channels',
  AUTO_MODERATION:         ' AutoMod',
  MONETIZATION_ENABLED:    ' Monetization',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getHex(config, key, fallback) {
  const raw = config?.colors?.[key] ?? process.env[`COLOR_${key.toUpperCase()}`] ?? fallback;
  return parseInt(raw.replace('#', ''), 16);
}

function buildStatusContainer(config, type, text) {
  const map = {
    warn:     { key: 'warn',     fallback: '#FFD700', emoji: EMOJIS.warn  },
    error:    { key: 'error',    fallback: '#FF0000', emoji: EMOJIS.error },
    cooldown: { key: 'cooldown', fallback: '#808080', emoji: '⏳'         },
  };
  const { key, fallback, emoji } = map[type] ?? map.warn;
  return new ContainerBuilder()
    .setAccentColor(getHex(config, key, fallback))
    .addTextDisplayComponents(t => t.setContent(`${emoji} ${text}`));
}

async function replyThenDelete(target, payload, delay = 10_000) {
  const isInteraction = typeof target.isChatInputCommand === 'function';
  if (isInteraction) {
    await target.reply(payload);
    setTimeout(() => target.deleteReply().catch(() => {}), delay);
  } else {
    const m = await target.reply(payload).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), delay);
  }
}

function ts(date) {
  if (!date) return 'N/A';
  const s = Math.floor(date.getTime() / 1000);
  return `<t:${s}:F> (<t:${s}:R>)`;
}

function verifyLabel(l) { return ['None','Low','Medium','High','Highest'][l] ?? 'Unknown'; }
function filterLabel(l) { return ['Off','No Role','All Members'][l] ?? 'Unknown'; }
function nsfwLabel(l)   { return ['Default','Explicit','Safe','Age Restricted'][l] ?? 'Unknown'; }
function boostTier(t)   { return ['None','Tier 1','Tier 2','Tier 3'][t] ?? 'Unknown'; }

// ── Build ─────────────────────────────────────────────────────────────────

function buildServerInfoContainer(config, guild) {
  const ch       = guild.channels.cache;
  const textCh   = ch.filter(c => c.type === ChannelType.GuildText).size;
  const voiceCh  = ch.filter(c => c.type === ChannelType.GuildVoice).size;
  const catCh    = ch.filter(c => c.type === ChannelType.GuildCategory).size;
  const forumCh  = ch.filter(c => c.type === ChannelType.GuildForum).size;
  const stageCh  = ch.filter(c => c.type === ChannelType.GuildStageVoice).size;
  const annCh    = ch.filter(c => c.type === ChannelType.GuildAnnouncement).size;
  const threadCh = ch.filter(c =>
    c.type === ChannelType.PublicThread ||
    c.type === ChannelType.PrivateThread ||
    c.type === ChannelType.AnnouncementThread
  ).size;

  const cached     = guild.members.cache;
  const botCount   = cached.filter(m => m.user.bot).size;
  const humanCount = cached.filter(m => !m.user.bot).size;
  const onlineCount = cached.filter(m =>
    m.presence?.status && m.presence.status !== 'offline'
  ).size;

  const emojiLimit = [50, 100, 150, 250][guild.premiumTier] ?? 50;
  const features   = guild.features.map(f => FEATURE_MAP[f]).filter(Boolean).join(', ') || null;
  const iconURL    = guild.iconURL({ size: 256, dynamic: true });
  const bannerURL  = guild.bannerURL({ size: 2048, dynamic: true });

  // ── THE ONE container ──────────────────────────────────────────────────
  const c = new ContainerBuilder()
    .setAccentColor(getHex(config, 'success', '#b4b4b4'));

  // Header
  c.addTextDisplayComponents(t =>
    t.setContent(`${EMOJIS.header} **${guild.name}** Information`)
  );
  c.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // General + icon thumbnail
  const generalLines = [
    `${EMOJIS.cat_general} **General**`,
    `> **Server ID:** \`${guild.id}\``,
    `> **Owner:** <@${guild.ownerId}>`,
    `> **Created:** ${ts(guild.createdAt)}`,
    `> **Language:** ${guild.preferredLocale}`,
    guild.description     ? `> **Description:** ${guild.description}` : null,
    guild.vanityURLCode   ? `> **Vanity URL:** discord.gg/${guild.vanityURLCode}` : null,
  ].filter(Boolean).join('\n');

  if (iconURL) {
    c.addSectionComponents(s =>
      s.addTextDisplayComponents(t => t.setContent(generalLines))
       .setThumbnailAccessory(th => th.setURL(iconURL).setDescription(`Icon of ${guild.name}`))
    );
  } else {
    c.addTextDisplayComponents(t => t.setContent(generalLines));
  }

  // Members
  const ml = [`${EMOJIS.cat_members} **Members**`];
  ml.push(`> **Total:** ${guild.memberCount.toLocaleString()}`);
  if (humanCount)  ml.push(`> **Humans:** ${humanCount.toLocaleString()}`);
  if (botCount)    ml.push(`> **Bots:** ${botCount.toLocaleString()}`);
  if (onlineCount) ml.push(`> **Online (cached):** ${onlineCount.toLocaleString()}`);
  ml.push(`> **Roles:** ${guild.roles.cache.size}`);
  c.addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(t => t.setContent(ml.join('\n')));

  // Channels
  const cl = [`${EMOJIS.cat_channels} **Channels**`];
  if (textCh)   cl.push(`> **Text:** ${textCh}`);
  if (voiceCh)  cl.push(`> **Voice:** ${voiceCh}`);
  if (catCh)    cl.push(`> **Categories:** ${catCh}`);
  if (annCh)    cl.push(`> **Announcement:** ${annCh}`);
  if (forumCh)  cl.push(`> **Forum:** ${forumCh}`);
  if (stageCh)  cl.push(`> **Stage:** ${stageCh}`);
  if (threadCh) cl.push(`> **Threads (cached):** ${threadCh}`);
  c.addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(t => t.setContent(cl.join('\n')));

  // Boost & Media
  const bl = [`${EMOJIS.cat_boost} **Boost & Media**`];
  bl.push(`> **Boost Tier:** ${boostTier(guild.premiumTier)}`);
  bl.push(`> **Total Boosts:** ${guild.premiumSubscriptionCount ?? 0}`);
  bl.push(`> **Emojis:** ${guild.emojis.cache.size} / ${emojiLimit}`);
  bl.push(`> **Stickers:** ${guild.stickers.cache.size}`);
  c.addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(t => t.setContent(bl.join('\n')));

  // Security
  const sl = [`${EMOJIS.cat_security} **Security**`];
  sl.push(`> **Verification:** ${verifyLabel(guild.verificationLevel)}`);
  sl.push(`> **Content Filter:** ${filterLabel(guild.explicitContentFilter)}`);
  sl.push(`> **2FA Required:** ${guild.mfaLevel === 1 ? 'Yes' : 'No'}`);
  sl.push(`> **NSFW Level:** ${nsfwLabel(guild.nsfwLevel)}`);
  c.addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(t => t.setContent(sl.join('\n')));

  // Features
  if (features) {
    c.addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(t => t.setContent(`${EMOJIS.cat_features} **Features**\n> ${features}`));
  }

  // Banner image — inside same container
  if (bannerURL) {
    c.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(t => t.setContent(`${EMOJIS.cat_banner} **Server Banner**`));
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item =>
        item.setURL(bannerURL).setDescription(`Banner of ${guild.name}`)
      )
    );
  }

  // Buttons — inside same container
  const buttons = [];
  if (iconURL) {
    buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.icon} Icon`).setStyle(ButtonStyle.Link).setURL(guild.iconURL({ size: 4096, dynamic: true })));
  }
  if (bannerURL) {
    buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.banner_btn} Banner`).setStyle(ButtonStyle.Link).setURL(guild.bannerURL({ size: 4096, dynamic: true })));
  }
  if (guild.vanityURLCode) {
    buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.invite} Invite`).setStyle(ButtonStyle.Link).setURL(`https://discord.gg/${guild.vanityURLCode}`));
  }
  if (buttons.length) {
    c.addActionRowComponents(ar => ar.addComponents(buttons));
  }

  return c;
}

// ── Module Export ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show detailed info about this server'),
  name: 'serverinfo',
  aliases: ['si', 'guildinfo', 'server', 'guild'],
  cooldown: 5,

  async execute(message, args, client, config) {
    try {
      if (!message.guild) {
        return replyThenDelete(message, {
          components: [buildStatusContainer(config, 'warn', 'This command can only be used in a server.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      const guild = await message.guild.fetch().catch(() => message.guild);
      const container = buildServerInfoContainer(config, guild);
      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[serverinfo] prefix error:', err);
      replyThenDelete(message, {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch server info.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },

  async slashExecute(interaction, client, config) {
    try {
      const guild = await interaction.guild.fetch().catch(() => interaction.guild);
      const container = buildServerInfoContainer(config, guild);
      await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[serverinfo] slash error:', err);
      const payload = {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch server info.')],
        flags: MessageFlags.IsComponentsV2,
      };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  },
};
