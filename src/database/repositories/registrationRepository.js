/**
 * Registration Repository - Quản lý đăng ký của thành viên
 */

import { run, query, transaction } from '../database.js';
import { logger } from '../../utils/logger.js';
import { logRegister, logUnregister, logSwitch, logForceRegister, logWaitlistJoin, logWaitlistLeave, logWaitlistPromote } from './auditLogRepository.js';

/**
 * Đăng ký user vào một phái
 * @returns {object} { action: 'registered' | 'unregistered' | 'switched', faction_from, faction_to }
 */
export function registerUser(sessionId, userId, userName, factionId) {
  return transaction(() => {
    const existing = getRegistration(sessionId, userId);

    if (existing) {
      if (existing.faction_id === factionId) {
        // Click đúng phái đang chọn => hủy đăng ký
        unregisterUser(sessionId, userId);
        return { action: 'unregistered', faction_from: existing.faction_id, faction_to: null };
      } else {
        // Click phái khác => chuyển phái
        run(
          `UPDATE registrations
           SET faction_id = ?, user_name = ?, updated_at = ?
           WHERE session_id = ? AND user_id = ?`,
          [factionId, userName, new Date().toISOString(), sessionId, userId]
        );

        logSwitch(sessionId, userId, userName, existing.faction_id, factionId);

        logger.info('REGISTER', `${userName} chuyển phái ${existing.faction_id} -> ${factionId}`);

        return {
          action: 'switched',
          faction_from: existing.faction_id,
          faction_to: factionId,
        };
      }
    } else {
      // Chưa đăng ký => đăng ký mới
      run(
        `INSERT INTO registrations (session_id, user_id, user_name, faction_id, registered_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, userId, userName, factionId, new Date().toISOString(), new Date().toISOString()]
      );

      logRegister(sessionId, userId, userName, factionId);

      logger.info('REGISTER', `${userName} đăng ký phái ${factionId}`);

      return { action: 'registered', faction_from: null, faction_to: factionId };
    }
  });
}

/**
 * Hủy đăng ký của user
 */
export function unregisterUser(sessionId, userId, actorId = null, actorName = 'System') {
  const reg = getRegistration(sessionId, userId);
  if (!reg) return null;

  run('DELETE FROM registrations WHERE session_id = ? AND user_id = ?', [sessionId, userId]);

  if (actorId) {
    logUnregister(sessionId, userId, reg.user_name, reg.faction_id, actorId, actorName);
  }

  logger.info('REGISTER', `${reg.user_name} hủy đăng ký phái ${reg.faction_id}`);
  return reg;
}

/**
 * Lấy đăng ký của một user trong session
 */
export function getRegistration(sessionId, userId) {
  const rows = query(
    'SELECT * FROM registrations WHERE session_id = ? AND user_id = ?',
    [sessionId, userId]
  );
  return rows[0] || null;
}

/**
 * Lấy tất cả đăng ký theo session, nhóm theo phái
 * @returns {object} { factionId: [ { user_id, user_name, registered_at }, ... ] }
 */
export function getRegistrationsBySession(sessionId) {
  const rows = query(
    'SELECT * FROM registrations WHERE session_id = ? ORDER BY registered_at ASC',
    [sessionId]
  );

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.faction_id]) {
      grouped[row.faction_id] = [];
    }
    grouped[row.faction_id].push({
      userId: row.user_id,
      userName: row.user_name,
      registeredAt: row.registered_at,
    });
  }

  return grouped;
}

/**
 * Lấy tất cả đăng ký theo session, trả về mảng phẳng
 */
export function getAllRegistrations(sessionId) {
  return query(
    'SELECT * FROM registrations WHERE session_id = ? ORDER BY faction_id, registered_at',
    [sessionId]
  );
}

/**
 * Đếm số người trong mỗi phái
 */
export function countByFaction(sessionId) {
  const rows = query(
    `SELECT faction_id, COUNT(*) as count
     FROM registrations WHERE session_id = ?
     GROUP BY faction_id`,
    [sessionId]
  );

  const counts = {};
  for (const row of rows) {
    counts[row.faction_id] = row.count;
  }
  return counts;
}

/**
 * Đếm số người trong một phái cụ thể
 */
export function countFactionMembers(sessionId, factionId) {
  const rows = query(
    'SELECT COUNT(*) as count FROM registrations WHERE session_id = ? AND faction_id = ?',
    [sessionId, factionId]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Kiểm tra user có đang đăng ký ở phái nào không
 */
export function isUserRegistered(sessionId, userId) {
  const rows = query(
    'SELECT 1 FROM registrations WHERE session_id = ? AND user_id = ?',
    [sessionId, userId]
  );
  return rows.length > 0;
}

/**
 * Lấy tổng số đăng ký trong session
 */
export function getTotalRegistrations(sessionId) {
  const rows = query(
    'SELECT COUNT(*) as count FROM registrations WHERE session_id = ?',
    [sessionId]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Xóa tất cả đăng ký của một session
 */
export function deleteAllRegistrations(sessionId) {
  run('DELETE FROM registrations WHERE session_id = ?', [sessionId]);
}

/**
 * Admin: thêm/sửa user thủ công vào phái
 */
export function forceRegister(sessionId, userId, userName, factionId, actorId, actorName) {
  const existing = getRegistration(sessionId, userId);
  const now = new Date().toISOString();

  if (existing) {
    run(
      `UPDATE registrations SET faction_id = ?, user_name = ?, updated_at = ?
       WHERE session_id = ? AND user_id = ?`,
      [factionId, userName, now, sessionId, userId]
    );
  } else {
    run(
      `INSERT INTO registrations (session_id, user_id, user_name, faction_id, registered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, userName, factionId, now, now]
    );
  }

  logForceRegister(sessionId, userId, userName, existing?.faction_id, factionId, actorId, actorName);
  logger.info('REGISTER', `${actorName} ép ${userName} vào phái ${factionId}`);
}

// ================================
// WAITLIST FUNCTIONS
// ================================

/**
 * Thêm user vào danh sách chờ của một phái
 */
export function addToWaitlist(sessionId, userId, userName, factionId) {
  const now = new Date().toISOString();

  // Đếm số người hiện có trong waitlist của phái đó
  const rows = query(
    'SELECT MAX(position) as maxPos FROM waitlist WHERE session_id = ? AND faction_id = ?',
    [sessionId, factionId]
  );
  const nextPosition = (rows[0]?.maxPos ?? 0) + 1;

  run(
    `INSERT INTO waitlist (session_id, user_id, user_name, faction_id, position, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, userName, factionId, nextPosition, now]
  );

  logWaitlistJoin(sessionId, userId, userName, factionId, nextPosition);
  logger.info('WAITLIST', `${userName} vào danh sách chờ phái ${factionId} (vị trí #${nextPosition})`);
  return { position: nextPosition };
}

/**
 * Lấy danh sách chờ của một phái
 */
export function getWaitlistByFaction(sessionId, factionId) {
  const rows = query(
    'SELECT * FROM waitlist WHERE session_id = ? AND faction_id = ? ORDER BY position ASC',
    [sessionId, factionId]
  );

  return rows.map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    factionId: row.faction_id,
    position: row.position,
    joinedAt: row.joined_at,
  }));
}

/**
 * Lấy tất cả danh sách chờ của một session
 */
export function getAllWaitlists(sessionId) {
  const rows = query(
    'SELECT * FROM waitlist WHERE session_id = ? ORDER BY faction_id, position ASC',
    [sessionId]
  );

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.faction_id]) {
      grouped[row.faction_id] = [];
    }
    grouped[row.faction_id].push({
      userId: row.user_id,
      userName: row.user_name,
      position: row.position,
      joinedAt: row.joined_at,
    });
  }
  return grouped;
}

