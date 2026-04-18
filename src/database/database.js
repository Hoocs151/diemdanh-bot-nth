/**
 * Database wrapper - Dùng better-sqlite3 với serialized access
 * Singleton pattern để đảm bảo chỉ có 1 connection xuyên suốt bot lifecycle
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from './schema.js';
import { CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _db = null;

/**
 * Khoi tao ket noi database
 */
export function initDatabase() {
  if (_db) {
    return _db;
  }

  try {
    // Dam bao thu muc data ton tai
    const dbDir = dirname(CONFIG.DB_PATH);
    mkdirSync(dbDir, { recursive: true });

    _db = new Database(CONFIG.DB_PATH, {
      verbose: CONFIG.LOG_LEVEL === 'debug' ? (msg) => logger.debug('DB', msg) : null,
      fileMustExist: false,
    });

    // Bat WAL mode de doc/ghi dong thoi tot hon
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');
    _db.pragma('temp_store = MEMORY');

    // Tao schema
    _db.exec(SCHEMA);

    logger.info('DB', `Khởi tạo thành công: ${CONFIG.DB_PATH}`);
    return _db;
  } catch (err) {
    logger.error('DB', `Lỗi khởi tạo database: ${err.message}`);
    throw err;
  }
}

/**
 * Lay instance database
 */
export function getDb() {
  if (!_db) {
    throw new Error('Database chua duoc khoi tao. Goi initDatabase() truoc.');
  }
  return _db;
}

/**
 * Dong ket noi database
 */
export function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
    logger.info('DB', 'Đã đóng kết nối database');
  }
}

/**
 * Wrapper transaction - tu dong rollback neu loi
 */
export function transaction(fn) {
  const db = getDb();
  const tx = db.transaction(fn);
  try {
    return tx();
  } catch (err) {
    logger.error('DB', `Transaction thất bại, đã rollback: ${err.message}`);
    throw err;
  }
}

/**
 * Chay raw SQL (SELECT)
 */
export function query(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Chay raw SQL (INSERT/UPDATE/DELETE)
 */
export function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}
