/**
 * Slash Command: /xuat-phien
 * Xuất danh sách đăng ký theo nhiều định dạng
 */

import { SlashCommandBuilder, PermissionsBitField, AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { sessionRepo, regRepo, auditRepo } from '../../database/index.js';
import { isAdmin } from '../../middleware/permissions.js';
import { logger } from '../../utils/logger.js';
import { splitMessage, formatDateTime } from '../../utils/helpers.js';
import { FACTION_ORDER, FACTION_MAP } from '../../config/factions.js';
import { isSheetsConfigured, exportToSheets } from '../../services/sheetsService.js';
import { COLORS } from '../../config/colors.js';

export const data = new SlashCommandBuilder()
  .setName('xuat-phien')
  .setDescription('Xuất danh sách đăng ký')
  .addStringOption((opt) =>
    opt
      .setName('session_id')
      .setDescription('Session ID (8 ký tự đầu)')
      .setRequired(true)
      .setMaxLength(8)
  )
  .addStringOption((opt) =>
    opt
      .setName('dinhdang')
      .setDescription('Định dạng xuất')
      .setRequired(true)
      .addChoices(
        { name: '📝 Theo phái (cho Discord)', value: 'by_faction' },
        { name: '📋 Tổng quan', value: 'overview' },
        { name: '📄 Đặc biệt (Zalo/Facebook)', value: 'social' },
        { name: '📊 Chi tiết + Thống kê', value: 'detail' },
        { name: '📁 File CSV (Excel)', value: 'csv' },
        { name: '📑 Google Sheets', value: 'sheets' }
      )
  )
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isAdmin(interaction)) {
    return interaction.editReply({ content: '❌ Bạn không có quyền.' });
  }

  const sessionIdPrefix = interaction.options.getString('session_id');
  const exportType = interaction.options.getString('dinhdang');

  const sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);
  const session = sessions.find((s) => s.id.startsWith(sessionIdPrefix));

  if (!session) {
    return interaction.editReply({ content: `❌ Không tìm thấy session ID: \`${sessionIdPrefix}\`` });
  }

  const registrations = regRepo.getRegistrationsBySession(session.id);
  const waitlists = regRepo.getAllWaitlists(session.id);
  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);

  let content;
  let attachment = null;

  switch (exportType) {
    case 'by_faction':
      content = buildByFaction(session, registrations);
      break;
    case 'overview':
      content = buildOverview(session, registrations, total);
      break;
    case 'social':
      content = buildSocial(session, registrations, total);
      break;
    case 'detail':
      content = buildDetail(session, registrations, total);
      break;
    case 'csv':
      content = buildCSV(session, registrations, waitlists);
      attachment = new AttachmentBuilder(Buffer.from(content, 'utf8'), {
        name: session.name.replace(/[^a-zA-Z0-9]/g, '_') + '.csv',
      });
      await interaction.editReply({ content: '📁 File CSV:', files: attachment ? [attachment] : [] });
      auditRepo.logExport(session.id, interaction.user.id, interaction.user.displayName, exportType);
      logger.info('CMD', `${interaction.user.displayName} xuất CSV phiên ${session.id.slice(0, 8)}`);
      return;
    case 'sheets': {
      // [NEW] Google Sheets export
      if (!isSheetsConfigured()) {
        const embed = new EmbedBuilder()
          .setTitle('⚠️ Google Sheets chưa được cấu hình')
          .setColor(COLORS.WARNING)
          .setDescription(
            'Để xuất Google Sheets, cần thiết lập:\n\n' +
            '1. Tạo Google Cloud Project và enable Google Sheets API\n' +
            '2. Tạo Service Account, tải credentials.json\n' +
            '3. Chia sẻ Google Sheet với email Service Account\n' +
            '4. Điền vào .env:\n' +
            '```\nGOOGLE_APPLICATION_CREDENTIALS=./credentials.json\nGOOGLE_SHEET_ID=your_sheet_id_here\n```'
          );
        return interaction.editReply({ embeds: [embed] });
      }

      await interaction.editReply({ content: '📑 Đang xuất lên Google Sheets...' });
      const result = await exportToSheets(session, registrations, waitlists);

      if (!result.success) {
        return interaction.editReply({ content: `❌ Lỗi xuất Google Sheets: \`${result.error}\`` });
      }

      auditRepo.logExport(session.id, interaction.user.id, interaction.user.displayName, 'sheets');
      logger.info('CMD', `${interaction.user.displayName} xuất Google Sheets phiên ${session.id.slice(0, 8)}`);

      const sheetsEmbed = new EmbedBuilder()
        .setTitle('✅ Xuất Google Sheets thành công')
        .setColor(COLORS.SUCCESS)
        .setDescription(`Đã xuất dữ liệu phiên **${session.name}** lên Google Sheets.\n\n[Mở Google Sheets](${result.url})`)
        .setTimestamp();

      return interaction.editReply({ embeds: [sheetsEmbed] });
    }
    default:
      content = buildOverview(session, registrations, total);
  }

  auditRepo.logExport(session.id, interaction.user.id, interaction.user.displayName, exportType);

  const parts = splitMessage(content, 2000);
  await interaction.editReply({ content: `📤 Danh sách phiên \`${session.name}\` (${parts.length} phần):` });

  for (const part of parts) {
    await interaction.channel.send({ content: part, allowedMentions: { parse: [] } });
  }

  logger.info('CMD', `${interaction.user.displayName} xuất danh sách phiên ${session.id.slice(0,8)}, type=${exportType}`);
}

