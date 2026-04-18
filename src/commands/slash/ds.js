/**
 * Slash Command: /bangchien-ds
 * Xem danh sach cac phien diem danh trong server
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { sessionRepo } from '../../database/index.js';
import { COLORS } from '../../config/colors.js';
import { formatDateTime } from '../../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('danh-sach')
  .setDescription('Xem danh sách các phiên điểm danh trong server')
  .addStringOption((opt) =>
    opt
      .setName('trangthai')
      .setDescription('Lọc theo trạng thái')
      .setRequired(false)
      .addChoices(
        { name: 'Đang mở', value: 'open' },
        { name: 'Đã khóa', value: 'locked' },
        { name: 'Đã kết thúc', value: 'closed' },
        { name: 'Tất cả', value: 'all' }
      )
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.SendMessages);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const statusFilter = interaction.options.getString('trangthai') || 'all';
  let sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);

  if (statusFilter !== 'all') {
    sessions = sessions.filter((s) => s.status === statusFilter);
  }

  if (sessions.length === 0) {
    return interaction.editReply({
      content: '📭 Chưa có phiên điểm danh nào.',
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 Danh sách phiên điểm danh (${sessions.length})`)
    .setColor(COLORS.INFO)
    .setTimestamp();

  let desc = '';
  for (const s of sessions.slice(0, 10)) {
    const statusEmoji = s.status === 'open' ? '🟢' : s.status === 'locked' ? '🟡' : '🔴';
    desc += `${statusEmoji} **${s.name}**\n`;
    desc += `   ID: \`${s.id.slice(0, 8)}\`\n\n`;
  }

  if (sessions.length > 10) {
    desc += `_... và ${sessions.length - 10} phiên khác_`;
  }

  embed.setDescription(desc);
  await interaction.editReply({ embeds: [embed] });
}
