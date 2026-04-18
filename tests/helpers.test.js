/**
 * Test: Helpers Utilities
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  formatDateTime,
  formatTime,
  formatRelativeTime,
  truncate,
  chunkArray,
  splitMessage,
  sleep,
  UserDebouncer,
} from '../src/utils/helpers.js';

describe('Helpers', () => {
  describe('formatDateTime', () => {
    it('should return Khong xac dinh for null', () => {
      expect(formatDateTime(null)).toBe('Khong xac dinh');
    });

    it('should format ISO string correctly', () => {
      const result = formatDateTime('2024-12-25T15:30:00.000+07:00');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    });
  });

  describe('formatTime', () => {
    it('should return --:-- for null', () => {
      expect(formatTime(null)).toBe('--:--');
    });
  });

  describe('truncate', () => {
    it('should return empty for null/undefined', () => {
      expect(truncate(null)).toBe('');
      expect(truncate(undefined)).toBe('');
    });

    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate long strings with ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('should use default maxLen of 1024', () => {
      const long = 'a'.repeat(2000);
      expect(truncate(long).length).toBe(1024);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunkArray(arr, 3);
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty array', () => {
      expect(chunkArray([], 3)).toEqual([]);
    });

    it('should handle array smaller than chunk size', () => {
      expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
    });
  });

  describe('splitMessage', () => {
    it('should not split short messages', () => {
      const result = splitMessage('hello', 2000);
      expect(result).toEqual(['hello']);
    });

    it('should split long messages', () => {
      const long = 'a'.repeat(3000);
      const result = splitMessage(long, 2000);
      expect(result.length).toBe(2);
      expect(result[0].length).toBe(2000);
      expect(result[1].length).toBe(1000);
    });

    it('should split by lines', () => {
      const lines = Array(100).fill('line').map((l, i) => `${l}${i}`);
      const text = lines.join('\n');
      const result = splitMessage(text, 500);
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('sleep', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('UserDebouncer', () => {
    let debouncer;

    afterEach(() => {
      if (debouncer) debouncer.destroy();
    });

    it('should allow first attempt', () => {
      debouncer = new UserDebouncer(1000);
      expect(debouncer.try('user1')).toBe(true);
    });

    it('should block rapid attempts', () => {
      debouncer = new UserDebouncer(500);
      debouncer.try('user1');
      expect(debouncer.try('user1')).toBe(false);
    });

    it('should allow after window expires', async () => {
      debouncer = new UserDebouncer(100);
      debouncer.try('user1');
      expect(debouncer.try('user1')).toBe(false);
      await sleep(150);
      expect(debouncer.try('user1')).toBe(true);
    });

    it('should reset user correctly', () => {
      debouncer = new UserDebouncer(1000);
      debouncer.try('user1');
      debouncer.reset('user1');
      expect(debouncer.try('user1')).toBe(true);
    });

    it('should track users independently', () => {
      debouncer = new UserDebouncer(500);
      debouncer.try('user1');
      expect(debouncer.try('user2')).toBe(true);
    });
  });
});
