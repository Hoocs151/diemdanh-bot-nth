/**
 * Button Builder - Tạo button components cho điểm danh bang chiến
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { ADMIN_BUTTON_IDS, BUTTON_IDS, PAGINATION, SESSION_STATUS } from '../config/constants.js';

/** Thông tin các phái dùng cho button */
export const FACTION_BUTTONS = [
  { id: 'cuu_linh', name: 'Cửu Linh', emoji: '<:CuuLinh:1494729885892219040>', style: ButtonStyle.Secondary },
  { id: 'than_tuong', name: 'Thần Tướng', emoji: '<:ThanTuong:1494729546610770180>', style: ButtonStyle.Secondary },
  { id: 'thiet_y', name: 'Thiết Y', emoji: '<:ThietY:1494729763816870100>', style: ButtonStyle.Secondary },
  { id: 'toai_mong', name: 'Toái Mộng', emoji: '<:ToaiMong:1494729720884101260>', style: ButtonStyle.Secondary },
  { id: 'long_ngam', name: 'Long Ngâm', emoji: '<:LongNgam:1494729814098055310>', style: ButtonStyle.Secondary },
  { id: 'to_van', name: 'Tố Vấn', emoji: '<:ToVan:1494729683265388706>', style: ButtonStyle.Secondary },
  { id: 'huyet_ha', name: 'Huyết Hà', emoji: '<:HuyetHa:1494729627669631066>', style: ButtonStyle.Secondary },
];

/**
 * Tạo button row components cho embed điểm danh
 * @param {boolean} enabled - có enable không (false = disabled khi khóa)
 */
export function buildRegistrationButtons(enabled = true) {
  // Row 1: 4 buttons đầu
  const row1 = new ActionRowBuilder();
  // Row 2: 3 buttons cuối
  const row2 = new ActionRowBuilder();

  FACTION_BUTTONS.forEach((faction, i) => {
    const btn = new ButtonBuilder()
      .setCustomId(`${BUTTON_IDS.REG_PREFIX}${faction.id}`)
      .setLabel(faction.name)
      .setEmoji(faction.emoji)
      .setStyle(faction.style)
      .setDisabled(!enabled);

    if (i < 4) {
      row1.addComponents(btn);
    } else {
      row2.addComponents(btn);
    }
  });

  return [row1, row2];
}

/**
 * Tạo admin action buttons
 * @param {string} status - trạng thái session: 'open' | 'locked' | 'closed'
 */
export function buildAdminButtons(status) {
  const row = new ActionRowBuilder();

  // Khóa/Mở
  if (status === SESSION_STATUS.OPEN) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_IDS.KHOA)
        .setLabel('🔒 Khóa')
        .setStyle(ButtonStyle.Danger)
    );
  } else if (status === SESSION_STATUS.LOCKED) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_IDS.MOKHOA)
        .setLabel('🔓 Mở Khóa')
        .setStyle(ButtonStyle.Success)
    );
  }

  // Đặt lại
  if (status !== SESSION_STATUS.CLOSED) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_IDS.RESET)
        .setLabel('🔄 Đặt lại')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // Chốt
  if (status !== SESSION_STATUS.CLOSED) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_IDS.CHOT)
        .setLabel('✅ Chốt')
        .setStyle(ButtonStyle.Success)
    );
  }

  // Xuất
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.XUAT)
      .setLabel('📤 Xuất DS')
      .setStyle(ButtonStyle.Secondary)
  );

  // Xóa
  if (status === SESSION_STATUS.CLOSED) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_IDS.XOA)
        .setLabel('🗑️ Xóa Phiên')
        .setStyle(ButtonStyle.Danger)
    );
  }

  return [row];
}

/**
 * Tạo pagination buttons cho embed
 * @param {object} registrations - danh sách đăng ký
 * @param {number} currentPage - trang hiện tại (0-indexed)
 */
export function buildPaginationComponents(registrations, currentPage = 0) {
  const membersPerPage = PAGINATION.MEMBERS_PER_PAGE;
  const hasPagination = Object.values(registrations).some(arr => arr.length > membersPerPage);

  if (!hasPagination) {
    return [];
  }

  // Kiểm tra có cần prev/next buttons
  const needsPrev = currentPage > 0;
  const needsNext = Object.values(registrations).some(arr => {
    const totalPages = Math.ceil(arr.length / membersPerPage);
    return totalPages > currentPage + 1;
  });

  const row = new ActionRowBuilder();
  const buttons = [];

  // Prev button
  if (needsPrev) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(PAGINATION.PREV_PAGE)
        .setLabel('◀️ Trang trước')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // Next button
  if (needsNext) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(PAGINATION.NEXT_PAGE)
        .setLabel('Trang sau ▶️')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (buttons.length === 0) {
    return [];
  }

  row.addComponents(buttons);
  return [row];
}

/**
 * Tạo toàn bộ components (đăng ký + admin + pagination)
 */
export function buildAllComponents(session, registrations = {}, currentPage = 0) {
  const enabled = session.status === 'open';
  return [
    ...buildRegistrationButtons(enabled),
    ...buildPaginationComponents(registrations, currentPage),
    ...buildAdminButtons(session.status),
  ];
}

/**
 * Parse faction ID từ custom button ID
 * @param {string} customId - VD: "reg_cuu_linh"
 * @returns {string|null} - VD: "cuu_linh"
 */
export function parseButtonFaction(customId) {
  if (!customId?.startsWith(BUTTON_IDS.REG_PREFIX)) return null;
  return customId.replace(BUTTON_IDS.REG_PREFIX, '');
}

/**
 * Kiểm tra button có phải là admin button không
 */
export function isAdminButton(customId) {
  return ADMIN_BUTTON_IDS.includes(customId);
}
