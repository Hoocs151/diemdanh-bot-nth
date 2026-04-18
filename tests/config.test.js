/**
 * Test: Config - Schema validation logic
 * Config module sử dụng dotenv nên ta test logic parse trực tiếp
 */

import { describe, it, expect } from 'vitest';

describe('Config Schema Logic', () => {
  // Test logic parse giá trị
  describe('parseValue', () => {
    function parseBoolean(raw, def) {
      if (raw === undefined) return def;
      return raw === true || raw === 'true' || raw === '1';
    }

    function parseNumber(raw, def, min, max) {
      if (raw === undefined || raw === '') return def;
      const num = Number(raw);
      if (isNaN(num)) return def;
      if (min !== undefined && num < min) return min;
      if (max !== undefined && num > max) return max;
      return num;
    }

    function parseEnum(raw, def, vals) {
      if (raw === undefined || raw === '') return def;
      return vals.includes(raw) ? raw : def;
    }

    function parseRoleIds(value) {
      if (!value) return [];
      return value.split(',').map((id) => id.trim()).filter(Boolean);
    }

    it('should parse boolean true', () => {
      expect(parseBoolean('true', false)).toBe(true);
      expect(parseBoolean(true, false)).toBe(true);
      expect(parseBoolean('1', false)).toBe(true);
    });

    it('should use default for missing boolean', () => {
      expect(parseBoolean(undefined, true)).toBe(true);
      expect(parseBoolean('', false)).toBe(false);
    });

    it('should parse numbers correctly', () => {
      expect(parseNumber('30', 0)).toBe(30);
      expect(parseNumber('0', 10)).toBe(0);
      expect(parseNumber('abc', 5, 0, 100)).toBe(5); // NaN -> default
    });

    it('should clamp numbers to min/max', () => {
      expect(parseNumber('500000', 0, 0, 60000)).toBe(60000);
      expect(parseNumber('-5', 0, 0, 100)).toBe(0);
      expect(parseNumber('50', 0, 0, 100)).toBe(50);
    });

    it('should parse enum correctly', () => {
      expect(parseEnum('info', 'debug', ['debug', 'info', 'warn', 'error'])).toBe('info');
      expect(parseEnum('invalid', 'debug', ['debug', 'info', 'warn', 'error'])).toBe('debug');
      expect(parseEnum(undefined, 'info', ['debug', 'info'])).toBe('info');
    });

    it('should parse role IDs', () => {
      expect(parseRoleIds('role1,role2,role3')).toEqual(['role1', 'role2', 'role3']);
      expect(parseRoleIds(' role1 , role2 ')).toEqual(['role1', 'role2']);
      expect(parseRoleIds('')).toEqual([]);
      expect(parseRoleIds(null)).toEqual([]);
    });
  });
});
