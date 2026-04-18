/**
 * Hệ thống Logger tập trung cho Bot Điểm Danh Bang Chiến
 * Hỗ trợ: console (có màu) + file, timezone Asia/Ho_Chi_Minh, phân cấp log
 *
 * Format console: [TIME] [LEVEL] [MODULE] message
 * Format file:     [TIME] [LEVEL] [MODULE] message
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '../../logs');
const LOG_FILE = join(LOG_DIR, `bot-${new Date().toISOString().slice(0, 10)}.log`);

const LEVELS = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

const LEVEL_COLORS = {
  debug: '\x1b[90m',  // xám
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // vàng
  error: '\x1b[31m',  // đỏ
};

const RESET = '\x1b[0m';

/** Lazy getter để tránh circular dependency */
let _cachedLogLevel = null;
function getLogLevel() {
  if (_cachedLogLevel === null) {
    _cachedLogLevel = LEVELS[CONFIG?.LOG_LEVEL] ?? LEVELS.info;
  }
  return _cachedLogLevel;
}

function ensureLogDir() {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function formatTime(tz = 'Asia/Ho_Chi_Minh') {
  const now = new Date();
  const f = new Intl.DateTimeFormat('vi-VN', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  return f.format(now).replace(/\//g, '-');
}

function formatMessage(level, module, message, data, forFile) {
  const ts = formatTime();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';

  if (forFile) {
    return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`;
  }

  const color = LEVEL_COLORS[level] ?? '';
  const levelPadded = level.toUpperCase().padEnd(5, ' ');
  return `${color}[${ts}] [${levelPadded}] [${module}] ${message}${dataStr}${RESET}`;
}

function writeLog(level, module, message, data) {
  const currentLevel = getLogLevel();
  if (LEVELS[level] < currentLevel) return;

  const fileMsg = formatMessage(level, module, message, data, true);
  const consoleMsg = formatMessage(level, module, message, data, false);

  if (level === 'error') {
    console.error(consoleMsg);
  } else if (level === 'warn') {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  ensureLogDir();
  try {
    appendFileSync(LOG_FILE, fileMsg + '\n', 'utf8');
  } catch {
    // ignore file write errors
  }
}

export const logger = {
  debug(module, message, data) {
    writeLog('debug', module, message, data);
  },
  info(module, message, data) {
    writeLog('info', module, message, data);
  },
  warn(module, message, data) {
    writeLog('warn', module, message, data);
  },
  error(module, message, data) {
    writeLog('error', module, message, data);
  },
};

/**
 * Wrapper cho async handlers - tự động bắt lỗi và log
 */
export function withErrorHandler(handler, module) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      logger.error(module, `Unhandled error in ${handler.name}: ${err.message}`, {
        stack: err.stack,
        args: args.map((a) => (a?.user ? { id: a.user.id, tag: a.user.tag } : String(a))),
      });
    }
  };
}
