/**
 * Scheduler Service - Quản lý các job định kỳ
 * - Auto-backup theo cron
 * - Periodic WAL checkpoint để giữ WAL nhỏ và data an toàn
 */

import pkg from 'cron-parser';
const { parseExpression } = pkg;
import { CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getDb } from '../database/database.js';
import { createBackup } from '../services/backupService.js';

let backupTimer = null;
let checkpointTimer = null;

/** Thời gian giữa các checkpoint (mặc định 5 phút) */
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Khởi tạo tất cả scheduler jobs
 * @param {import('discord.js').Client} client
 */
export function initScheduler() {
  // Periodic WAL checkpoint - giữ WAL nhỏ và data an toàn
  initPeriodicCheckpoint();

  // Auto backup
  if (CONFIG.AUTO_BACKUP_ENABLED) {
    initAutoBackup();
  }

  logger.info('SCHEDULER', 'Đã khởi tạo scheduler jobs');
}

/**
 * Periodic WAL Checkpoint - Chạy định kỳ để:
 * 1. Giữ WAL file nhỏ (tránh chiếm disk space)
 * 2. Đảm bảo data được ghi an toàn vào main DB
 */
function initPeriodicCheckpoint() {
  checkpointTimer = setInterval(() => {
    try {
      const db = getDb();
      const result = db.pragma('wal_checkpoint(TRUNCATE)');
      // result = [wal_frames_checkpointed, journal_files_removed, checkpoint_time_ms]
      const frames = result[0]?.wal_frames_checkpointed ?? 0;
      if (frames > 0) {
        logger.debug('SCHEDULER', `Checkpoint định kỳ: ${frames} frames đã ghi`);
      }
    } catch (err) {
      logger.warn('SCHEDULER', `Checkpoint định kỳ thất bại: ${err.message}`);
    }
  }, CHECKPOINT_INTERVAL_MS);
}
function initAutoBackup() {
  if (!CONFIG.BACKUP_CRON_SCHEDULE) {
    logger.warn('SCHEDULER', 'AUTO_BACKUP_ENABLED=true nhưng BACKUP_CRON_SCHEDULE trống');
    return;
  }

  // Parse cron expression (định dạng: "0 3 * * *")
  // Format: second minute hour day month weekday
  const parts = CONFIG.BACKUP_CRON_SCHEDULE.trim().split(/\s+/);
  if (parts.length < 5) {
    logger.warn('SCHEDULER', `BACKUP_CRON_SCHEDULE không hợp lệ: ${CONFIG.BACKUP_CRON_SCHEDULE}`);
    return;
  }

  const [second, minute, hour, day, month] = parts;

  // Tính milliseconds đến lần chạy tiếp theo
  function getNextRun() {
    try {
      const interval = parseExpression(`${minute} ${hour} ${day} ${month} *`);
      const next = interval.next().toDate();
      return next.getTime() - Date.now();
    } catch {
      return 24 * 60 * 60 * 1000; // Thử lại sau 24h nếu lỗi
    }
  }

  function scheduleNextBackup() {
    const delay = getNextRun();
    const nextTime = new Date(Date.now() + delay).toLocaleString('vi-VN');

    logger.info('SCHEDULER', `Backup tiếp theo: ${nextTime} (sau ${Math.round(delay / 1000 / 60)} phút)`);

    backupTimer = setTimeout(async () => {
      try {
        const result = createBackup();
        logger.info('SCHEDULER', `Auto-backup hoàn tất: ${result.path.split(/[/\\]/).pop()}`);
      } catch (err) {
        logger.error('SCHEDULER', `Auto-backup thất bại: ${err.message}`);
      }
      scheduleNextBackup(); // Lên lịch cho lần tiếp theo
    }, delay);
  }

  scheduleNextBackup();
}

/**
 * Dừng tất cả scheduler jobs
 */
export function destroyScheduler() {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
  }
  if (checkpointTimer) {
    clearInterval(checkpointTimer);
    checkpointTimer = null;
  }
  logger.info('SCHEDULER', 'Đã dừng tất cả scheduler jobs');
}
