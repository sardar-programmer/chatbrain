import { describe, it, expect } from 'vitest';
import { ALL_NAV_ITEMS, WORKSPACE_NAV_ITEMS } from '../../config/navigation';
import { STORAGE_KEYS } from '../../config/constants';

describe('Phase U1: Foundation Integrity', () => {
  it('has unique navigation IDs for every route', () => {
    const ids = ALL_NAV_ITEMS.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('verifies all routes start with a slash', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(item.route.startsWith('/')).toBe(true);
    }
  });

  it('correctly maps workspace items to valid groups', () => {
    const allowedGroups = new Set(['Data Science', 'Labs', 'Creative', 'Workspace']);
    for (const item of WORKSPACE_NAV_ITEMS) {
      expect(item.group).toBeDefined();
      expect(allowedGroups.has(item.group!)).toBe(true);
    }
  });

  it('defines essential localStorage keys without collision', () => {
    const values = Object.values(STORAGE_KEYS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
    expect(STORAGE_KEYS.THEME).toBe('chat_brain_theme');
    expect(STORAGE_KEYS.SIDEBAR_COLLAPSED).toBe('chat_brain_sidebar_collapsed');
  });
});
