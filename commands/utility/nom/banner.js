// commands/utility/banner.js
const {
  SlashCommandBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

// ── Emojis (change here to update everywhere) ─────────────────────────────
const EMOJIS = {
  title: '🎨',
  warn:  '⚠️',
  error: '❌',
  png:   '🟥',
  jpg:   '🟧',
  gif:   '🎞️',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getHex(config, key, fallback) {
  const raw = config?.colors?.[key] ?? process.env[`COLOR_${key.toUpperCase()}`] ?? fallback;
  return parseInt(raw.replace('#', ''), 16);
}

/** One-line status container: warn / error / cooldown */
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

/** Reply with Components V2 and auto-delete after `delay` ms */
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

/** Fetch full user object (needed for banner) */
async function fetchUser(client, userId) {
  return client.users.fetch(userId, { force: true }).catch(() => null);
}

/** Build the success banner container */
function buildBannerContainer(config, user) {
  const isGif = Boolean(user.banner?.startsWith('a_'));
  const url   = user.bannerURL({ size: 4096, dynamic: true });
  if (!url) return null;

  const png = user.bannerURL({ extension: 'png', size: 4096 });
  const jpg = user.bannerURL({ extension: 'jpg', size: 4096 });
  const gif = user.bannerURL({ extension: 'gif', size: 4096 });

  const buttons = [];
  if (png) buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.png} PNG`).setStyle(ButtonStyle.Link).setURL(png));
  if (jpg) buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.jpg} JPG`).setStyle(ButtonStyle.Link).setURL(jpg));
  buttons.push(
    new ButtonBuilder()
      .setLabel(`${EMOJIS.gif} GIF`)
      .setStyle(ButtonStyle.Link)
      .setURL(gif ?? png)
      .setDisabled(!isGif)
  );

  const container = new ContainerBuilder()
    .setAccentColor(getHex(config, 'success', '#b4b4b4'))
    .addTextDisplayComponents(t =>
      t.setContent(`${EMOJIS.title} **${user.tag ?? user.username}'s Banner**`)
    )
    .addSeparatorComponents(s =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item =>
        item.setURL(url).setDescription(`Banner of ${user.tag ?? user.username}`)
      )
    );

  if (buttons.length) container.addActionRowComponents(ar => ar.setComponents(...buttons));
  return container;
}

// ── Module Export ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Show a user's banner")
    .addUserOption(o =>
      o.setName('user').setDescription('Target user (default: you)').setRequired(false)
    ),
  name: 'banner',
  aliases: ['bnr', 'userbanner'],
  cooldown: 5,

  // ── Prefix ──────────────────────────────────────────────────────────────
  async execute(message, args, client, config) {
    try {
      const rawTarget =
        message.mentions.users.first() ||
        (args[0] ? (message.guild?.members.cache.get(args[0])?.user ?? null) : null) ||
        message.author;

      // Force-fetch to get banner data
      const user = await fetchUser(client, rawTarget.id);
      const container = user ? buildBannerContainer(config, user) : null;

      if (!container) {
        return replyThenDelete(message, {
          components: [buildStatusContainer(config, 'warn', 'This user does not have a banner.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[banner] prefix error:', err);
      replyThenDelete(message, {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch banner.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },

  // ── Slash ────────────────────────────────────────────────────────────────
  async slashExecute(interaction, client, config) {
    try {
      const rawTarget = interaction.options.getUser('user') || interaction.user;

      // Force-fetch to get banner data
      const user = await fetchUser(client, rawTarget.id);
      const container = user ? buildBannerContainer(config, user) : null;

      if (!container) {
        return replyThenDelete(interaction, {
          components: [buildStatusContainer(config, 'warn', 'This user does not have a banner.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[banner] slash error:', err);
      const payload = {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch banner.')],
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
