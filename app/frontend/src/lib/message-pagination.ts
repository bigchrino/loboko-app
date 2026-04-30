// Cursor-based pagination helpers for 1-to-1 and group messages.
//
// The goal is to never load hundreds of messages at once on mobile. Instead
// we load the last `PAGE_SIZE` messages, and expose a `loadOlder` helper
// that fetches the next page using the oldest known `created_at` as a
// cursor. Realtime inserts (new messages at the bottom) keep flowing
// through the existing polling + insert paths — this module only handles
// the "scroll up to see history" direction.

import { supabase } from '@/lib/supabase';

// Page sizes tuned for mobile:
//  - first load: enough to fill 1-2 screens without feeling empty
//  - subsequent pages: slightly larger to reduce round-trips while the
//    user is actively scrolling up through history
export const DM_PAGE_SIZE = 40;
export const DM_NEXT_PAGE_SIZE = 40;
export const GROUP_PAGE_SIZE = 40;
export const GROUP_NEXT_PAGE_SIZE = 40;

export interface PageResult<T> {
  // Ascending order (oldest first) so callers can prepend/append directly.
  messages: T[];
  // Whether another older page likely exists. Determined by comparing the
  // returned row count to the requested limit.
  hasMore: boolean;
}

// ------------------------- 1-to-1 (messages table) -------------------------

export interface DMRow {
  id: string;
  user_id: string;
  receiver_id: string;
  content: string;
  read?: boolean;
  delivered_at?: string | null;
  read_at?: string | null;
  status?: 'sent' | 'delivered' | 'read' | null;
  created_at?: string;
  reply_to_message_id?: string | null;
  deleted_for_everyone_at?: string | null;
  expires_at?: string | null;
  is_ephemeral?: boolean | null;
}

/**
 * Load the most recent `limit` messages exchanged between `myId` and
 * `peerId`. Returned in ASCENDING order (oldest → newest) so it can be
 * rendered directly.
 */
export async function loadLatestDMPage(
  myId: string,
  peerId: string,
  limit: number = DM_PAGE_SIZE,
): Promise<PageResult<DMRow>> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(user_id.eq.${myId},receiver_id.eq.${peerId}),and(user_id.eq.${peerId},receiver_id.eq.${myId})`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[pagination] loadLatestDMPage', error);
    return { messages: [], hasMore: false };
  }
  const rows = ((data as DMRow[]) || []).slice().reverse();
  return { messages: rows, hasMore: (data?.length ?? 0) >= limit };
}

/**
 * Load the page of messages immediately older than `beforeIso` (exclusive).
 * Returned in ASCENDING order.
 */
export async function loadOlderDMPage(
  myId: string,
  peerId: string,
  beforeIso: string,
  limit: number = DM_NEXT_PAGE_SIZE,
): Promise<PageResult<DMRow>> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(user_id.eq.${myId},receiver_id.eq.${peerId}),and(user_id.eq.${peerId},receiver_id.eq.${myId})`,
    )
    .lt('created_at', beforeIso)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[pagination] loadOlderDMPage', error);
    return { messages: [], hasMore: false };
  }
  const rows = ((data as DMRow[]) || []).slice().reverse();
  return { messages: rows, hasMore: (data?.length ?? 0) >= limit };
}

// ------------------------- Groups (group_messages) -------------------------

export interface GroupRow {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  reply_to_message_id?: string | null;
  deleted_for_everyone_at?: string | null;
  deleted_by?: string | null;
  created_at?: string;
  expires_at?: string | null;
  is_ephemeral?: boolean | null;
}

export async function loadLatestGroupPage(
  groupId: string,
  limit: number = GROUP_PAGE_SIZE,
): Promise<PageResult<GroupRow>> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === '42P01') return { messages: [], hasMore: false };
    console.error('[pagination] loadLatestGroupPage', error);
    return { messages: [], hasMore: false };
  }
  const rows = ((data as GroupRow[]) || []).slice().reverse();
  return { messages: rows, hasMore: (data?.length ?? 0) >= limit };
}

export async function loadOlderGroupPage(
  groupId: string,
  beforeIso: string,
  limit: number = GROUP_NEXT_PAGE_SIZE,
): Promise<PageResult<GroupRow>> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .lt('created_at', beforeIso)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === '42P01') return { messages: [], hasMore: false };
    console.error('[pagination] loadOlderGroupPage', error);
    return { messages: [], hasMore: false };
  }
  const rows = ((data as GroupRow[]) || []).slice().reverse();
  return { messages: rows, hasMore: (data?.length ?? 0) >= limit };
}

/**
 * Merge newly arrived messages into an existing (ASC-ordered) array,
 * deduplicating by `id` and keeping chronological order. Returns the
 * original array reference when nothing changes so React can skip renders.
 */
export function mergeMessagesById<T extends { id: string; created_at?: string }>(
  current: T[],
  incoming: T[],
): T[] {
  if (!incoming || incoming.length === 0) return current;
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return current;
  const merged = [...current, ...fresh];
  merged.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return merged;
}