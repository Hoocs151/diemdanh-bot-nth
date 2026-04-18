/**
 * Slash Command: /sua-phien
 * Admin: thêm, xóa, sửa người trong danh sách
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { sessionRepo, regRepo, auditRepo } from '../../database/index.js';
import { COLORS } from '../../config/colors.js';
import { SESSION_STATUS } from '../../config/constants.js';
import { isAdmin } from '../../middleware/permissions.js';
import { logger } from '../../utils/logger.js';
import { FACTION_MAP } from '../../config/factions.js';
import { buildRegistrationEmbed } from '../../utils/embedBuilder.js';
import { buildAllComponents } from '../../utils/buttonBuilder.js';

export const data = new SlashCommandBuilder()
  .setName('sua-phien')
  .setDescription('Admin: thêm/xóa người trong danh sách điểm danh')
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
      .setDescription('Hành động')
      .setRequired(true)
      .addChoices(
        { name: '➕ Thêm người', value: 'add' },
        { name: '➖ Xóa người', value: 'remove' }
      )
  )
  .addStringOption((opt) =>
    opt
      .setName('user')
      .setDescription('Tag người cần sửa (VD: @Tên)')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('phai')
      .setDescription('Phái cần thêm/xóa')
      .setRequired(true)
      .addChoices(
        { name: '🌟 Cửu Linh', value: 'cuu_linh' },
        { name: '⚔️ Thần Tướng', value: 'than_tuong' },
        { name: '🛡️ Thiết Y', value: 'thiet_y' },
        { name: '🌙 Toái Mộng', value: 'toai_mong' },
        { name: '🐉 Long Ngâm', value: 'long_ngam' },
        { name: '📜 Tố Vấn', value: 'to_van' },
        { name: '🩸 Huyết Hà', value: 'huyet_ha' }
      )
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isAdmin(interaction)) {
    return interaction.editReply({ content: '❌ Bạn không có quyền.' });
  }

  const sessionIdPrefix = interaction.options.getString('session_id');
  const action = interaction.options.getString('hanhdong');
  const userArg = interaction.options.getString('user');
  const factionId = interaction.options.getString('phai');

  const sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);
  const session = sessions.find((s) => s.id.startsWith(sessionIdPrefix));

  if (!session) {
    return interaction.editReply({ content: `❌ Không tìm thấy session ID: \`${sessionIdPrefix}\`` });
  }

  if (session.status === SESSION_STATUS.CLOSED) {
    return interaction.editReply({ content: '❌ Phiên đã kết thúc, không thể sửa.' });
  }

  // Parse user
  const userMatch = userArg.match(/<@!?(\d+)>/);
  if (!userMatch) {
    return interaction.editReply({ content: '❌ Định dạng user không đúng. Dùng: `@Tên` hoặc ID.' });
  }

  const targetUserId = userMatch[1];

  // Lấy tên user
  let targetUser;
  try {
    targetUser = await interaction.guild.members.fetch(targetUserId);
  } catch {
    return interaction.editReply({ content: '❌ Không tìm thấy user trong server.' });
  }

  const targetName = targetUser.nickname || targetUser.user.displayName;
  const faction = FACTION_MAP[factionId];

  if (action === 'add') {
    regRepo.forceRegister(session.id, targetUserId, targetName, factionId, interaction.user.id, interaction.user.displayName);

    const embed = new EmbedBuilder()
      .setTitle('✅ Đã thêm người')
      .setColor(COLORS.SUCCESS)
      .setDescription(
        `**Người:** ${targetName}\n` +
          `**Phái:** ${faction.emoji} ${faction.name}\n` +
          `**Phiên:** ${session.name}\n` +
          `**Người thực hiện:** ${interaction.user.displayName}`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else {
    const existing = regRepo.getRegistration(session.id, targetUserId);
    if (!existing) {
      return interaction.editReply({ content: '❌ Người này chưa đăng ký trong phiên.' });
    }

    regRepo.unregisterUser(session.id, targetUserId, interaction.user.id, interaction.user.displayName);

    const embed = new EmbedBuilder()
      .setTitle('➖ Đã xóa người')
      .setColor(COLORS.WARNING)
      .setDescription(
        `**Người:** ${targetName}\n` +
          `**Phái cũ:** ${faction.emoji} ${faction.name}\n` +
          `**Phiên:** ${session.name}\n` +
          `**Người thực hiện:** ${interaction.user.displayName}`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // Cập nhật message
  const channel = interaction.guild.channels.cache.get(session.channel_id);
  if (channel && session.message_id) {
    try {
      const message = await channel.messages.fetch(session.message_id);
      const registrations = regRepo.getRegistrationsBySession(session.id);
      const embed = buildRegistrationEmbed(session, registrations, interaction.guild);
      const components = buildAllComponents(session);
      await message.edit({ embeds: [embed], components });
    } catch (err) {
      logger.warn('[CMD-SUA]', `Không thể cập nhật message: ${err.message}`);
    }
  }

  logger.info('CMD', `${interaction.user.displayName} ${action} người vào phái`);
}
