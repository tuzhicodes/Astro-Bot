// commands/utility/userinfo.js
const {
  SlashCommandBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');

// ── Emojis (change here to update everywhere) ─────────────────────────────
const EMOJIS = {
  header:    '👤',

  cat_general:  '🏠',
  cat_badges:   '🏅',
  cat_member:   '🏠',
  cat_presence: '💡',
  cat_voice:    '🎙️',
  cat_roles:    '🏷️',
  cat_perms:    '🔑',
  cat_banner:   '🎨',

  id:        '🪪',
  created:   '📅',
  joined:    '📥',
  nickname:  '✏️',
  owner:     '👑',
  boost:     '💎',
  timeout:   '🔇',
  color:     '🎨',
  bot:       '🤖',
  status:    '🟢',
  activity:  '🎮',
  platform:  '💻',
  channel:   '🔊',
  muted:     '🔇',
  deafened:  '🔕',
  streaming: '📡',
  camera:    '📹',

  warn:  '⚠️',
  error: '❌',
};

// ── Badge Map ─────────────────────────────────────────────────────────────
const BADGE_MAP = {
  Staff:                 ['👨‍💼', 'Discord Staff'],
  Partner:               ['🤝',  'Partnered Server Owner'],
  Hypesquad:             ['🏠',  'HypeSquad Events'],
  BugHunterLevel1:       ['🐛',  'Bug Hunter'],
  HypeSquadOnlineHouse1: ['🏡',  'House Bravery'],
  HypeSquadOnlineHouse2: ['🏡',  'House Brilliance'],
  HypeSquadOnlineHouse3: ['🏡',  'House Balance'],
  PremiumEarlySupporter: ['⭐',  'Early Nitro Supporter'],
  BugHunterLevel2:       ['🪲',  'Bug Hunter Gold'],
  VerifiedBot:           ['✅',  'Verified Bot'],
  VerifiedDeveloper:     ['🔧',  'Verified Bot Developer'],
  CertifiedModerator:    ['🛡️',  'Discord Moderator Alumni'],
  BotHTTPInteractions:   ['🤖',  'HTTP Interaction Bot'],
  ActiveDeveloper:       ['💻',  'Active Developer'],
};

// ── Key Permissions ───────────────────────────────────────────────────────
const KEY_PERMISSIONS = [
  ['Administrator',           'Administrator'],
  ['ManageGuild',             'Manage Server'],
  ['ManageChannels',          'Manage Channels'],
  ['ManageRoles',             'Manage Roles'],
  ['ManageMessages',          'Manage Messages'],
  ['ManageWebhooks',          'Manage Webhooks'],
  ['ManageNicknames',         'Manage Nicknames'],
  ['KickMembers',             'Kick Members'],
  ['BanMembers',              'Ban Members'],
  ['ModerateMembers',         'Timeout Members'],
  ['MentionEveryone',         'Mention Everyone'],
  ['ViewAuditLog',            'View Audit Log'],
  ['ManageEmojisAndStickers', 'Manage Emoji'],
];

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

function getStatusLabel(status) {
  return { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' }[status] ?? '⚫ Unknown';
}

function getPlatformLabel(cs) {
  if (!cs) return null;
  const p = [];
  if (cs.desktop) p.push('Desktop');
  if (cs.mobile)  p.push('Mobile');
  if (cs.web)     p.push('Web');
  return p.length ? p.join(', ') : null;
}

// ── Build single container ────────────────────────────────────────────────

function buildUserInfoContainer(config, user, member) {
  const avatarURL = user.displayAvatarURL({ size: 256, dynamic: true });
  const bannerURL = user.bannerURL?.({ size: 2048, dynamic: true }) ?? null;
  const isOwner   = member?.guild?.ownerId === user.id;
  const isBot     = user.bot;

  const containerColor =
    member?.displayColor ||
    user.accentColor ||
    getHex(config, 'success', '#b4b4b4');

  // ── ONE container, everything inside ─────────────────────────────────
  const container = new ContainerBuilder().setAccentColor(containerColor);

  // ── Header ──
  container.addTextDisplayComponents(t =>
    t.setContent(`${EMOJIS.header} **[${user.username}](https://discord.com/users/${user.id})** Information`)
  );

  container.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // ── General (with thumbnail) ──
  const generalLines = [
    `${EMOJIS.cat_general} **General**`,
    `> **User ID:** \`${user.id}\``,
    `> **Username:** ${user.tag ?? user.username}`,
    isBot ? `> **Type:** Bot` : null,
  ].filter(Boolean).join('\n');

  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(t => t.setContent(generalLines))
      .setThumbnailAccessory(thumb =>
        thumb.setURL(avatarURL).setDescription(`Avatar of ${user.username}`)
      )
  );

  // ── Badges + Account Created ──
  const flags  = user.flags?.toArray() ?? [];
  const badges = flags.map(f => BADGE_MAP[f]).filter(Boolean);
  const badgeLines = [`${EMOJIS.cat_badges} **Badges**`];
  if (badges.length) {
    for (const [emoji, name] of badges) badgeLines.push(`> - ${emoji} ${name}`);
  } else {
    badgeLines.push(`> - None`);
  }
  badgeLines.push(`> **Account Created:** ${ts(user.createdAt)}`);

  container
    .addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(t => t.setContent(badgeLines.join('\n')));

  // ── Server Member ──
  if (member) {
    const memberLines = [`${EMOJIS.cat_member} **Server Member**`];
    memberLines.push(`> **Joined Server:** ${ts(member.joinedAt)}`);
    if (member.nickname)
      memberLines.push(`> **Nickname:** ${member.nickname}`);
    if (isOwner)
      memberLines.push(`> **Server Owner:** Yes`);
    if (member.premiumSince)
      memberLines.push(`> **Boosting Since:** ${ts(member.premiumSince)}`);
    if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date())
      memberLines.push(`> **Timed Out Until:** ${ts(member.communicationDisabledUntil)}`);
    if (member.displayColor) {
      const hex = `#${member.displayColor.toString(16).padStart(6, '0').toUpperCase()}`;
      memberLines.push(`> **Role Color:** \`${hex}\``);
    }

    container
      .addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(t => t.setContent(memberLines.join('\n')));
  }

  // ── Presence ──
  if (member?.presence) {
    const p = member.presence;
    const presLines = [`${EMOJIS.cat_presence} **Presence**`];
    presLines.push(`> **Status:** ${getStatusLabel(p.status)}`);
    const plat = getPlatformLabel(p.clientStatus);
    if (plat) presLines.push(`> **Platform:** ${plat}`);
    const actLabels = ['Playing', 'Streaming', 'Listening to', 'Watching', 'Custom Status', 'Competing in'];
    for (const act of p.activities ?? []) {
      presLines.push(`> **${actLabels[act.type] ?? 'Activity'}:** ${act.name}`);
    }

    container
      .addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(t => t.setContent(presLines.join('\n')));
  }

  // ── Voice ──
  if (member?.voice?.channel) {
    const vc = member.voice;
    const vcLines = [`${EMOJIS.cat_voice} **Voice**`];
    vcLines.push(`> ${EMOJIS.channel} **Channel:** <#${vc.channelId}>`);
    if (vc.selfMute)   vcLines.push(`>  **Self Muted:** Yes`);
    if (vc.selfDeaf)   vcLines.push(`>  **Self Deafened:** Yes`);
    if (vc.serverMute) vcLines.push(`>  **Server Muted:** Yes`);
    if (vc.serverDeaf) vcLines.push(`>  **Server Deafened:** Yes`);
    if (vc.streaming)  vcLines.push(`>  **Streaming:** Yes`);
    if (vc.selfVideo)  vcLines.push(`>  **Camera On:** Yes`);

    container
      .addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(t => t.setContent(vcLines.join('\n')));
  }

  // ── Roles ──
  if (member) {
    const roles = [...member.roles.cache.values()]
      .filter(r => r.id !== member.guild.id)
      .sort((a, b) => b.position - a.position);
    const roleCount    = roles.length;
    const displayRoles = roles.slice(0, 15).map(r => `<@&${r.id}>`).join(' ');
    const overflow     = roleCount > 15 ? ` *(+${roleCount - 15} more)*` : '';

    container
      .addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(t =>
        t.setContent(`${EMOJIS.cat_roles} **Roles (${roleCount})**\n> ${displayRoles || 'None'}${overflow}`)
      );
  }

  // ── Key Permissions ──
  if (member) {
    const has = KEY_PERMISSIONS
      .filter(([flag]) => member.permissions.has(PermissionFlagsBits[flag] ?? flag))
      .map(([, label]) => `- ${label}`);

    if (has.length) {
      container
        .addSeparatorComponents(s => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(t =>
          t.setContent(`${EMOJIS.cat_perms} **Key Permissions**\n${has.join('\n')}`)
        );
    }
  }

  // ── Banner (inside same container) ──
  if (bannerURL) {
    container
      .addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(t => t.setContent(`${EMOJIS.cat_banner} **User Banner**`))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(item =>
          item.setURL(bannerURL).setDescription(`Banner of ${user.username}`)
        )
      );
  }

  return container;
}

