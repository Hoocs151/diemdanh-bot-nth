/**
 * Rate Limiter cho Slash Commands
 * Dùng sliding window algorithm
 */

import { CONFIG } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Sliding Window Rate Limiter
 * Mỗi user có một cửa sổ thời gian, đếm số lần gọi lệnh
 */
export class SlashRateLimiter {
  constructor(count, windowMs) {
    this._count = count;
    this._windowMs = windowMs;
    this._timestamps = new Map(); // userId -> timestamp[]

    // Cleanup định kỳ
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [userId, times] of this._timestamps) {
        // Xóa các timestamp cũ
        const valid = times.filter((t) => now - t < this._windowMs);
        if (valid.length === 0) {
          this._timestamps.delete(userId);
          cleaned++;
        } else if (valid.length < times.length) {
          this._timestamps.set(userId, valid);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger.debug('RATELIMIT', `Đã dọn ${cleaned} bản ghi rate limit`);
      }
    }, this._windowMs);
  }

  /**
   * Thử thực hiện lệnh
   * @param {string} userId
   * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
   */
  try(userId) {
    const now = Date.now();
    const times = this._timestamps.get(userId) || [];

    // Xóa các timestamp cũ
    const validTimes = times.filter((t) => now - t < this._windowMs);
    const remaining = this._count - validTimes.length;

    if (validTimes.length >= this._count) {
      // Đã đạt giới hạn
      const oldest = Math.min(...validTimes);
      const resetIn = oldest + this._windowMs - now;
      logger.debug('RATELIMIT', `Người dùng ${userId} đã đạt rate limit, còn ${Math.ceil(resetIn / 1000)}s`);
      return { allowed: false, remaining: 0, resetIn };
    }

    // Cho phép - thêm timestamp
    validTimes.push(now);
    this._timestamps.set(userId, validTimes);

    return {
      allowed: true,
      remaining: this._count - validTimes.length,
      resetIn: 0,
    };
  }

  /**
   * Reset rate limit cho user
   */
  reset(userId) {
    this._timestamps.delete(userId);
  }

  /**
   * Lấy số lần gọi còn lại của user
   */
  getRemaining(userId) {
    const times = this._timestamps.get(userId) || [];
    const now = Date.now();
    const validTimes = times.filter((t) => now - t < this._windowMs);
    return Math.max(0, this._count - validTimes.length);
  }

  /**
   * Dọn dẹp timer
   */
  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }
    this._timestamps.clear();
  }
}