/**
 * Kiểm tra user có trong waitlist không
 */
export function getWaitlistEntry(sessionId, userId) {
  const rows = query(
    'SELECT * FROM waitlist WHERE session_id = ? AND user_id = ?',
    [sessionId, userId]
  );
  return rows[0] || null;
}

/**
 * Xóa user khỏi waitlist
 */
export function removeFromWaitlist(sessionId, userId, actorId = null, actorName = 'System') {
  const entry = getWaitlistEntry(sessionId, userId);
  if (!entry) return null;

  run('DELETE FROM waitlist WHERE session_id = ? AND user_id = ?', [sessionId, userId]);
  logWaitlistLeave(sessionId, userId, entry.user_name, entry.faction_id, actorId || userId, actorName);
  return entry;
}

/**
 * Lấy người đầu tiên trong waitlist của một phái và xóa họ khỏi waitlist
 * Trả về thông tin user hoặc null nếu không có ai
 */
export function popFromWaitlist(sessionId, factionId) {
  const entry = query(
    'SELECT * FROM waitlist WHERE session_id = ? AND faction_id = ? ORDER BY position ASC LIMIT 1',
    [sessionId, factionId]
  )[0];

  if (!entry) return null;

  // Xóa khỏi waitlist
  removeFromWaitlist(sessionId, entry.user_id, 'SYSTEM', 'Auto-promote');

  logWaitlistPromote(sessionId, entry.user_id, entry.user_name, entry.faction_id);

  return {
    userId: entry.user_id,
    userName: entry.user_name,
    factionId: entry.faction_id,
    position: entry.position,
  };
}

/**
 * Xóa tất cả waitlist của một session
 */
export function clearWaitlist(sessionId) {
  run('DELETE FROM waitlist WHERE session_id = ?', [sessionId]);
}
