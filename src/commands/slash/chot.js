/**
 * Slash Command: /chot-phien
 * Chốt đóng phiên điểm danh - không cho đăng ký nữa
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { sessionRepo, regRepo, auditRepo } from '../../database/index.js';
import { COLORS } from '../../config/colors.js';
import { SESSION_STATUS } from '../../config/constants.js';
import { buildRegistrationEmbed } from '../../utils/embedBuilder.js';
import { buildAllComponents } from '../../utils/buttonBuilder.js';
import { isAdmin } from '../../middleware/permissions.js';
import { logger } from '../../utils/logger.js';
import { FACTION_ORDER, FACTION_MAP } from '../../config/factions.js';

export const data = new SlashCommandBuilder()
  .setName('chot-phien')
  .setDescription('Chốt đóng phiên điểm danh - không cho đăng ký nữa')
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
    return interaction.editReply({ content: '❌ Phiên đã được chốt trước đó.' });
  }

  // Cập nhật trạng thái
  sessionRepo.updateSessionStatus(session.id, SESSION_STATUS.CLOSED, interaction.user.id, interaction.user.displayName);
  auditRepo.logClose(session.id, interaction.user.id, interaction.user.displayName);

  const registrations = regRepo.getRegistrationsBySession(session.id);
  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);

  // Cập nhật message - tắt tất cả button disabled
  const channel = interaction.guild.channels.cache.get(session.channel_id);
  if (channel && session.message_id) {
    try {
      const message = await channel.messages.fetch(session.message_id);
      const closedSession = { ...session, status: SESSION_STATUS.CLOSED };
      const embed = buildRegistrationEmbed(closedSession, registrations, interaction.guild);
      const components = buildAllComponents(closedSession);
      await message.edit({ embeds: [embed], components });
    } catch (err) {
      logger.warn('[CMD-CHOT]', `Không thể cập nhật message: ${err.message}`);
    }
  }

  // Gửi summary vào kênh
  const summaryText = buildSummaryText(session, registrations, total);
  const channel2 = interaction.guild.channels.cache.get(session.channel_id);
  if (channel2) {
    await channel2.send({
      content: `📊 **BANG CHIẾN ĐÃ CHỐT - ${session.name}**\n\n${summaryText}`,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Phiên Đã Được Chốt Đóng')
    .setColor(COLORS.SUCCESS)
    .setDescription(
      `**Phiên:** ${session.name}\n` +
        `**Session ID:** \`${session.id.slice(0, 8)}\`\n` +
        `**Tổng người:** ${total}\n` +
        `**Người chốt:** ${interaction.user.displayName}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('CMD', `${interaction.user.displayName} chốt phiên ${session.id.slice(0,8)}, ${total} người`);
}

function buildSummaryText(session, registrations, total) {
  let text = `📊 **TÓM TẮT DANH SÁCH**\n`;
  text += `Tổng số: **${total} người**\n\n`;

  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    text += `${f.emoji} **${f.name}:** ${members.length} người\n`;
    if (members.length > 0) {
      text += `   ${members.map((m) => m.userName).join(', ')}\n`;
    }
  }

  return text;
}
