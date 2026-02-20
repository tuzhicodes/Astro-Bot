// commands/utility/avatar.js
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
  title: '🖼️',
  warn:  '⚠️',
  error: '❌',
  png:   '🟥',
  jpg:   '🟧',
  webp:  '🌐',
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

/** Build the success avatar container */
function buildAvatarContainer(config, target) {
  const url = target.displayAvatarURL({ size: 4096, dynamic: true });
  if (!url) return null;

  const png  = target.displayAvatarURL({ extension: 'png',  size: 4096 });
  const jpg  = target.displayAvatarURL({ extension: 'jpg',  size: 4096 });
  const webp = target.displayAvatarURL({ extension: 'webp', size: 4096 });

  const buttons = [];
  if (png)  buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.png} PNG`).setStyle(ButtonStyle.Link).setURL(png));
  if (jpg)  buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.jpg} JPG`).setStyle(ButtonStyle.Link).setURL(jpg));
  if (webp) buttons.push(new ButtonBuilder().setLabel(`${EMOJIS.webp} WEBP`).setStyle(ButtonStyle.Link).setURL(webp));

  const container = new ContainerBuilder()
    .setAccentColor(getHex(config, 'success', '#b4b4b4'))
    .addTextDisplayComponents(t =>
      t.setContent(`${EMOJIS.title} **${target.tag ?? target.username}'s Avatar**`)
    )
    .addSeparatorComponents(s =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item =>
        item.setURL(url).setDescription(`Avatar of ${target.tag ?? target.username}`)
      )
    );

  if (buttons.length) container.addActionRowComponents(ar => ar.setComponents(...buttons));
  return container;
}

// ── Module Export ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show a user's avatar")
    .addUserOption(o =>
      o.setName('user').setDescription('Target user (default: you)').setRequired(false)
    ),
  name: 'avatar',
  aliases: ['av', 'pfp', 'icon'],
  cooldown: 5,

  // ── Prefix ──────────────────────────────────────────────────────────────
  async execute(message, args, client, config) {
    try {
      const target =
        message.mentions.users.first() ||
        (args[0] ? (message.guild?.members.cache.get(args[0])?.user ?? null) : null) ||
        message.author;

      const container = buildAvatarContainer(config, target);

      if (!container) {
        return replyThenDelete(message, {
          components: [buildStatusContainer(config, 'warn', 'This user has no avatar.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[avatar] prefix error:', err);
      replyThenDelete(message, {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch avatar.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },

  // ── Slash ────────────────────────────────────────────────────────────────
  async slashExecute(interaction, client, config) {
    try {
      const target = interaction.options.getUser('user') || interaction.user;
      const container = buildAvatarContainer(config, target);

      if (!container) {
        return replyThenDelete(interaction, {
          components: [buildStatusContainer(config, 'warn', 'This user has no avatar.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[avatar] slash error:', err);
      const payload = {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch avatar.')],
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
