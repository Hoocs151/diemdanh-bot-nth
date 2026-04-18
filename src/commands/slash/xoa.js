/**
 * Slash Command: /xoa-phien
 * Xóa một phiên điểm danh (chỉ phiên đã chốt)
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { sessionRepo, auditRepo } from '../../database/index.js';
import { COLORS } from '../../config/colors.js';
import { SESSION_STATUS } from '../../config/constants.js';
import { isAdmin } from '../../middleware/permissions.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('xoa-phien')
  .setDescription('Xóa một phiên điểm danh (chỉ phiên đã chốt)')
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

  if (session.status !== SESSION_STATUS.CLOSED) {
    return interaction.editReply({
      content: '❌ Chỉ có thể xóa phiên đã chốt. Dùng `/chot-phien` để chốt trước.',
    });
  }

  // Xóa message cũ
  const channel = interaction.guild.channels.cache.get(session.channel_id);
  if (channel && session.message_id) {
    try {
      const message = await channel.messages.fetch(session.message_id);
      await message.delete();
    } catch {
      // Message có thể đã bị xóa
    }
  }

  sessionRepo.deleteSession(session.id);
  auditRepo.logDelete(session.id, interaction.user.id, interaction.user.displayName);

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Đã Xóa Phiên')
    .setColor(COLORS.ERROR)
    .setDescription(
      `**Phiên:** ${session.name}\n` +
        `**Người xóa:** ${interaction.user.displayName}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('CMD', `${interaction.user.displayName} xóa phiên ${session.id.slice(0,8)}`);
}
