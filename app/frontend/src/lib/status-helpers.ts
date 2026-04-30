/**
 * Client helpers for the LOBOKO Statuses / Stories feature.
 *
 * Tables used (see STATUS_SETUP.md):
 *   - public.statuses       (status items, auto-expire after 24h)
 *   - public.status_views   (who viewed which status)
 *
 * Storage bucket: `statuses`  (key format: "statuses::<user>/<file>")
 */

import { supabase } from '@/lib/supabase';

/** Maximum video duration (in seconds) allowed for a status. */
export const MAX_STATUS_VIDEO_SECONDS = 30;

/** Lifespan of a status (in milliseconds) — 24h. */
export const STATUS_LIFESPAN_MS = 24 * 60 * 60 * 1000;

export type StatusKind = 'text' | 'image' | 'video';

export interface StatusRow {
  id: string;
  user_id: string;
  kind: StatusKind;
  text: string | null;
  object_key: string | null;
  duration: number | null;
  bg_color: string | null;
  created_at: string;
  expires_at: string;
}

export interface StatusAuthor {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_key: string | null;
}

/** A single status + its author (denormalized for UI). */
export interface StatusWithAuthor extends StatusRow {
  author: StatusAuthor;
}

/** A bucket of statuses grouped by author, used on the Statuses page. */
export interface StatusGroup {
  author: StatusAuthor;
  statuses: StatusRow[];
  /** Latest status' created_at — used for sort order. */
  last_created_at: string;
  /** True if the current viewer has seen every status in this group. */
  all_seen: boolean;
}

export interface StatusViewRow {
  id: string;
  status_id: string;
  viewer_id: string;
  viewed_at: string;
}

export interface StatusViewer extends StatusViewRow {
  author: StatusAuthor;
}

/**
 * Preset background colors used by the text-status editor. The user can pick
 * one; stored as-is in `bg_color`.
 */
export const STATUS_TEXT_BG_COLORS: string[] = [
  '#2563eb', // blue (brand)
  '#7c3aed', // purple
  '#db2777', // pink
  '#dc2626', // red
  '#ea580c', // orange
  '#16a34a', // green
  '#0891b2', // cyan
  '#111827', // near black
];

/**
 * Load all active statuses (not expired). We rely on the RLS policy
 * `expires_at > now()` so only fresh ones come back.
 *
 * Authors are loaded in a second query to keep this resilient even if the
 * `profiles <-> auth.users` FK is not wired via PostgREST (common in this
 * project where `profiles.user_id` is used).
 */
