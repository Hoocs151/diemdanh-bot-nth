/**
 * Test: Factions Config
 */

import { describe, it, expect } from 'vitest';
import {
  FACTIONS,
  FACTION_ORDER,
  FACTION_MAP,
  getFactionName,
  getFactionEmoji,
} from '../src/config/factions.js';

describe('Factions', () => {
  describe('FACTIONS', () => {
    it('should have 7 factions', () => {
      expect(Object.keys(FACTIONS).length).toBe(7);
    });

    it('should have required properties for each faction', () => {
      for (const faction of Object.values(FACTIONS)) {
        expect(faction).toHaveProperty('id');
        expect(faction).toHaveProperty('name');
        expect(faction).toHaveProperty('emoji');
        expect(faction).toHaveProperty('buttonStyle');
        expect(faction).toHaveProperty('description');
        expect(typeof faction.id).toBe('string');
        expect(typeof faction.name).toBe('string');
        expect(typeof faction.emoji).toBe('string');
        expect(typeof faction.buttonStyle).toBe('number');
      }
    });

    it('should have unique IDs', () => {
      const ids = Object.values(FACTIONS).map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('FACTION_ORDER', () => {
    it('should have 7 items', () => {
      expect(FACTION_ORDER.length).toBe(7);
    });

    it('should match faction IDs', () => {
      for (const fid of FACTION_ORDER) {
        expect(FACTION_MAP).toHaveProperty(fid);
      }
    });
  });

  describe('FACTION_MAP', () => {
    it('should have 7 factions', () => {
      expect(Object.keys(FACTION_MAP).length).toBe(7);
    });

    it('should map id to faction object', () => {
      const faction = FACTION_MAP['cuu_linh'];
      expect(faction.name).toBe('Cửu Linh');
      expect(faction.emoji).toBeTruthy();
    });
  });

  describe('getFactionName', () => {
    it('should return faction name for valid ID', () => {
      expect(getFactionName('cuu_linh')).toBe('Cửu Linh');
      expect(getFactionName('than_tuong')).toBe('Thần Tương');
      expect(getFactionName('thiet_y')).toBe('Thiết Y');
    });

    it('should return ID for unknown faction', () => {
      expect(getFactionName('unknown_faction')).toBe('unknown_faction');
      // null không có trong map nên trả về null (ko phải string)
      expect(getFactionName(null)).toBeNull();
    });
  });

  describe('getFactionEmoji', () => {
    it('should return emoji for valid ID', () => {
      expect(getFactionEmoji('cuu_linh')).toBeTruthy();
    });

    it('should return default emoji for unknown faction', () => {
      expect(getFactionEmoji('unknown')).toBe('⚔️');
    });
  });
});
