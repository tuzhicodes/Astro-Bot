// commands/utility/servericon.js
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
  title: '🏠',
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

/** Build the success server icon container */
function buildServerIconContainer(config, guild) {
  const isGif = Boolean(guild.icon?.startsWith('a_'));
  const url   = guild.iconURL({ size: 4096, dynamic: true });
  if (!url) return null;

  const png = guild.iconURL({ extension: 'png', size: 4096 });
  const jpg = guild.iconURL({ extension: 'jpg', size: 4096 });
  const gif = guild.iconURL({ extension: 'gif', size: 4096 });

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
      t.setContent(`${EMOJIS.title} **${guild.name} — Server Icon**`)
    )
    .addSeparatorComponents(s =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item =>
        item.setURL(url).setDescription(`Icon of ${guild.name}`)
      )
    );

  if (buttons.length) container.addActionRowComponents(ar => ar.setComponents(...buttons));
  return container;
}

// ── Module Export ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servericon')
    .setDescription("Show the server's icon"),
  name: 'servericon',
  aliases: ['sicon', 'guildicon', 'si'],
  cooldown: 5,

  // ── Prefix ──────────────────────────────────────────────────────────────
  async execute(message, args, client, config) {
    try {
      if (!message.guild) {
        return replyThenDelete(message, {
          components: [buildStatusContainer(config, 'warn', 'This command can only be used in a server.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const container = buildServerIconContainer(config, message.guild);

      if (!container) {
        return replyThenDelete(message, {
          components: [buildStatusContainer(config, 'warn', 'This server does not have an icon.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[servericon] prefix error:', err);
      replyThenDelete(message, {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch server icon.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },

  // ── Slash ────────────────────────────────────────────────────────────────
  async slashExecute(interaction, client, config) {
    try {
      const container = buildServerIconContainer(config, interaction.guild);

      if (!container) {
        return replyThenDelete(interaction, {
          components: [buildStatusContainer(config, 'warn', 'This server does not have an icon.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('[servericon] slash error:', err);
      const payload = {
        components: [buildStatusContainer(config, 'error', 'Failed to fetch server icon.')],
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
