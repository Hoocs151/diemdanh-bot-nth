/**
 * Embed Builder - Tạo embed điểm danh đẹp, chuyên nghiệp
 */

import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../config/colors.js';
import { FACTION_ORDER, FACTION_MAP } from '../config/factions.js';
import { formatDateTime } from './helpers.js';
import { CONFIG } from '../config/index.js';
import { PAGINATION } from '../config/constants.js';

/**
 * Tạo embed chính cho phiên điểm danh với pagination
 * @param {object} session
 * @param {object} registrations
 * @param {object} guild
 * @param {object} waitlists
 * @param {number} page - Trang hiện tại (0-indexed)
 */
export function buildRegistrationEmbed(session, registrations, guild, waitlists = {}, page = 0) {
  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);
  const waitlistTotal = Object.values(waitlists).reduce((sum, arr) => sum + arr.length, 0);
  const statusText = getStatusText(session.status);
  const statusColor = getEmbedColor(session.status);

  const embed = new EmbedBuilder()
    .setColor(statusColor)
    .setTimestamp();

  // Author với icon server
  if (guild?.iconURL()) {
    embed.setAuthor({
      name: session.name,
      iconURL: guild.iconURL({ size: 128 }),
    });
  } else {
    embed.setTitle(session.name);
  }

  // Mô tả
  if (session.description) {
    embed.setDescription(session.description);
  }

  // === TRẠNG THÁI + SESSION ID (inline 2 cột) ===
  embed.addFields(
    {
      name: 'Trạng thái',
      value: getStatusEmoji(session.status) + ' ' + statusText,
      inline: true,
    },
    {
      name: 'Session ID',
      value: '`' + session.id.slice(0, 8) + '`',
      inline: true,
    }
  );

  // === TỔNG SỐ ===
  const tongCongText = 'Tổng cộng: ' + total + ' người';
  embed.addFields({
    name: tongCongText,
    value: '\u200B',
    inline: false,
  });

  // === DANH SÁCH TỪNG PHÁI VỚI PAGINATION ===
  const membersPerPage = PAGINATION.MEMBERS_PER_PAGE;

  for (let i = 0; i < FACTION_ORDER.length; i += 2) {
    const f1 = FACTION_MAP[FACTION_ORDER[i]];
    const f2 = FACTION_ORDER[i + 1] ? FACTION_MAP[FACTION_ORDER[i + 1]] : null;

    const m1 = registrations[FACTION_ORDER[i]] || [];
    const m2 = f2 ? registrations[FACTION_ORDER[i + 1]] || [] : [];
    const w1 = waitlists[FACTION_ORDER[i]] || [];
    const w2 = f2 ? (waitlists[FACTION_ORDER[i + 1]] || []) : [];

    // Tính pagination cho faction 1
    const totalPages1 = Math.ceil(m1.length / membersPerPage) || 1;
    const currentPage1 = Math.min(page, totalPages1 - 1);
    const v1 = formatFactionMembersWithPage(m1, w1, session.max_per_faction, currentPage1, membersPerPage);

    // Tính pagination cho faction 2
    const v2 = f2 ? formatFactionMembersWithPage(m2, w2, session.max_per_faction, currentPage1, membersPerPage) : '\u200B';

    // Tên faction với thông tin trang
    const pageInfo1 = totalPages1 > 1 ? ` (${currentPage1 + 1}/${totalPages1})` : '';
    const f1Name = f1.emoji + ' ' + f1.name + ' (' + m1.length + ')' + pageInfo1;
    const f2Name = f2 ? f2.emoji + ' ' + f2.name + ' (' + m2.length + ')' + pageInfo1 : '\u200B';

    embed.addFields(
      {
        name: f1Name,
        value: v1,
        inline: true,
      },
      {
        name: f2Name,
        value: v2,
        inline: true,
      }
    );
  }

  // === DANH SÁCH CHỜ (nếu có) ===
  if (waitlistTotal > 0) {
    embed.addFields({
      name: 'Dự bị: ' + waitlistTotal + ' người',
      value: '\u200B',
      inline: false,
    });

    // Hiển thị waitlist mỗi phái (inline 2 cột)
    for (let i = 0; i < FACTION_ORDER.length; i += 2) {
      const f1 = FACTION_MAP[FACTION_ORDER[i]];
      const f2 = FACTION_ORDER[i + 1] ? FACTION_MAP[FACTION_ORDER[i + 1]] : null;
      const w1 = waitlists[FACTION_ORDER[i]] || [];
      const w2 = f2 ? (waitlists[FACTION_ORDER[i + 1]] || []) : [];

      const v1 = formatWaitlistMembers(w1);
      const v2 = f2 ? formatWaitlistMembers(w2) : '\u200B';

      embed.addFields(
        {
          name: f1.emoji + ' ' + f1.name + ' (dự bị: ' + w1.length + ')',
          value: v1,
          inline: true,
        },
        {
          name: f2 ? f2.emoji + ' ' + f2.name + ' (dự bị: ' + w2.length + ')' : '\u200B',
          value: v2,
          inline: true,
        }
      );
    }
  }

  // Footer với thông tin pagination
  let footerText = 'Cập nhật: ' + formatDateTime(new Date().toISOString());
  const hasPagination = Object.values(registrations).some(arr => arr.length > membersPerPage);
  if (hasPagination) {
    footerText += ' | Dùng nút bên dưới để xem thêm';
  }
  embed.setFooter({ text: footerText });

  return embed;
}

