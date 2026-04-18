/**
 * Test: Rate Limiter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SlashRateLimiter } from '../src/utils/rateLimiter.js';

describe('SlashRateLimiter', () => {
  let limiter;

  beforeEach(() => {
    // Mỗi user được phép 3 lần trong 2 giây
    limiter = new SlashRateLimiter(3, 2000);
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow first requests', () => {
    const result = limiter.try('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should count requests correctly', () => {
    limiter.try('user1'); // 1/3
    limiter.try('user1'); // 2/3
    const result = limiter.try('user1'); // 3/3
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('should block after limit reached', () => {
    limiter.try('user1');
    limiter.try('user1');
    limiter.try('user1'); // Đã đạt giới hạn

    const result = limiter.try('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it('should track users independently', () => {
    limiter.try('user1');
    limiter.try('user1');
    limiter.try('user1');

    // user1 đã hết, user2 vẫn còn
    const r1 = limiter.try('user1');
    expect(r1.allowed).toBe(false);

    const r2 = limiter.try('user2');
    expect(r2.allowed).toBe(true);
  });

  it('should reset user correctly', () => {
    limiter.try('user1');
    limiter.try('user1');

    limiter.reset('user1');

    const result = limiter.try('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should return correct remaining count', () => {
    expect(limiter.getRemaining('user1')).toBe(3);

    limiter.try('user1');
    expect(limiter.getRemaining('user1')).toBe(2);

    limiter.try('user1');
    expect(limiter.getRemaining('user1')).toBe(1);

    limiter.try('user1');
    expect(limiter.getRemaining('user1')).toBe(0);
  });
});