export async function loadActiveStatuses(): Promise<StatusWithAuthor[]> {
  const { data: statuses, error } = await supabase
    .from('statuses')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[status] loadActiveStatuses error', error);
    throw error;
  }
  const list = (statuses || []) as StatusRow[];
  if (list.length === 0) return [];

  const userIds = Array.from(new Set(list.map((s) => s.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_key')
    .in('user_id', userIds);

  const byUser = new Map<string, StatusAuthor>();
  for (const p of (profiles || []) as StatusAuthor[]) {
    byUser.set(p.user_id, p);
  }

  return list.map((s) => ({
    ...s,
    author: byUser.get(s.user_id) || {
      user_id: s.user_id,
      username: 'utilisateur',
      display_name: null,
      avatar_key: null,
    },
  }));
}

/**
 * Load which statuses the current user has already viewed, scoped to the
 * given list of status ids to keep the payload small.
 */
export async function loadSeenStatusIds(statusIds: string[]): Promise<Set<string>> {
  if (statusIds.length === 0) return new Set();
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id;
  if (!viewerId) return new Set();
  const { data, error } = await supabase
    .from('status_views')
    .select('status_id')
    .eq('viewer_id', viewerId)
    .in('status_id', statusIds);
  if (error) {
    console.error('[status] loadSeenStatusIds error', error);
    return new Set();
  }
  return new Set((data || []).map((r) => r.status_id as string));
}

/**
 * Group loaded statuses by author for the list screen. The current user's own
 * group is returned separately as `mine` so the UI can render "My status"
 * at the top even when there is none.
 */
export function groupStatusesByAuthor(
  statuses: StatusWithAuthor[],
  seenIds: Set<string>,
  currentUserId: string | null,
): { mine: StatusGroup | null; others: StatusGroup[] } {
  const byUser = new Map<string, StatusWithAuthor[]>();
  for (const s of statuses) {
    const arr = byUser.get(s.user_id) || [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  }
  const groups: StatusGroup[] = [];
  for (const [userId, items] of byUser.entries()) {
    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = items[items.length - 1];
    const allSeen = items.every((s) =>
      // Own statuses never count as "unseen".
      s.user_id === currentUserId ? true : seenIds.has(s.id),
    );
    groups.push({
      author: items[0].author,
      statuses: items.map(({ author: _a, ...rest }) => rest),
      last_created_at: last.created_at,
      all_seen: allSeen,
    });
  }
  // Sort: unseen first, then most recent.
  groups.sort((a, b) => {
    if (a.all_seen !== b.all_seen) return a.all_seen ? 1 : -1;
    return b.last_created_at.localeCompare(a.last_created_at);
  });

  let mine: StatusGroup | null = null;
  const others: StatusGroup[] = [];
  for (const g of groups) {
    if (currentUserId && g.author.user_id === currentUserId) mine = g;
    else others.push(g);
  }
  return { mine, others };
}

/** Create a text status. */
export async function createTextStatus(params: {
  text: string;
  bgColor: string;
}): Promise<StatusRow> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Non connecté.');
  const { data, error } = await supabase
    .from('statuses')
    .insert({
      user_id: userId,
      kind: 'text',
      text: params.text.slice(0, 500),
      bg_color: params.bgColor,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as StatusRow;
}

/** Create a media status (image or video). The media is already uploaded. */
export async function createMediaStatus(params: {
  kind: 'image' | 'video';
  objectKey: string;
  duration?: number;
  caption?: string;
}): Promise<StatusRow> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Non connecté.');
  const { data, error } = await supabase
    .from('statuses')
    .insert({
      user_id: userId,
      kind: params.kind,
      object_key: params.objectKey,
      duration: params.duration ?? null,
      text: params.caption ? params.caption.slice(0, 300) : null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as StatusRow;
}

/** Delete one of the current user's statuses. */
export async function deleteStatus(statusId: string): Promise<void> {
  const { error } = await supabase.from('statuses').delete().eq('id', statusId);
  if (error) throw error;
}

/**
 * Mark a status as viewed by the current user. Idempotent — the unique
 * constraint (status_id, viewer_id) makes a repeat insert a no-op.
 */
export async function markStatusViewed(statusId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id;
  if (!viewerId) return;
  const { error } = await supabase
    .from('status_views')
    .upsert(
      { status_id: statusId, viewer_id: viewerId },
      { onConflict: 'status_id,viewer_id', ignoreDuplicates: true },
    );
  if (error) {
    // Silent — viewing shouldn't block the UX.
    console.warn('[status] markStatusViewed error', error);
  }
}

/**
 * Load the list of viewers for a status owned by the current user.
 * Returns profiles joined with the view row.
 */
export async function loadStatusViewers(statusId: string): Promise<StatusViewer[]> {
  const { data: views, error } = await supabase
    .from('status_views')
    .select('*')
    .eq('status_id', statusId)
    .order('viewed_at', { ascending: false });
  if (error) {
    console.error('[status] loadStatusViewers error', error);
    throw error;
  }
  const rows = (views || []) as StatusViewRow[];
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.viewer_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_key')
    .in('user_id', ids);
  const byUser = new Map<string, StatusAuthor>();
  for (const p of (profiles || []) as StatusAuthor[]) byUser.set(p.user_id, p);
  return rows.map((r) => ({
    ...r,
    author: byUser.get(r.viewer_id) || {
      user_id: r.viewer_id,
      username: 'utilisateur',
      display_name: null,
      avatar_key: null,
    },
  }));
}