/**
 * Format danh sách thành viên với pagination
 */
function formatFactionMembersWithPage(members, waitlist, max, page, perPage) {
  if (members.length === 0 && waitlist.length === 0) return '_Trống_';

  const start = page * perPage;
  const end = Math.min(start + perPage, members.length);
  const pageMembers = members.slice(start, end);

  let result = '';
  const names = pageMembers.map((m, i) => (start + i + 1) + '. ' + m.userName).join('\n');

  if (members.length > perPage) {
    result = names + '\n_Trang ' + (page + 1) + '/' + Math.ceil(members.length / perPage) + '_';
  } else if (members.length > 0) {
    result = names;
  }

  // Thêm thông báo dự bị nếu có
  if (waitlist.length > 0) {
    if (result) result += '\n';
    result += '(+' + waitlist.length + ' dự bị)';
  }

  return result || '_Trống_';
}

/**
 * Format danh sách thành viên (legacy - không pagination)
 */
function formatFactionMembers(members, waitlist, max) {
  if (members.length === 0 && waitlist.length === 0) return '_Trống_';

  let result = '';
  const limit = 5;
  const shown = members.slice(0, limit);
  const names = shown.map((m, i) => (i + 1) + '. ' + m.userName).join('\n');

  if (members.length > limit) {
    result = names + '\n... +' + (members.length - limit) + ' người';
  } else if (members.length > 0) {
    result = names;
  }

  // Thêm thông báo dự bị nếu có
  if (waitlist.length > 0) {
    if (result) result += '\n';
    result += '(+' + waitlist.length + ' dự bị)';
  }

  return result || '_Trống_';
}

/**
 * Format danh sách dự bị
 */
function formatWaitlistMembers(waitlist) {
  if (waitlist.length === 0) return '_Không có_';
  const limit = 5;
  const shown = waitlist.slice(0, limit);
  const names = shown.map((m) => m.position + '. ' + m.userName).join('\n');
  if (waitlist.length > limit) {
    return names + '\n... +' + (waitlist.length - limit) + ' người';
  }
  return names;
}

function getStatusEmoji(status) {
  if (status === 'open') return '🟢';
  if (status === 'locked') return '🔒';
  if (status === 'closed') return '✅';
  return '';
}

/**
 * Tạo embed thống kê tổng quan (dùng khi export)
 */
export function buildSummaryEmbed(session, registrations) {
  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);

  const embed = new EmbedBuilder()
    .setTitle('Thống kê - ' + session.name)
    .setColor(COLORS.INFO)
    .setTimestamp();

  let overviewText = 'Tổng cộng: ' + total + ' người\n\n';

  for (const factionId of FACTION_ORDER) {
    const faction = FACTION_MAP[factionId];
    if (!faction) continue;
    const members = registrations[factionId] || [];
    overviewText += faction.emoji + ' ' + faction.name + ': ' + members.length + ' người\n';
  }

  embed.setDescription(overviewText);
  return embed;
}

/**
 * Tạo embed xác nhận hành động (ephemeral)
 */
export function buildActionEmbed(action, factionName, factionEmoji, waitlistPosition = null) {
  const configs = {
    registered: {
      color: COLORS.SUCCESS,
      text: 'Bạn đã đăng ký thành công phái **' + factionName + '**',
    },
    unregistered: {
      color: COLORS.WARNING,
      text: 'Bạn đã hủy đăng ký khỏi phái **' + factionName + '**',
    },
    switched: {
      color: COLORS.INFO,
      text: 'Bạn đã chuyển sang phái **' + factionName + '**',
    },
    locked: {
      color: COLORS.LOCKED,
      text: 'Phiên điểm danh đã bị khóa! Không thể đăng ký.',
    },
    error: {
      color: COLORS.ERROR,
      text: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    },
    rate_limit: {
      color: COLORS.WARNING,
      text: 'Bạn thao tác quá nhanh. Vui lòng chờ ' + (CONFIG.DEBOUNCE_MS / 1000) + 's.',
    },
    // Waitlist actions
    waitlist: {
      color: COLORS.INFO,
      text: 'Phái **' + factionName + '** đã đầy! Bạn đã được thêm vào danh sách chờ (vị trí #' + (waitlistPosition || '?') + ').',
    },
    waitlist_cancelled: {
      color: COLORS.WARNING,
      text: 'Bạn đã rời danh sách chờ của phái **' + factionName + '**.',
    },
    waitlist_moved: {
      color: COLORS.INFO,
      text: 'Bạn đã chuyển danh sách chờ sang phái **' + factionName + '**.',
    },
  };

  const cfg = configs[action] || configs.error;
  const emoji = factionEmoji || '';

  return new EmbedBuilder().setDescription(emoji + ' ' + cfg.text).setColor(cfg.color);
}

/**
 * Lấy màu embed theo trạng thái
 */
function getEmbedColor(status) {
  switch (status) {
    case 'open':
      return COLORS.OPEN;
    case 'locked':
      return COLORS.LOCKED;
    case 'closed':
      return COLORS.ENDED;
    default:
      return COLORS.PRIMARY;
  }
}

/**
 * Lấy text trạng thái
 */
function getStatusText(status) {
  if (status === 'closed') return 'Đã kết thúc';
  if (status === 'locked') return 'Đã khóa';
  return 'Đang mở';
}
