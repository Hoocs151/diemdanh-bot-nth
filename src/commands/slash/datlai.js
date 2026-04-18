/**
 * Slash Command: /reset-phien
 * Đặt lại danh sách đăng ký của một phiên
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { sessionRepo, regRepo } from '../../database/index.js';
import { COLORS } from '../../config/colors.js';
import { SESSION_STATUS } from '../../config/constants.js';
import { buildRegistrationEmbed } from '../../utils/embedBuilder.js';
import { buildAllComponents } from '../../utils/buttonBuilder.js';
import { isAdmin } from '../../middleware/permissions.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('datlai-phien')
  .setDescription('Đặt lại toàn bộ danh sách đăng ký của một phiên')
  .addStringOption((opt) =>
    opt
      .setName('session_id')
      .setDescription('Session ID (8 ký tự đầu)')
      .setRequired(true)
      .setMaxLength(8)
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isAdmin(interaction)) {
    return interaction.editReply({ content: '❌ Bạn không có quyền.' });
  }

  const sessionIdPrefix = interaction.options.getString('session_id');
  const sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);
  const session = sessions.find((s) => s.id.startsWith(sessionIdPrefix));

  if (!session) {
    return interaction.editReply({ content: `❌ Không tìm thấy session ID: \`${sessionIdPrefix}\`` });
  }

  if (session.status === SESSION_STATUS.CLOSED) {
    return interaction.editReply({ content: '❌ Phiên đã kết thúc, không thể đặt lại.' });
  }

  const total = regRepo.getTotalRegistrations(session.id);
  sessionRepo.resetSessionRegistrations(session.id);

  // Cập nhật message
  const channel = interaction.guild.channels.cache.get(session.channel_id);
  if (channel && session.message_id) {
    try {
      const message = await channel.messages.fetch(session.message_id);
      const embed = buildRegistrationEmbed(session, {}, interaction.guild);
      const components = buildAllComponents(session);
      await message.edit({ embeds: [embed], components });
    } catch (err) {
      logger.warn('[CMD-RESET]', `Không thể cập nhật message: ${err.message}`);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🔄 Đã Đặt Lại Danh Sách')
    .setColor(COLORS.WARNING)
    .setDescription(
      `**Phiên:** ${session.name}\n` +
        `**Session ID:** \`${session.id.slice(0, 8)}\`\n` +
        `**Đã xóa:** ${total} người\n` +
        `**Người thực hiện:** ${interaction.user.displayName}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('CMD', `${interaction.user.displayName} đặt lại phiên ${session.id.slice(0,8)}, xóa ${total} người`);
}
