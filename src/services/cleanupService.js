/**
 * Cleanup Service - Dọn dẹp người dùng đã rời khỏi guild
 * Chạy khi member leave hoặc khi admin gọi lệnh cleanup
 */

import { query, run, transaction } from '../database/database.js';
import { logger } from '../utils/logger.js';

/**
 * Lấy tất cả user_id đang có trong registrations/waitlist của các phiên đang hoạt động
 * @returns {string[]} Danh sách user_id
 */
export function getRegisteredUserIds() {
  const rows = query(`
    SELECT DISTINCT user_id FROM registrations
    UNION
    SELECT DISTINCT user_id FROM waitlist
  `);
  return rows.map((r) => r.user_id);
}

/**
 * Lọc ra những người dùng đã rời khỏi guild
 * @param {import('discord.js').Guild} guild
 * @param {string[]} userIds
 * @returns {Promise<string[]>} User IDs đã rời guild
 */
export async function filterLeftMembers(guild, userIds) {
  if (!userIds || userIds.length === 0) return [];

  const leftUsers = [];

  // Discord API giới hạn query nhiều user 1 lần (tối đa ~100)
  const CHUNK = 100;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    for (const userId of chunk) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
          leftUsers.push(userId);
        }
      } catch {
        leftUsers.push(userId);
      }
    }
  }

  return leftUsers;
}

/**
 * Xóa người dùng đã rời khỏi registrations và waitlist
 * @param {string[]} userIds
 * @returns {{ removed: number, sessions: object }}
 */
export function removeLeftUsers(userIds) {
  if (!userIds || userIds.length === 0) {
    return { removed: 0, sessions: {} };
  }

  const placeholders = userIds.map(() => '?').join(',');

  // Đếm trước
  const countRows = query(`
    SELECT session_id, COUNT(*) as count
    FROM registrations
    WHERE user_id IN (${placeholders})
    GROUP BY session_id
  `, userIds);

  const waitlistRows = query(`
    SELECT session_id, COUNT(*) as count
    FROM waitlist
    WHERE user_id IN (${placeholders})
    GROUP BY session_id
  `, userIds);

  const sessionCounts = {};
  for (const row of countRows) {
    sessionCounts[row.session_id] = (sessionCounts[row.session_id] || 0) + row.count;
  }
  for (const row of waitlistRows) {
    sessionCounts[row.session_id] = (sessionCounts[row.session_id] || 0) + row.count;
  }

  // Xóa khỏi registrations
  const regResult = run(
    `DELETE FROM registrations WHERE user_id IN (${placeholders})`,
    userIds
  );

  // Xóa khỏi waitlist
  const waitlistResult = run(
    `DELETE FROM waitlist WHERE user_id IN (${placeholders})`,
    userIds
  );

  const totalRemoved = (regResult?.changes || 0) + (waitlistResult?.changes || 0);

  logger.info('CLEANUP', `Đã xóa ${totalRemoved} records của ${userIds.length} người dùng đã rời guild`);

  return {
    removed: totalRemoved,
    usersRemoved: userIds.length,
    sessions: sessionCounts,
  };
}

/**
 * Chạy cleanup đầy đủ cho một guild
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{ removed: number, usersRemoved: number }>}
 */
export async function cleanupGuild(guild) {
  const userIds = getRegisteredUserIds();
  if (userIds.length === 0) {
    return { removed: 0, usersRemoved: 0 };
  }

  const leftUsers = await filterLeftMembers(guild, userIds);
  if (leftUsers.length === 0) {
    logger.info('CLEANUP', 'Không có ai đã rời guild');
    return { removed: 0, usersRemoved: 0 };
  }

  const result = removeLeftUsers(leftUsers);
  return result;
}

/**
 * Lấy thông tin chi tiết về người dùng đã rời (để hiển thị)
 * @param {string[]} userIds
 * @returns {object[]} Thông tin user đã rời
 */
export function getLeftUsersDetails(userIds) {
  if (!userIds || userIds.length === 0) return [];

  const placeholders = userIds.map(() => '?').join(',');

  const rows = query(`
    SELECT user_id, user_name, COUNT(*) as reg_count
    FROM registrations
    WHERE user_id IN (${placeholders})
    GROUP BY user_id, user_name
  `, userIds);

  return rows;
}
