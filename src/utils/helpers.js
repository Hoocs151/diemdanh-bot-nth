/**
 * Helpers - Các hàm tiện ích dùng chung
 */

import { DateTime } from 'luxon';
import { CONFIG } from '../config/index.js';

/**
 * Format thời gian theo timezone Việt Nam, dạng DD/MM/YYYY HH:mm
 */
export function formatDateTime(isoString) {
  if (!isoString) return 'Khong xac dinh';
  return DateTime.fromISO(isoString, { zone: CONFIG.TIMEZONE })
    .toFormat('dd/MM/yyyy HH:mm');
}

/**
 * Format thời gian ngắn gọn HH:mm
 */
export function formatTime(isoString) {
  if (!isoString) return '--:--';
  return DateTime.fromISO(isoString, { zone: CONFIG.TIMEZONE }).toFormat('HH:mm');
}

/**
 * Format thời gian tương đối (ví dụ: "3 phut truoc")
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const dt = DateTime.fromISO(isoString, { zone: CONFIG.TIMEZONE });
  const diff = dt.diffNow(['minutes', 'hours', 'days']);

  if (diff.minutes > -1) return 'vua xong';
  if (diff.hours > -1) return `${Math.ceil(-diff.minutes)} phut truoc`;
  if (diff.days > -1) return `${Math.ceil(-diff.hours)} gio truoc`;
  return dt.toFormat('dd/MM HH:mm');
}

/**
 * Truncate string có dấu 3 chấm
 */
export function truncate(str, maxLen = 1024) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Chunk array thành các sub-arrays
 */
export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Split string thành chunks có max length
 */
export function splitMessage(text, maxLen = 2000) {
  const parts = [];
  let current = '';

  const lines = text.split('\n');
  for (let line of lines) {
    if (current.length + line.length + 1 <= maxLen) {
      current += (current ? '\n' : '') + line;
    } else {
      if (current) parts.push(current);
      if (line.length > maxLen) {
        // Cắt dòng quá dài
        while (line.length > maxLen) {
          parts.push(line.slice(0, maxLen));
          line = line.slice(maxLen);
        }
        current = line;
      } else {
        current = line;
      }
    }
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * Chờ đợi trong N mili giây
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce map - chống spam click cho từng user
 * Tự động dọn dẹp entries cũ để tránh memory leak
 */
export class UserDebouncer {
  constructor(windowMs = 1000, cleanupIntervalMs = 60000) {
    this._window = windowMs;
    this._last = {};
    this._cleanupInterval = cleanupIntervalMs;

    // Cleanup định kỳ để tránh memory leak
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const userId of Object.keys(this._last)) {
        if (now - this._last[userId] > this._window * 10) {
          delete this._last[userId];
        }
      }
    }, this._cleanupInterval);
  }

  try(userId) {
    const now = Date.now();
    const last = this._last[userId] || 0;
    if (now - last < this._window) {
      return false; // Bị chặn
    }
    this._last[userId] = now;
    return true; // Cho phép
  }

  reset(userId) {
    delete this._last[userId];
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }
    this._last = {};
  }
}
