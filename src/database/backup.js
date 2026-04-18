/**
 * Database backup utility
 * Copy database file to backup location with timestamp
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, '../../data/backups');

export function backupDatabase() {
  try {
    if (!existsSync(CONFIG.DB_PATH)) {
      logger.warn('BACKUP', 'Database file not found, bỏ qua backup');
      return;
    }

    mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `botdiemdanh-${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, backupName);

    copyFileSync(CONFIG.DB_PATH, backupPath);

    logger.info('BACKUP', `Đã tạo backup: ${backupName}`);

    // Clean old backups (keep last 10)
    cleanOldBackups(10);

    return backupPath;
  } catch (err) {
    logger.error('BACKUP', `Backup thất bại: ${err.message}`);
    throw err;
  }
}

function cleanOldBackups(keepCount) {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: join(BACKUP_DIR, f),
        mtime: statSync(join(BACKUP_DIR, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (let i = keepCount; i < files.length; i++) {
      unlinkSync(files[i].path);
      logger.debug('BACKUP', `Đã xóa backup cũ: ${files[i].name}`);
    }
  } catch {
    // ignore
  }
}

// Auto backup if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backupDatabase();
}
