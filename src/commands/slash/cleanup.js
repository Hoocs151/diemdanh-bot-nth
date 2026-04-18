/**
 * Lệnh /cleanup - Xóa người đã rời khỏi guild khỏi danh sách đăng ký
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { checkPermission, PermissionLevel } from '../../middleware/permissions.js';
import { cleanupGuild, getRegisteredUserIds, filterLeftMembers, getLeftUsersDetails } from '../../services/cleanupService.js';
import { COLORS } from '../../config/colors.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('cleanup')
  .setDescription('Xóa người đã rời khỏi server khỏi danh sách đăng ký')
  .addStringOption((opt) =>
    opt
      .setName('action')
      .setDescription('Hành động cần thực hiện')
      .setRequired(false)
      .addChoices(
        { name: 'Kiểm tra - Xem ai đã rời (không xóa)', value: 'check' },
        { name: 'Xóa người đã rời', value: 'remove' },
        { name: 'Kiểm tra + Xóa', value: 'full' },
      )
  );

async function execute(interaction) {
  // Chỉ admin mới được dùng lệnh này
  if (!checkPermission(interaction, PermissionLevel.ADMIN)) {
    return;
  }

  const action = interaction.options.getString('action') || 'full';
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = interaction.guild;

    // Lấy tất cả user đang có trong registrations/waitlist
    const registeredUserIds = getRegisteredUserIds();

    if (registeredUserIds.length === 0) {
      return interaction.editReply({
        content: '✅ Không có ai trong danh sách đăng ký.',
      });
    }

    if (action === 'check') {
      // Chỉ kiểm tra
      const leftUsers = await filterLeftMembers(guild, registeredUserIds);

      if (leftUsers.length === 0) {
        return interaction.editReply({
          content: `✅ Tất cả ${registeredUserIds.length} người trong danh sách vẫn còn trong server.`,
        });
      }

      const details = getLeftUsersDetails(leftUsers);
      let text = `⚠️ **${leftUsers.length} người đã rời guild** (trong tổng ${registeredUserIds.length} người):\n\n`;
      for (const u of details.slice(0, 20)) {
        text += `- **${u.user_name}** (ID: \`${u.user_id}\`) - ${u.reg_count} đăng ký\n`;
      }
      if (details.length > 20) {
        text += `\n_... và ${details.length - 20} người khác_`;
      }

      return interaction.editReply({
        content: text,
      });
    }

    // Thực hiện cleanup
    const result = await cleanupGuild(guild);

    if (result.removed === 0 && result.usersRemoved === 0) {
      return interaction.editReply({
        content: '✅ Không có ai đã rời guild để xóa.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Cleanup hoàn tất')
      .setColor(COLORS.SUCCESS)
      .addFields(
        { name: 'Người đã xóa', value: `${result.usersRemoved} người`, inline: true },
        { name: 'Records đã xóa', value: `${result.removed} records`, inline: true },
        {
          name: 'Chi tiết theo phiên',
          value:
            Object.entries(result.sessions || {})
              .map(([sid, count]) => `Phiên \`${sid.slice(0, 8)}\`: ${count}`)
              .join('\n') || '_Không có_',
          inline: false,
        }
      )
      .setFooter({ text: `Guild: ${guild.name}` });

    logger.info('CLEANUP', `${interaction.user.displayName} chạy cleanup, xóa ${result.usersRemoved} người, ${result.removed} records`);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('CLEANUP', `Lỗi cleanup: ${err.message}`);
    return interaction.editReply({
      content: `❌ Lỗi: \`${err.message}\``,
    });
  }
}

export { execute };