// ── Module Export ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription("Show detailed info about a user")
    .addUserOption(o =>
      o.setName('user').setDescription('Target user (default: you)').setRequired(false)
    ),
  name: 'userinfo',
  aliases: ['ui', 'whois', 'profile', 'user'],
  cooldown: 5,

  // ── Prefix ──────────────────────────────────────────────────────────────
  async execute(message, args, client, config) {
    try {
      const rawUser =
        message.mentions.users.first() ||
        (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null) ||
        message.author;

      const user = await client.users.fetch(rawUser.id, { force: true }).catch(() => rawUser);

      const member = message.guild
        ? (message.guild.members.cache.get(user.id) ??
           await message.guild.members.fetch({ user: user.id, withPresences: true }).catch(() => null))
        : null;

      const container = buildUserInfoContainer(config, user, member);
      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[userinfo] prefix error:', err);
      replyThenDelete(message, {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch user info.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },

  // ── Slash ────────────────────────────────────────────────────────────────
  async slashExecute(interaction, client, config) {
    try {
      const rawUser = interaction.options.getUser('user') || interaction.user;

      const user = await client.users.fetch(rawUser.id, { force: true }).catch(() => rawUser);

      const member = interaction.guild
        ? (interaction.guild.members.cache.get(user.id) ??
           await interaction.guild.members.fetch({ user: user.id, withPresences: true }).catch(() => null))
        : null;

      const container = buildUserInfoContainer(config, user, member);
      await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[userinfo] slash error:', err);
      const payload = {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch user info.')],
        flags: MessageFlags.IsComponentsV2,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
      
