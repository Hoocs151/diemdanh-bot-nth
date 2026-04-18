/**
 * Slash Command: /tao-phien
 * Tạo phiên điểm danh bang chiến mới
 * Có bước preview trước khi tạo thực sự
 */

import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';
import { COLORS } from '../../config/colors.js';
import { sessionRepo } from '../../database/index.js';
import { buildRegistrationEmbed } from '../../utils/embedBuilder.js';
import { buildAllComponents } from '../../utils/buttonBuilder.js';
import { isAdmin } from '../../middleware/permissions.js';
import { logger } from '../../utils/logger.js';

/** Lưu trữ params tạm thời cho preview (key: interaction ID, value: params) */
const pendingSessions = new Map();

export const data = new SlashCommandBuilder()
  .setName('tao-phien')
  .setDescription('Tạo phiên điểm danh bang chiến mới')
  .addStringOption((opt) =>
    opt
      .setName('ten')
      .setDescription('Tên sự kiện / Tên phiên điểm danh')
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption((opt) =>
    opt
      .setName('mota')
      .setDescription('Mô tả thêm về sự kiện (không bắt buộc)')
      .setRequired(false)
      .setMaxLength(500)
  )
  .addChannelOption((opt) =>
    opt
      .setName('kenh')
      .setDescription('Kênh gửi thông báo (mặc định là kênh hiện tại)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('gioihan')
      .setDescription('Số người tối đa mỗi phái (0 = không giới hạn)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // === KIỂM TRA QUYỀN ===
  if (!isAdmin(interaction)) {
    return interaction.editReply({
      content: '❌ Bạn không có quyền tạo phiên điểm danh.',
    });
  }

  const name = interaction.options.getString('ten').trim();
  const description = interaction.options.getString('mota')?.trim() || '';
  const notifyChannel = interaction.options.getChannel('kenh') || interaction.channel;
  const maxPerFaction = interaction.options.getInteger('gioihan') ?? 0;

  // === TẠO PREVIEW EMBED ===
  // Tạo session object tạm để preview
  const previewSession = {
    id: 'PREVIEW_' + interaction.id,
    name,
    description,
    status: 'open',
    max_per_faction: maxPerFaction,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    guild_id: interaction.guild.id,
    channel_id: interaction.channelId,
    message_id: null,
  };

  const previewEmbed = buildRegistrationEmbed(previewSession, {}, interaction.guild);

  // === TẠO BUTTON XÁC NHẬN ===
  const confirmButton = new ButtonBuilder()
    .setCustomId(`tao-phien:confirm:${interaction.id}`)
    .setLabel('✅ Xác nhận tạo')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`tao-phien:cancel:${interaction.id}`)
    .setLabel('❌ Hủy')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

  // === LƯU PARAMS TẠM THỜI ===
  pendingSessions.set(interaction.id, {
    name,
    description,
    notifyChannelId: notifyChannel.id,
    guildId: interaction.guild.id,
    guildName: interaction.guild.name,
    channelId: interaction.channelId,
    createdById: interaction.user.id,
    createdByName: interaction.user.displayName,
    maxPerFaction,
    expiresAt: Date.now() + 5 * 60 * 1000, // Hết hạn sau 5 phút
  });

  // === REPLY VỚI PREVIEW ===
  const previewInfo = new EmbedBuilder()
    .setTitle('📋 Xem trước phiên điểm danh')
    .setColor(COLORS.INFO)
    .setDescription(
      `**Tên sự kiện:** ${name}\n` +
        `**Mô tả:** ${description || '_Không có_'}\n` +
        `**Kênh:** ${notifyChannel}\n` +
        `**Giới hạn/phái:** ${maxPerFaction > 0 ? maxPerFaction : 'Không giới hạn'}\n\n` +
        `Nhấn **Xác nhận** để tạo hoặc **Hủy** để hủy bỏ.`
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [previewInfo, previewEmbed],
    components: [row],
  });

  // Cleanup sau 5 phút
  setTimeout(() => {
    pendingSessions.delete(interaction.id);
  }, 5 * 60 * 1000);
}

/**
 * Xử lý button xác nhận/hủy tạo phien
 */
export async function handlePreviewButton(interaction) {
  const [action, interactionId] = interaction.customId.split(':').slice(1);

  const params = pendingSessions.get(interactionId);

  if (!params) {
    await interaction.reply({
      content: '❌ Preview đã hết hạn hoặc không tồn tại. Vui lòng tạo lại.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Kiểm tra user có phải là người tạo không
  if (interaction.user.id !== params.createdById) {
    await interaction.reply({
      content: '❌ Chỉ người tạo mới có thể xác nhận.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === 'cancel') {
    pendingSessions.delete(interactionId);
    await interaction.editReply({
      content: '❌ Đã hủy tạo phiên điểm danh.',
      embeds: [],
      components: [],
    });
    return;
  }

  // === TẠO SESSION THỰC SỰ ===
  const session = sessionRepo.createSession({
    name: params.name,
    description: params.description,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    notifyChannelId: params.notifyChannelId,
    guildId: params.guildId,
    guildName: params.guildName,
    channelId: params.channelId,
    createdById: params.createdById,
    createdByName: params.createdByName,
    maxPerFaction: params.maxPerFaction,
  });

  // Xóa params khỏi pending
  pendingSessions.delete(interactionId);

  // Gửi embed vào kênh thông báo
  const notifyChannel = interaction.guild.channels.cache.get(params.notifyChannelId);
  if (notifyChannel) {
    const embed = buildRegistrationEmbed(session, {}, interaction.guild);
    const components = buildAllComponents(session, {});
    const message = await notifyChannel.send({
      embeds: [embed],
      components,
    });
    sessionRepo.updateSessionMessageId(session.id, message.id);
  }

  // === REPLY THÀNH CÔNG ===
  const successEmbed = new EmbedBuilder()
    .setTitle('✅ Phiên điểm danh đã được tạo thành công!')
    .setColor(COLORS.SUCCESS)
    .setDescription(
      `**Sự kiện:** ${params.name}\n` +
        `**Kênh:** ${notifyChannel || 'N/A'}\n` +
        `**Giới hạn/phái:** ${params.maxPerFaction > 0 ? params.maxPerFaction : 'Không giới hạn'}\n` +
        `**Session ID:** \`${session.id.slice(0, 8)}\``
    )
    .setTimestamp();

  await interaction.editReply({
    content: '',
    embeds: [successEmbed],
    components: [],
  });

  logger.info(
    'CMD', `${params.createdByName} tạo phiên: ${params.name} (${session.id.slice(0, 8)})`
  );
}

/**
 * Kiểm tra xem button có phải của tao-phien preview không
 */
export function isTaoPhienButton(customId) {
  return customId.startsWith('tao-phien:confirm:') || customId.startsWith('tao-phien:cancel:');
}
