/**
 * Schema database SQLite - Dùng better-sqlite3 để đảm bảo consistency
 *
 * Các bảng:
 * - sessions:     Lưu thông tin phiên điểm danh bang chiến
 * - registrations: Lưu đăng ký của từng user vào từng phái
 * - audit_log:    Log tất cả thao tác để audit
 * - bot_config:   Lưu config metadata (version, last_backup, etc.)
 */

export const SCHEMA = `
-- ================================
-- BANG CHIEN BOT - DATABASE SCHEMA
-- ================================

-- Bảng phiên điểm danh
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  description     TEXT,
  start_time      TEXT        NOT NULL,  -- ISO 8601 timestamp
  end_time        TEXT        NOT NULL,  -- ISO 8601 timestamp
  notify_channel_id TEXT,
  guild_id        TEXT        NOT NULL,
  guild_name      TEXT        NOT NULL,
  channel_id      TEXT        NOT NULL,
  message_id      TEXT,
  status          TEXT        NOT NULL  DEFAULT 'open',  -- open | locked | closed
  created_by_id   TEXT        NOT NULL,
  created_by_name TEXT        NOT NULL,
  max_per_faction INTEGER     NOT NULL  DEFAULT 0,  -- 0 = ko giới hạn
  locked_at       TEXT,  -- timestamp khoá
  locked_by_id    TEXT,
  locked_by_name  TEXT,
  closed_at       TEXT,  -- timestamp đóng
  closed_by_id    TEXT,
  closed_by_name  TEXT,
  created_at      TEXT        NOT NULL,
  updated_at      TEXT        NOT NULL
);

-- Bảng đăng ký của thành viên
CREATE TABLE IF NOT EXISTS registrations (
  id              INTEGER     PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  user_name       TEXT        NOT NULL,
  faction_id      TEXT        NOT NULL,
  registered_at   TEXT        NOT NULL,
  updated_at      TEXT        NOT NULL,
  UNIQUE(session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_registrations_session
  ON registrations(session_id);

CREATE INDEX IF NOT EXISTS idx_registrations_user
  ON registrations(user_id);

CREATE INDEX IF NOT EXISTS idx_registrations_faction
  ON registrations(session_id, faction_id);

-- ================================
-- Bảng danh sách chờ (waitlist)
-- Khi phái đầy, người chơi sẽ vào danh sách chờ
-- ================================
CREATE TABLE IF NOT EXISTS waitlist (
  id              INTEGER     PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  user_name       TEXT        NOT NULL,
  faction_id      TEXT        NOT NULL,
  position        INTEGER     NOT NULL,  -- Thứ tự trong danh sách chờ
  joined_at       TEXT        NOT NULL,  -- Thời gian vào danh sách chờ
  UNIQUE(session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index cho waitlist
CREATE INDEX IF NOT EXISTS idx_waitlist_session
  ON waitlist(session_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_faction
  ON waitlist(session_id, faction_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_position
  ON waitlist(session_id, position);

-- Bảng audit log - ghi lại mọi thao tác
CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER     PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT,
  action          TEXT        NOT NULL,  -- register | unregister | switch | lock | unlock | reset | close | export | delete | update
  actor_id        TEXT        NOT NULL,
  actor_name      TEXT        NOT NULL,
  target_user_id  TEXT,  -- user bị tác động (nếu có)
  target_user_name TEXT,
  faction_from    TEXT,  -- phái cũ (khi chuyển)
  faction_to      TEXT,  -- phái mới (khi đăng ký/chuyển)
  extra_data      TEXT,  -- JSON string cho data phụ
  ip_address      TEXT,
  created_at      TEXT        NOT NULL
);

-- Index cho audit log
CREATE INDEX IF NOT EXISTS idx_audit_session
  ON audit_log(session_id);

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON audit_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_log(action);

CREATE INDEX IF NOT EXISTS idx_audit_time
  ON audit_log(created_at);

-- Bảng cấu hình metadata
CREATE TABLE IF NOT EXISTS bot_config (
  key             TEXT        PRIMARY KEY,
  value           TEXT,
  updated_at      TEXT        NOT NULL
);

-- Insert default config
INSERT OR IGNORE INTO bot_config (key, value, updated_at)
VALUES ('version', '1.0.0', datetime('now'));
`;
