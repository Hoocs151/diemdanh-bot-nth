/**
 * Session Repository - Quản lý CRUD cho phiên điểm danh
 */

import { v4 as uuidv4 } from 'uuid';
import { query, run, transaction } from '../database.js';
import { logger } from '../../utils/logger.js';

/**
 * Tạo phiên điểm danh mới
 */
export function createSession(data) {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO sessions (
      id, name, description, start_time, end_time, notify_channel_id,
      guild_id, guild_name, channel_id, message_id, status,
      created_by_id, created_by_name, max_per_faction, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.description || null,
      data.startTime,
      data.endTime,
      data.notifyChannelId || null,
      data.guildId,
      data.guildName,
      data.channelId,
      data.messageId || null,
      'open',
      data.createdById,
      data.createdByName,
      data.maxPerFaction || 0,
      now,
      now,
    ]
  );

  logger.info('SESSION', `Tạo phiên mới: ${data.name} (${id.slice(0, 8)}) - by ${data.createdByName}`);
  return getSessionById(id);
}

/**
 * Lấy session theo ID
 */
export function getSessionById(id) {
  const rows = query('SELECT * FROM sessions WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * Lấy session theo message ID (Discord message)
 */
export function getSessionByMessageId(messageId) {
  const rows = query('SELECT * FROM sessions WHERE message_id = ?', [messageId]);
  return rows[0] || null;
}

/**
 * Lấy tất cả sessions trong guild
 */
export function getSessionsByGuild(guildId, status = null) {
  let sql = 'SELECT * FROM sessions WHERE guild_id = ?';
  const params = [guildId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';
  return query(sql, params);
}

/**
 * Lấy tất cả sessions đang mở
 */
export function getOpenSessions() {
  return query("SELECT * FROM sessions WHERE status IN ('open','locked') ORDER BY created_at DESC");
}

/**
 * Cập nhật message ID của session
 */
export function updateSessionMessageId(sessionId, messageId) {
  run(
    'UPDATE sessions SET message_id = ?, updated_at = ? WHERE id = ?',
    [messageId, new Date().toISOString(), sessionId]
  );
}

/**
 * Cập nhật trạng thái session (open/locked/closed)
 */
export function updateSessionStatus(sessionId, status, actorId, actorName) {
  const now = new Date().toISOString();
  const updates = ['status = ?', 'updated_at = ?'];
  const params = [status, now];

  if (status === 'locked') {
    updates.push('locked_at = ?', 'locked_by_id = ?', 'locked_by_name = ?');
    params.push(now, actorId, actorName);
  } else if (status === 'open') {
    updates.push('locked_at = ?', 'locked_by_id = ?', 'locked_by_name = ?');
    params.push(null, null, null);
  } else if (status === 'closed') {
    updates.push('closed_at = ?', 'closed_by_id = ?', 'closed_by_name = ?');
    params.push(now, actorId, actorName);
  }

  params.push(sessionId);
  run(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, params);
  logger.info('SESSION', `Cập nhật trạng thái phiên ${sessionId.slice(0, 8)} -> ${status} by ${actorName}`);
}

/**
 * Cập nhật max_per_faction
 */
export function updateSessionMaxPerFaction(sessionId, max) {
  run(
    'UPDATE sessions SET max_per_faction = ?, updated_at = ? WHERE id = ?',
    [max, new Date().toISOString(), sessionId]
  );
}

/**
 * Reset tất cả đăng ký của session (giữ nguyên session, xóa registrations và waitlist)
 * Dùng transaction để đảm bảo atomicity
 */
export function resetSessionRegistrations(sessionId) {
  transaction(() => {
    run('DELETE FROM registrations WHERE session_id = ?', [sessionId]);
    run('DELETE FROM waitlist WHERE session_id = ?', [sessionId]);
    run('UPDATE sessions SET updated_at = ? WHERE id = ?', [new Date().toISOString(), sessionId]);
  });
  logger.info('SESSION', `Đặt lại phiên ${sessionId.slice(0, 8)}`);
}

/**
 * Cập nhật end_time của session (kéo dài thời gian)
 */
export function updateSessionEndTime(sessionId, newEndTime) {
  run(
    'UPDATE sessions SET end_time = ?, updated_at = ? WHERE id = ?',
    [newEndTime, new Date().toISOString(), sessionId]
  );
  logger.info('SESSION', `Cập nhật thời hạn phiên ${sessionId.slice(0, 8)} -> ${newEndTime}`);
}

/**
 * Xóa session và tất cả dữ liệu liên quan (cascade via FK)
 */
export function deleteSession(sessionId) {
  run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  logger.info('SESSION', `Xóa phiên ${sessionId.slice(0, 8)}`);
}

/**
 * Đếm tổng số người đăng ký trong session
 */
export function countRegistrations(sessionId) {
  const rows = query(
    'SELECT COUNT(*) as count FROM registrations WHERE session_id = ?',
    [sessionId]
  );
  return rows[0]?.count ?? 0;
}
