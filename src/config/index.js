/**
 * Cấu hình toàn cục cho bot
 * Đọc từ process.env với validation nghiêm ngặt
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load .env file
dotenv.config();

/** Schema định nghĩa các biến môi trường */
const ENV_SCHEMA = {
  // --- Discord (bắt buộc) ---
  DISCORD_BOT_TOKEN: {
    required: true,
    type: 'string',
    description: 'Token bot Discord từ Discord Developer Portal',
  },
  BOT_OWNER_ID: {
    required: false,
    type: 'string',
    default: '',
    description: 'ID người sở hữu bot - tự động có full quyền',
  },

  // --- Phân quyền ---
  ADMIN_ROLE_IDS: {
    required: false,
    type: 'string',
    default: '',
    description: 'Danh sách role ID có quyền admin (phân cách bằng dấu phẩy)',
  },
  OFFICER_ROLE_IDS: {
    required: false,
    type: 'string',
    default: '',
    description: 'Danh sách role ID có quyền officer (phân cách bằng dấu phẩy)',
  },

  // --- Database ---
  DB_PATH: {
    required: false,
    type: 'string',
    default: './data/botdiemdanh.db',
    description: 'Đường dẫn file SQLite database',
  },

  // --- Logging ---
  LOG_LEVEL: {
    required: false,
    type: 'enum',
    default: 'info',
    enum: ['debug', 'info', 'warn', 'error'],
    description: 'Mức log: debug | info | warn | error',
  },
  TIMEZONE: {
    required: false,
    type: 'string',
    default: 'Asia/Ho_Chi_Minh',
    description: 'Timezone cho múi giờ',
  },

  // --- Hành vi bot ---
  EPHEMERAL_SECONDS: {
    required: false,
    type: 'number',
    default: 5,
    min: 1,
    max: 300,
    description: 'Số giây trước khi ephemeral message bị xóa',
  },
  MAX_PER_FACTION: {
    required: false,
    type: 'number',
    default: 0,
    min: 0,
    max: 9999,
    description: 'Số người tối đa mỗi phái (0 = không giới hạn)',
  },
  DEBOUNCE_MS: {
    required: false,
    type: 'number',
    default: 1000,
    min: 100,
    max: 60000,
    description: 'Khoảng thời gian chống spam click (ms)',
  },

  // --- Notification ---
  DEFAULT_NOTIFY_CHANNEL_ID: {
    required: false,
    type: 'string',
    default: '',
    description: 'Kênh thông báo mặc định',
  },

  // --- Backup ---
  AUTO_BACKUP_ENABLED: {
    required: false,
    type: 'boolean',
    default: false,
    description: 'Bật/tắt backup tự động',
  },
  BACKUP_CRON_SCHEDULE: {
    required: false,
    type: 'string',
    default: '0 3 * * *',
    description: 'Cron schedule cho backup (mặc định 3h sáng hàng ngày)',
  },
  BACKUP_RETENTION_COUNT: {
    required: false,
    type: 'number',
    default: 7,
    min: 1,
    max: 100,
    description: 'Số bản backup giữ lại',
  },
  BACKUP_DIR: {
    required: false,
    type: 'string',
    default: './backups',
    description: 'Thư mục lưu backup',
  },

  // --- Rate limit slash commands ---
  SLASH_RATE_LIMIT_COUNT: {
    required: false,
    type: 'number',
    default: 5,
    min: 1,
    max: 50,
    description: 'Số lệnh tối đa mỗi user trong cửa sổ thời gian',
  },
  SLASH_RATE_LIMIT_WINDOW_MS: {
    required: false,
    type: 'number',
    default: 30000,
    min: 5000,
    max: 300000,
    description: 'Cửa sổ thời gian rate limit (ms)',
  },

  // --- Google Sheets ---
  GOOGLE_APPLICATION_CREDENTIALS: {
    required: false,
    type: 'string',
    default: '',
    description: 'Đường dẫn file credentials.json từ Google Cloud',
  },
  GOOGLE_SHEET_ID: {
    required: false,
    type: 'string',
    default: '',
    description: 'ID của Google Sheet (từ URL)',
  },
  GOOGLE_SHEET_NAME: {
    required: false,
    type: 'string',
    default: 'Sheet1',
    description: 'Tên sheet để xuất dữ liệu',
  },
};

/**
 * Parse giá trị theo type định nghĩa trong schema
 */
function parseValue(key, rawValue, schema) {
  const { type, default: defaultVal, enum: enumVals } = schema;

  // Boolean: chấp nhận true/false/1/0/'true'/'false'
  if (type === 'boolean') {
    if (rawValue === undefined) return defaultVal;
    return rawValue === true || rawValue === 'true' || rawValue === '1';
  }

  // Number
  if (type === 'number') {
    if (rawValue === undefined || rawValue === '') return defaultVal;
    const num = Number(rawValue);
    if (isNaN(num)) {
      throw new Error(`${key} phải là số, nhận được: "${rawValue}"`);
    }
    return num;
  }

  // Enum
  if (type === 'enum') {
    if (rawValue === undefined || rawValue === '') return defaultVal;
    if (!enumVals.includes(rawValue)) {
      throw new Error(`${key} phải là một trong: ${enumVals.join(' | ')}, nhận được: "${rawValue}"`);
    }
    return rawValue;
  }

  // String hoặc default
  if (rawValue === undefined || rawValue === '') return defaultVal;
  return String(rawValue).trim();
}

