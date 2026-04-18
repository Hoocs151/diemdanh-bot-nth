/**
 * Audit Log Repository - Ghi lại mọi thao tác để audit
 */

import { run, query } from '../database.js';

/**
 * Ghi log đăng ký mới
 */
export function logRegister(sessionId, userId, userName, factionId) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, 'register', userId, userName, userId, userName, factionId, new Date().toISOString()]
  );
}

/**
 * Ghi log hủy đăng ký
 */
export function logUnregister(sessionId, userId, userName, factionId, actorId, actorName) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, 'unregister', actorId, actorName, userId, userName, factionId, new Date().toISOString()]
  );
}

/**
 * Ghi log chuyển phái
 */
export function logSwitch(sessionId, userId, userName, factionFrom, factionTo) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_from, faction_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, 'switch', userId, userName, userId, userName, factionFrom, factionTo, new Date().toISOString()]
  );
}

/**
 * Ghi log khóa/mở phiên
 */
export function logLock(sessionId, actorId, actorName, locked) {
  run(
    `INSERT INTO audit_log (session_id, action, actor_id, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, locked ? 'lock' : 'unlock', actorId, actorName, new Date().toISOString()]
  );
}

/**
 * Ghi log reset phiên
 */
export function logReset(sessionId, actorId, actorName) {
  run(
    `INSERT INTO audit_log (session_id, action, actor_id, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, 'reset', actorId, actorName, new Date().toISOString()]
  );
}

/**
 * Ghi log đóng/chốt phiên
 */
export function logClose(sessionId, actorId, actorName) {
  run(
    `INSERT INTO audit_log (session_id, action, actor_id, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, 'close', actorId, actorName, new Date().toISOString()]
  );
}

/**
 * Ghi log xuất danh sách
 */
export function logExport(sessionId, actorId, actorName, exportType) {
  run(
    `INSERT INTO audit_log (session_id, action, actor_id, actor_name, extra_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, 'export', actorId, actorName, JSON.stringify({ type: exportType }), new Date().toISOString()]
  );
}

/**
 * Ghi log xóa phiên
 */
export function logDelete(sessionId, actorId, actorName) {
  run(
    `INSERT INTO audit_log (session_id, action, actor_id, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, 'delete', actorId, actorName, new Date().toISOString()]
  );
}

/**
 * Ghi log ép user vào phái (admin)
 */
export function logForceRegister(sessionId, userId, userName, factionFrom, factionTo, actorId, actorName) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_from, faction_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, 'force_register', actorId, actorName, userId, userName, factionFrom, factionTo, new Date().toISOString()]
  );
}

/**
 * Ghi log user vào waitlist
 */
export function logWaitlistJoin(sessionId, userId, userName, factionId, position) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_to, extra_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId, 'waitlist_join', userId, userName, userId, userName, factionId,
      JSON.stringify({ position }),
      new Date().toISOString(),
    ]
  );
}

/**
 * Ghi log user rời waitlist
 */
export function logWaitlistLeave(sessionId, userId, userName, factionId, actorId, actorName) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, 'waitlist_leave', actorId, actorName, userId, userName, factionId, new Date().toISOString()]
  );
}

/**
 * Ghi log user được promote từ waitlist lên chính thức
 */
export function logWaitlistPromote(sessionId, userId, userName, factionId) {
  run(
    `INSERT INTO audit_log
     (session_id, action, actor_id, actor_name, target_user_id, target_user_name, faction_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, 'waitlist_promote', 'SYSTEM', 'Auto-promote', userId, userName, factionId, new Date().toISOString()]
  );
}

/**
 * Ghi log cập nhật session
 */
export function logUpdate(sessionId, actorId, actorName, changes) {
  run(
    `INSERT INTO audit_log (session_id, action, actor_id, actor_name, extra_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, 'update', actorId, actorName, JSON.stringify(changes), new Date().toISOString()]
  );
}

/**
 * Lấy audit log của một session
 */
export function getAuditLogs(sessionId, limit = 100) {
  return query(
    `SELECT * FROM audit_log WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
    [sessionId, limit]
  );
}

/**
 * Lấy audit log của một user
 */
export function getUserAuditLogs(userId, limit = 50) {
  return query(
    `SELECT * FROM audit_log WHERE target_user_id = ? OR actor_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, userId, limit]
  );
}

/**
 * Đếm số hành động gần đây của user (chống spam)
 */
export function countRecentActions(userId, windowMs = 1000) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = query(
    `SELECT COUNT(*) as count FROM audit_log
     WHERE actor_id = ? AND created_at > ? AND action IN ('register','unregister','switch')`,
    [userId, since]
  );
  return rows[0]?.count ?? 0;
}
