/**
 * Slash Command: /khoa-phien
 * Khóa/Mở khóa một phiên điểm danh
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
  .setName('khoa-phien')
  .setDescription('Khóa hoặc mở khóa phiên điểm danh')
  .addStringOption((opt) =>
    opt
      .setName('session_id')
      .setDescription('Session ID (8 ký tự đầu)')
      .setRequired(true)
      .setMaxLength(8)
  )
  .addStringOption((opt) =>
    opt
      .setName('hanhdong')
      .setDescription('Chọn thao tác')
      .setRequired(true)
      .addChoices({ name: '🔒 Khóa', value: 'lock' }, { name: '🔓 Mở Khóa', value: 'unlock' })
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isAdmin(interaction)) {
    return interaction.editReply({ content: '❌ Bạn không có quyền.' });
  }

  const sessionIdPrefix = interaction.options.getString('session_id');
  const action = interaction.options.getString('hanhdong');

  // Tìm session
  const sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);
  const session = sessions.find((s) => s.id.startsWith(sessionIdPrefix));

  if (!session) {
    return interaction.editReply({ content: `❌ Không tìm thấy session ID: \`${sessionIdPrefix}\`` });
  }

  if (session.status === SESSION_STATUS.CLOSED) {
    return interaction.editReply({ content: '❌ Phiên đã kết thúc, không thể khóa/mở khóa.' });
  }

  const newStatus = action === 'lock' ? SESSION_STATUS.LOCKED : SESSION_STATUS.OPEN;
  sessionRepo.updateSessionStatus(session.id, newStatus, interaction.user.id, interaction.user.displayName);

  // Cập nhật message
  const channel = interaction.guild.channels.cache.get(session.channel_id);
  if (channel && session.message_id) {
    try {
      const message = await channel.messages.fetch(session.message_id);
      const registrations = regRepo.getRegistrationsBySession(session.id);
      const updatedSession = { ...session, status: newStatus };
      const embed = buildRegistrationEmbed(updatedSession, registrations, interaction.guild);
      const components = buildAllComponents(updatedSession);
      await message.edit({ embeds: [embed], components });
    } catch (err) {
      logger.warn('[CMD-KHOA]', `Không thể cập nhật message: ${err.message}`);
    }
  }

  const statusText = newStatus === SESSION_STATUS.LOCKED ? 'Đã khóa' : 'Đã mở khóa';
  const embed = new EmbedBuilder()
    .setTitle(`${action === 'lock' ? '🔒' : '🔓'} ${statusText}`)
    .setColor(newStatus === SESSION_STATUS.LOCKED ? COLORS.LOCKED : COLORS.SUCCESS)
    .setDescription(
      `**Phiên:** ${session.name}\n` +
        `**Session ID:** \`${session.id.slice(0, 8)}\`\n` +
        `**Người thực hiện:** ${interaction.user.displayName}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('CMD', `${interaction.user.displayName} khóa/mở khóa phiên ${session.id.slice(0,8)}`);
}
