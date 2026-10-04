import { supabase } from '@/lib/supabase';
import type { Group, GroupMessage } from '@/lib/group-helpers';

interface GroupInboxRow {
  group_data: Group;
  member_count: number;
  last_message: GroupMessage | null;
  last_read_at: string | null;
  unread_count: number;
}

/** One request for all summaries; chat histories are loaded only when opened. */
export async function loadGroupInbox() {
  const { data, error } = await supabase.rpc('load_group_inbox');
  if (error) throw error;
  const groups: Group[] = [];
  const memberCounts: Record<string, number> = {};
  const lastMessages: Record<string, GroupMessage | undefined> = {};
  const reads: Record<string, string> = {};
  const unreadCounts: Record<string, number> = {};
  for (const row of (data ?? []) as GroupInboxRow[]) {
    const id = row.group_data.id;
    groups.push(row.group_data);
    memberCounts[id] = Number(row.member_count);
    lastMessages[id] = row.last_message ?? undefined;
    if (row.last_read_at) reads[id] = row.last_read_at;
    unreadCounts[id] = Number(row.unread_count);
  }
  return { groups, memberCounts, lastMessages, reads, unreadCounts };
}