function buildByFaction(session, registrations) {
  let text = `📋 **DANH SÁCH ĐĂNG KÝ - ${session.name}**\n`;
  text += `Session: \`${session.id.slice(0, 8)}\`\n`;
  text += `─────────────────────────────\n\n`;

  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    text += `${f.emoji} **${f.name}** (${members.length} người)\n`;

    if (members.length === 0) {
      text += `   _Chưa có người đăng ký_\n`;
    } else {
      for (let i = 0; i < members.length; i++) {
        text += `   ${i + 1}. ${members[i].userName}\n`;
      }
    }
    text += `\n`;
  }

  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);
  text += `─────────────────────────────\n`;
  text += `**Tổng cộng: ${total} người**`;

  return text;
}

function buildOverview(session, registrations, total) {
  let text = `📊 **THỐNG KÊ - ${session.name}**\n\n`;

  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    const pct = total > 0 ? ((members.length / total) * 100).toFixed(1) : 0;
    text += `${f.emoji} ${f.name}: **${members.length}** người (${pct}%)\n`;
  }

  text += `\n─────────────────────────────\n`;
  text += `**Tổng cộng: ${total} người**\n`;
  text += `**Session ID:** \`${session.id.slice(0, 8)}\``;

  return text;
}

function buildSocial(session, registrations, total) {
  let text = `✅ DANH SÁCH THAM GIA\n`;
  text += `📌 ${session.name}\n`;
  text += `─────────────────\n`;

  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    if (members.length === 0) continue;

    text += `\n${f.emoji} ${f.name}:\n`;
    text += members.map((m, i) => `${i + 1}. ${m.userName}`).join('\n');
    text += `\n`;
  }

  text += `\n─────────────────\n`;
  text += `Tổng: ${total} người`;

  return text;
}

function buildDetail(session, registrations, total) {
  let text = `📊 **BÁO CÁO CHI TIẾT**\n`;
  text += `─────────────────────────────\n`;
  text += `**Sự kiện:** ${session.name}\n`;
  text += `**Mô tả:** ${session.description || 'Không có'}\n`;
  text += `**Bắt đầu:** ${formatDateTime(session.start_time)}\n`;
  text += `**Người tạo:** ${session.created_by_name}\n`;
  text += `**Trạng thái:** ${session.status}\n`;
  text += `─────────────────────────────\n\n`;

  text += `**TÓM TẮT THEO PHÁI:**\n`;
  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    text += `  ${f.emoji} ${f.name}: ${members.length} người\n`;
  }
  text += `\n─────────────────────────────\n`;

  text += `**DANH SÁCH CHI TIẾT:**\n`;
  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    text += `\n${f.emoji} ${f.name} (${members.length}):\n`;
    if (members.length === 0) {
      text += `  (trống)\n`;
    } else {
      for (const m of members) {
        text += `  - ${m.userName} | ${formatDateTime(m.registeredAt)}\n`;
      }
    }
  }

  text += `\n─────────────────────────────\n`;
  text += `**Tổng: ${total} người**\n`;
  text += `**Session:** \`${session.id}\``;

  return text;
}

/**
 * Escape giá trị CSV - xử lý dấu phẩy, nháy, xuống dòng
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Xuất danh sách ra file CSV
 */
function buildCSV(session, registrations, waitlists) {
  let csv = '\uFEFF'; // BOM for Excel UTF-8
  csv += 'STT,Phai,Ten,ThoiGianDangKy,TrangThai\n';

  let stt = 1;
  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    for (const m of members) {
      csv += `${stt++},${escapeCSV(f.name)},${escapeCSV(m.userName)},${escapeCSV(m.registeredAt)},Chinh thuc\n`;
    }
    const wlist = waitlists[fid] || [];
    for (const w of wlist) {
      csv += `${stt++},${escapeCSV(f.name)},${escapeCSV(w.userName)},${escapeCSV(w.joinedAt)},Du bi\n`;
    }
  }
  return csv;
}
