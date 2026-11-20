import { type ConversationItem } from '../../services/api/types';

export type ConversationGroupLabel = 'Pinned' | 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

export interface ConversationGroup {
  label: ConversationGroupLabel;
  items: ConversationItem[];
}

/**
 * Pure helper grouping conversations into Pinned, Today, Yesterday, Previous 7 days, and Older.
 * Uses local calendar days based on now.
 * Empty groups are excluded.
 */
export function groupConversations(
  items: ConversationItem[],
  now: Date = new Date(),
): ConversationGroup[] {
  const pinnedItems: ConversationItem[] = [];
  const todayItems: ConversationItem[] = [];
  const yesterdayItems: ConversationItem[] = [];
  const prev7DaysItems: ConversationItem[] = [];
  const olderItems: ConversationItem[] = [];

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
  const startOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0).getTime();

  for (const item of items) {
    if (item.pinned) {
      pinnedItems.push(item);
      continue;
    }

    const t = new Date(item.updated_at).getTime();
    if (t >= startOfToday) {
      todayItems.push(item);
    } else if (t >= startOfYesterday) {
      yesterdayItems.push(item);
    } else if (t >= startOf7Days) {
      prev7DaysItems.push(item);
    } else {
      olderItems.push(item);
    }
  }

  const groups: ConversationGroup[] = [];
  if (pinnedItems.length > 0) groups.push({ label: 'Pinned', items: pinnedItems });
  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (prev7DaysItems.length > 0) groups.push({ label: 'Previous 7 days', items: prev7DaysItems });
  if (olderItems.length > 0) groups.push({ label: 'Older', items: olderItems });

  return groups;
}
