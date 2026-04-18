/**
 * Lệnh /backup - Sao lưu database thủ công
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { checkPermission, PermissionLevel } from '../../middleware/permissions.js';
import { manualBackup, listBackups } from '../../services/backupService.js';
import { COLORS } from '../../config/colors.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Sao lưu database ngay lập tức hoặc xem danh sách backup')
  .addStringOption((opt) =>
    opt
      .setName('action')
      .setDescription('Hành động cần thực hiện')
      .setRequired(false)
      .addChoices(
        { name: 'Tạo backup ngay', value: 'create' },
        { name: 'Xem danh sách backup', value: 'list' },
      )
  );

async function execute(interaction) {
  // Chỉ admin mới được dùng lệnh này
  if (!checkPermission(interaction, PermissionLevel.ADMIN)) {
    return;
  }

  const action = interaction.options.getString('action') || 'create';

  if (action === 'list') {
    const backups = listBackups();

    if (backups.length === 0) {
      return interaction.reply({
        content: '📦 Chưa có backup nào.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let text = `**📦 Danh sách backup (${backups.length}):**\n\n`;
    for (const b of backups.slice(0, 10)) {
      const time = new Date(b.createdAt).toLocaleString('vi-VN');
      const size = formatBytes(b.size);
      text += `• \`${b.name}\` - ${size} - ${time}\n`;
    }
    if (backups.length > 10) {
      text += `\n_... và ${backups.length - 10} backup khác_`;
    }

    return interaction.reply({
      content: text,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Tạo backup
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await manualBackup();

    if (!result.success) {
      return interaction.editReply({
        content: `❌ Lỗi tạo backup: \`${result.error}\``,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Backup thành công')
      .setColor(COLORS.SUCCESS)
      .setDescription(
        `Đã tạo backup database.\n\n` +
        `**File:** \`${result.path.split(/[/\\]/).pop()}\`\n` +
        `**Kích thước:** ${result.formattedSize}`
      )
      .setTimestamp();

    logger.info('BACKUP', `${interaction.user.displayName} tạo backup thủ công`);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error('BACKUP', `Lỗi backup: ${err.message}`);
    return interaction.editReply({
      content: `❌ Lỗi: \`${err.message}\``,
    });
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export { execute };
