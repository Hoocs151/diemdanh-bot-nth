/**
 * Constants - Các hằng số dùng chung trong toàn bộ bot
 * Thay vì dùng magic strings rải rác, tất cả được tập trung ở đây
 */

export const SESSION_STATUS = {
  OPEN: 'open',
  LOCKED: 'locked',
  CLOSED: 'closed',
};

export const BUTTON_IDS = {
  // Admin buttons
  KHOA: 'admin_khoa',
  MOKHOA: 'admin_mokhoa',
  RESET: 'admin_reset',
  CHOT: 'admin_chot',
  XUAT: 'admin_xuat',
  XOA: 'admin_xoa',
  SUA: 'admin_sua',

  // Registration button prefix
  REG_PREFIX: 'reg_',
};

export const ADMIN_BUTTON_IDS = [
  BUTTON_IDS.KHOA,
  BUTTON_IDS.MOKHOA,
  BUTTON_IDS.RESET,
  BUTTON_IDS.CHOT,
  BUTTON_IDS.XUAT,
  BUTTON_IDS.XOA,
  BUTTON_IDS.SUA,
];

export const ACTION_TYPES = {
  REGISTERED: 'registered',
  UNREGISTERED: 'unregistered',
  SWITCHED: 'switched',
  WAITLIST: 'waitlist',
  WAITLIST_CANCELLED: 'waitlist_cancelled',
  WAITLIST_MOVED: 'waitlist_moved',
  RATE_LIMIT: 'rate_limit',
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  RESET: 'reset',
  ERROR: 'error',
};

/** Pagination constants */
export const PAGINATION = {
  /** Số người hiển thị mỗi trang */
  MEMBERS_PER_PAGE: 10,
  /** Số trang tối đa mỗi phái */
  MAX_PAGES_PER_FACTION: 5,
  /** Button IDs cho pagination */
  PREV_PAGE: 'page_prev',
  NEXT_PAGE: 'page_next',
  PAGE_PREFIX: 'page_goto_',
};
