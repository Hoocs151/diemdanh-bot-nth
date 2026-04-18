/**
 * Permission Middleware - Kiểm tra quyền người dùng trước khi thực hiện lệnh
 * Phân quyền 3 cấp: ADMIN > OFFICER > MEMBER
 */

import { CONFIG } from '../config/index.js';
import { MessageFlags } from 'discord.js';

/**
 * Cấp quyền
 */
export const PermissionLevel = {
  MEMBER: 0,
  OFFICER: 1,
  ADMIN: 2,
};

/**
 * Lấy cấp quyền của người dùng từ interaction
 * @param {import('discord.js').BaseInteraction} interaction
 * @returns {number} PermissionLevel
 */
export function getPermissionLevel(interaction) {
  // 1. Bot Owner (quyền cao nhất)
  if (CONFIG.BOT_OWNER_ID && interaction.user.id === CONFIG.BOT_OWNER_ID) {
    return PermissionLevel.ADMIN;
  }

  if (!interaction.member) return PermissionLevel.MEMBER;

  const roleIds = interaction.member.roles?.cache?.map((r) => r.id) || [];

  // 2. Admin
  for (const roleId of CONFIG.ADMIN_ROLE_IDS) {
    if (roleIds.includes(roleId)) return PermissionLevel.ADMIN;
  }

  // 3. Officer
  for (const roleId of CONFIG.OFFICER_ROLE_IDS) {
    if (roleIds.includes(roleId)) return PermissionLevel.OFFICER;
  }

  return PermissionLevel.MEMBER;
}

/**
 * Lấy tên cấp quyền
 */
export function getPermissionLevelName(level) {
  switch (level) {
    case PermissionLevel.ADMIN:
      return 'Admin';
    case PermissionLevel.OFFICER:
      return 'Officer';
    default:
      return 'Member';
  }
}

/**
 * Kiểm tra người dùng có quyền admin hoặc officer trở lên
 */
export function hasAdminRole(interaction) {
  return getPermissionLevel(interaction) >= PermissionLevel.OFFICER;
}

/**
 * Kiểm tra người dùng có quyền admin
 */
export function isAdmin(interaction) {
  return getPermissionLevel(interaction) >= PermissionLevel.ADMIN;
}

/**
 * Kiểm tra quyền officer
 */
export function isOfficer(interaction) {
  return getPermissionLevel(interaction) >= PermissionLevel.OFFICER;
}

/**
 * Kiểm tra và gửi response nếu không đủ quyền
 * @param {import('discord.js').ChatInputCommandInteraction|import('discord.js').ButtonInteraction} interaction
 * @param {number} requiredLevel - Cấp quyền yêu cầu
 * @returns {boolean} true nếu đủ quyền
 */
export function checkPermission(interaction, requiredLevel = PermissionLevel.OFFICER) {
  const currentLevel = getPermissionLevel(interaction);

  if (currentLevel < requiredLevel) {
    const currentName = getPermissionLevelName(currentLevel);
    const requiredName = getPermissionLevelName(requiredLevel);
    interaction.reply({
      content: `❌ **Không đủ quyền.** Bạn có quyền: **${currentName}**. Cần ít nhất: **${requiredName}**.`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return false;
  }
  return true;
}

/**
 * Check nhanh - trả về true/false, không reply
 */
export function hasRole(interaction, roleIds) {
  if (!interaction.member) return false;
  const userRoleIds = interaction.member.roles?.cache?.map((r) => r.id) || [];
  return roleIds.some((id) => userRoleIds.includes(id));
}

/**
 * Lấy display name đẹp của user
 */
export function getDisplayName(member) {
  if (!member) return 'Unknown';
  return member.nickname || member.user?.displayName || member.user?.username || 'Unknown';
}

/**
 * Kiểm tra quyền và gửi response phù hợp (legacy, giữ tương thích ngược)
 */
export function checkAdminPermission(interaction) {
  return checkPermission(interaction, PermissionLevel.OFFICER);
}
