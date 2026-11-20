import { describe, it, expect } from 'vitest';
import { groupConversations } from '../../features/chat/conversationGrouping';
import { type ConversationItem } from '../../services/api/types';

describe('groupConversations pure helper', () => {
  const referenceNow = new Date('2026-11-20T12:00:00Z');

  const makeItem = (id: string, updatedAt: string, pinned = false): ConversationItem => ({
    id,
    title: `Chat ${id}`,
    pinned,
    created_at: updatedAt,
    updated_at: updatedAt,
  });

  it('correctly places items into Today, Yesterday, Previous 7 days, and Older', () => {
    const todayItem = makeItem('today', '2026-11-20T08:00:00Z');
    const yesterdayItem = makeItem('yesterday', '2026-11-19T15:00:00Z');
    const prev7DaysItem = makeItem('7days', '2026-11-16T10:00:00Z');
    const olderItem = makeItem('older', '2026-11-01T10:00:00Z');

    const groups = groupConversations(
      [todayItem, yesterdayItem, prev7DaysItem, olderItem],
      referenceNow,
    );

    expect(groups).toHaveLength(4);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].items.map(i => i.id)).toEqual(['today']);

    expect(groups[1].label).toBe('Yesterday');
    expect(groups[1].items.map(i => i.id)).toEqual(['yesterday']);

    expect(groups[2].label).toBe('Previous 7 days');
    expect(groups[2].items.map(i => i.id)).toEqual(['7days']);

    expect(groups[3].label).toBe('Older');
    expect(groups[3].items.map(i => i.id)).toEqual(['older']);
  });

  it('puts pinned chats first regardless of date, under a Pinned group', () => {
    const olderPinned = makeItem('old-pinned', '2026-10-01T00:00:00Z', true);
    const todayUnpinned = makeItem('today-unpinned', '2026-11-20T11:00:00Z', false);

    const groups = groupConversations([todayUnpinned, olderPinned], referenceNow);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Pinned');
    expect(groups[0].items[0].id).toBe('old-pinned');

    expect(groups[1].label).toBe('Today');
    expect(groups[1].items[0].id).toBe('today-unpinned');
  });

  it('omits empty groups', () => {
    const todayItem = makeItem('only-today', '2026-11-20T09:00:00Z');
    const groups = groupConversations([todayItem], referenceNow);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Today');
  });

  it('returns empty array when items list is empty', () => {
    const groups = groupConversations([], referenceNow);
    expect(groups).toEqual([]);
  });
});