/**
 * Parse danh sách role ID (phân cách bằng dấu phẩy)
 */
function parseRoleIds(value) {
  if (!value) return [];
  return value.split(',').map((id) => id.trim()).filter(Boolean);
}

// ============================================
// BUILD CONFIG OBJECT
// ============================================
export const CONFIG = {};

for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
  try {
    const rawValue = process.env[key];
    CONFIG[key] = parseValue(key, rawValue, schema);

    // Validation min/max cho number
    if (schema.type === 'number' && schema.min !== undefined) {
      if (CONFIG[key] < schema.min) {
        CONFIG[key] = schema.min;
        logger.warn('CONFIG', `${key} nhỏ hơn min (${schema.min}), đã đặt về min`);
      }
    }
    if (schema.type === 'number' && schema.max !== undefined) {
      if (CONFIG[key] > schema.max) {
        CONFIG[key] = schema.max;
        logger.warn('CONFIG', `${key} lớn hơn max (${schema.max}), đã đặt về max`);
      }
    }
  } catch (err) {
    throw new Error(`Lỗi parse ${key}: ${err.message}`);
  }
}

// ---- Aliases thuận tiện ----
export const {
  DISCORD_BOT_TOKEN,
  BOT_OWNER_ID,
  DB_PATH,
  LOG_LEVEL,
  TIMEZONE,
  EPHEMERAL_SECONDS,
  MAX_PER_FACTION,
  DEBOUNCE_MS,
  DEFAULT_NOTIFY_CHANNEL_ID,
  ADMIN_ROLE_IDS,
  OFFICER_ROLE_IDS,
  AUTO_BACKUP_ENABLED,
  BACKUP_CRON_SCHEDULE,
  BACKUP_RETENTION_COUNT,
  BACKUP_DIR,
  SLASH_RATE_LIMIT_COUNT,
  SLASH_RATE_LIMIT_WINDOW_MS,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SHEET_ID,
  GOOGLE_SHEET_NAME,
} = CONFIG;

// ---- Parse role IDs ----
CONFIG.ADMIN_ROLE_IDS = parseRoleIds(process.env.ADMIN_ROLE_IDS);
CONFIG.OFFICER_ROLE_IDS = parseRoleIds(process.env.OFFICER_ROLE_IDS);

/**
 * Kiểm tra config bắt buộc khi khởi động
 * @throws {Error} Nếu có lỗi config
 */
export function validateConfig() {
  const errors = [];

  if (!DISCORD_BOT_TOKEN || DISCORD_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    errors.push('DISCORD_BOT_TOKEN chưa được cấu hình trong .env');
  }

  if (!BOT_OWNER_ID) {
    errors.push('BOT_OWNER_ID chưa được cấu hình (nên có để đảm bảo có người quản lý bot)');
  }

  if (ADMIN_ROLE_IDS.length === 0 && OFFICER_ROLE_IDS.length === 0 && !BOT_OWNER_ID) {
    errors.push('Cần ít nhất 1 trong 3: BOT_OWNER_ID, ADMIN_ROLE_IDS, hoặc OFFICER_ROLE_IDS');
  }

  if (AUTO_BACKUP_ENABLED) {
    if (!BACKUP_DIR) {
      errors.push('AUTO_BACKUP_ENABLED=true nhưng BACKUP_DIR chưa được cấu hình');
    }
    if (!BACKUP_CRON_SCHEDULE) {
      errors.push('AUTO_BACKUP_ENABLED=true nhưng BACKUP_CRON_SCHEDULE chưa được cấu hình');
    }
  }

  if (errors.length > 0) {
    const msg = [
      '\n========================================',
      '  LỖI CẤU HÌNH MÔI TRƯỜNG',
      '========================================',
      ...errors.map((e) => '  - ' + e),
      '',
      'Vui lòng tạo file .env từ .env.example và điền thông tin chính xác.',
      '========================================\n',
    ].join('\n');
    throw new Error(msg);
  }

  return true;
}

/**
 * In ra cấu hình hiện tại (đã che token)
 * Chỉ gọi khi LOG_LEVEL = debug
 */
export function debugConfig() {
  const safe = { ...CONFIG };
  if (safe.DISCORD_BOT_TOKEN) {
    safe.DISCORD_BOT_TOKEN = safe.DISCORD_BOT_TOKEN.slice(0, 8) + '...' + safe.DISCORD_BOT_TOKEN.slice(-4);
  }
  logger.debug('CONFIG', 'Cấu hình hiện tại', safe);
}
