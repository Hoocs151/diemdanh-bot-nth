/**
 * Test: Permissions Middleware
 * Test trực tiếp không cần mock vì CONFIG được inject
 */

import { describe, it, expect } from 'vitest';
import {
  PermissionLevel,
  getPermissionLevel,
  getPermissionLevelName,
  isAdmin,
  isOfficer,
  hasAdminRole,
  hasRole,
  getDisplayName,
} from '../src/middleware/permissions.js';

function makeMockInteraction(userId, roleIds) {
  return {
    user: { id: userId },
    member: {
      roles: {
        cache: roleIds.map((id) => ({ id })), // Array with map(), mỗi item có .id
      },
    },
    reply: async () => {},
  };
}

describe('Permissions - PermissionLevel constants', () => {
  it('should have correct level values', () => {
    expect(PermissionLevel.MEMBER).toBe(0);
    expect(PermissionLevel.OFFICER).toBe(1);
    expect(PermissionLevel.ADMIN).toBe(2);
  });

  it('should have ADMIN > OFFICER > MEMBER', () => {
    expect(PermissionLevel.ADMIN).toBeGreaterThan(PermissionLevel.OFFICER);
    expect(PermissionLevel.OFFICER).toBeGreaterThan(PermissionLevel.MEMBER);
  });
});

describe('Permissions - getPermissionLevelName', () => {
  it('should return correct names', () => {
    expect(getPermissionLevelName(PermissionLevel.MEMBER)).toBe('Member');
    expect(getPermissionLevelName(PermissionLevel.OFFICER)).toBe('Officer');
    expect(getPermissionLevelName(PermissionLevel.ADMIN)).toBe('Admin');
  });

  it('should return Member for unknown level', () => {
    expect(getPermissionLevelName(99)).toBe('Member');
    expect(getPermissionLevelName(-1)).toBe('Member');
  });
});

describe('Permissions - hasRole', () => {
  it('should return true when user has matching role', () => {
    const interaction = makeMockInteraction('user1', ['role_a', 'role_b']);
    expect(hasRole(interaction, ['role_a'])).toBe(true);
    expect(hasRole(interaction, ['role_c', 'role_a'])).toBe(true);
  });

  it('should return false when user has no matching role', () => {
    const interaction = makeMockInteraction('user1', ['role_a']);
    expect(hasRole(interaction, ['role_b'])).toBe(false);
    expect(hasRole(interaction, [])).toBe(false);
  });

  it('should return false when no member', () => {
    const interaction = { user: { id: 'user1' }, member: null };
    expect(hasRole(interaction, ['role_a'])).toBe(false);
  });
});

describe('Permissions - getDisplayName', () => {
  it('should return nickname when available', () => {
    const member = {
      nickname: 'InGameName',
      user: { displayName: 'DisplayName', username: 'username' },
    };
    expect(getDisplayName(member)).toBe('InGameName');
  });

  it('should return displayName when no nickname', () => {
    const member = {
      user: { displayName: 'DisplayName', username: 'username' },
    };
    expect(getDisplayName(member)).toBe('DisplayName');
  });

  it('should return username as fallback', () => {
    const member = {
      user: { username: 'username' },
    };
    expect(getDisplayName(member)).toBe('username');
  });

  it('should return Unknown for null', () => {
    expect(getDisplayName(null)).toBe('Unknown');
    expect(getDisplayName(undefined)).toBe('Unknown');
  });
});

describe('Permissions - hasAdminRole (no mock, uses real CONFIG)', () => {
  it('should return false for null member', () => {
    const interaction = { user: { id: 'user1' }, member: null };
    expect(hasAdminRole(interaction)).toBe(false);
  });
});

describe('Permissions - isAdmin (no mock, uses real CONFIG)', () => {
  it('should return false for null member', () => {
    const interaction = { user: { id: 'user1' }, member: null };
    expect(isAdmin(interaction)).toBe(false);
  });
});

describe('Permissions - isOfficer (no mock, uses real CONFIG)', () => {
  it('should return false for null member', () => {
    const interaction = { user: { id: 'user1' }, member: null };
    expect(isOfficer(interaction)).toBe(false);
  });
});
