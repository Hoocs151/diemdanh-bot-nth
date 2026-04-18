/**
 * Backup Service - Sao lưu database tự động và thủ công
 * Hỗ trợ: SQLite copy, backup retention, scheduling
 * Đảm bảo data an toàn bằng WAL checkpoint
 */

import { mkdirSync, cpSync, readdirSync, unlinkSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../config/index.js';
import { closeDatabase, getDb } from '../database/database.js';
import { logger } from '../utils/logger.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');

/**
 * Lấy thư mục backup, tạo nếu chưa có
 */
function getBackupDir() {
  const dir = join(PROJECT_ROOT, CONFIG.BACKUP_DIR);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}

/**
 * Lấy đường dẫn file backup theo timestamp
 */
function getBackupPath(timestamp = new Date()) {
  const dir = getBackupDir();
  const ts = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return join(dir, `botdiemdanh-${ts}.db`);
}

/**
 * WAL Checkpoint - Ghi tất cả WAL data vào main DB file
 * QUERY_ONLY: không khóa ghi, chỉ đảm bảo data an toàn
 */
function checkpointDatabase() {
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');
    logger.debug('BACKUP', 'WAL checkpoint hoàn tất');
  } catch (err) {
    logger.warn('BACKUP', `WAL checkpoint thất bại: ${err.message}`);
  }
}

/**
 * Tạo backup database
 * @returns {{ path: string, size: number, timestamp: string, sessionCount: number, registrationCount: number }}
 */
export function createBackup() {
  const dbPath = join(PROJECT_ROOT, CONFIG.DB_PATH);
  const backupPath = getBackupPath();

  if (!existsSync(dbPath)) {
    throw new Error(`Database không tồn tại: ${dbPath}`);
  }

  // QUAN TRỌNG: Flush WAL checkpoint TRƯỚC KHI backup
  // Đảm bảo tất cả pending writes được ghi vào main DB file
  checkpointDatabase();

  // Copy file SQLite (sau checkpoint, WAL đã gần như empty)
  cpSync(dbPath, backupPath);

  // Copy SHM file nếu có
  const shmPath = dbPath + '-shm';
  if (existsSync(shmPath)) {
    cpSync(shmPath, backupPath + '-shm');
  }

  // WAL file có thể bị truncate bởi checkpoint, nên copy nếu còn
  const walPath = dbPath + '-wal';
  if (existsSync(walPath) && statSync(walPath).size > 0) {
    cpSync(walPath, backupPath + '-wal');
  }

  // Lấy kích thước
  const size = statSync(backupPath).size;

  // Lấy stats để log
  let sessionCount = 0;
  let registrationCount = 0;
  try {
    const db = getDb();
    sessionCount = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
    registrationCount = db.prepare('SELECT COUNT(*) as c FROM registrations').get().c;
  } catch {
    // ignore
  }

  logger.info('BACKUP', `Đã tạo backup: ${basename(backupPath)} (${formatBytes(size)}) - ${sessionCount} phiên, ${registrationCount} đăng ký`);

  // Cleanup cũ
  cleanupOldBackups();

  return {
    path: backupPath,
    size,
    timestamp: new Date().toISOString(),
    sessionCount,
    registrationCount,
  };
}

/**
 * Dọn dẹp các backup cũ, giữ lại BACKUP_RETENTION_COUNT bản mới nhất
 */
export function cleanupOldBackups() {
  const dir = getBackupDir();
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('botdiemdanh-') && f.endsWith('.db'))
    .map((f) => ({
      name: f,
      path: join(dir, f),
      time: new Date(f.replace('botdiemdanh-', '').replace(/-/g, ' ').slice(0, 19).replace(' ', 'T') + 'Z').getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  const toDelete = files.slice(CONFIG.BACKUP_RETENTION_COUNT);
  for (const file of toDelete) {
    try {
      unlinkSync(file.path);
      // Xóa WAL/SHM nếu có
      const wal = file.path + '-wal';
      const shm = file.path + '-shm';
      if (existsSync(wal)) unlinkSync(wal);
      if (existsSync(shm)) unlinkSync(shm);
      logger.info('BACKUP', `Đã xóa backup cũ: ${file.name}`);
    } catch {
      // ignore
    }
  }

  return { deleted: toDelete.length, remaining: files.length - toDelete.length };
}

/**
 * Liệt kê các backup có sẵn
 */
export function listBackups() {
  const dir = getBackupDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.startsWith('botdiemdanh-') && f.endsWith('.db'))
    .map((f) => {
      const path = join(dir, f);
      const stat = statSync(path);
      return {
        name: f,
        path,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Khôi phục từ backup
 * @param {string} backupPath - Đường dẫn file backup
 */
export function restoreBackup(backupPath) {
  const dbPath = join(PROJECT_ROOT, CONFIG.DB_PATH);

  if (!existsSync(backupPath)) {
    throw new Error(`Backup không tồn tại: ${backupPath}`);
  }

  // Đóng database hiện tại
  closeDatabase();

  // Copy backup vào vị trí database
  cpSync(backupPath, dbPath, { overwrite: true });

  // Copy WAL/SHM nếu có
  const walBackup = backupPath + '-wal';
  const shmBackup = backupPath + '-shm';
  if (existsSync(walBackup)) cpSync(walBackup, dbPath + '-wal', { overwrite: true });
  if (existsSync(shmBackup)) cpSync(shmBackup, dbPath + '-shm', { overwrite: true });

  logger.info('BACKUP', `Đã khôi phục từ: ${basename(backupPath)}`);
}

/**
 * Format bytes thành string dễ đọc
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Chạy backup thủ công (gọi từ lệnh)
 */
export async function manualBackup() {
  try {
    const result = createBackup();
    return {
      success: true,
      path: result.path,
      size: result.size,
      formattedSize: formatBytes(result.size),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
