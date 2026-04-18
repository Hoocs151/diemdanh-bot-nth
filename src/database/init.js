/**
 * Database initialization script
 * Run manually to create/reset database
 */

import { initDatabase, closeDatabase } from './database.js';
import { logger } from '../utils/logger.js';

try {
  logger.info('INIT', 'Bắt đầu khởi tạo database...');
  initDatabase();
  logger.info('INIT', 'Database đã sẵn sàng tại: ./data/botdiemdanh.db');
  closeDatabase();
} catch (err) {
  logger.error('INIT', `Lỗi khởi tạo: ${err.message}`);
  process.exit(1);
}
