// Helpers for per-group unread tracking. Relies on the table `group_reads`
// defined in UNREAD_BADGES_SETUP.md. If the table does not exist yet, all
// helpers degrade gracefully (return empty maps, swallow errors) so the rest
// of the app keeps working.

import { supabase } from '@/lib/supabase';

export interface GroupReadRow {
  group_id: string;
  last_read_at: string;
}

/**
 * Fetch the `last_read_at` for every group the current user has opened at
 * least once. Returns a map keyed by group_id. Groups absent from the map
 * mean the user has never opened the group.
 */
export async function loadGroupReads(
  userId: string,
): Promise<Record<string, string>> {
  if (!userId) return {};
  try {
    const { data, error } = await supabase
      .from('group_reads')
      .select('group_id, last_read_at')
      .eq('user_id', userId);
    if (error) {
      // Table may not exist yet — silent fallback.
      if (error.code === '42P01') return {};
      console.warn('[group-reads] load failed', error);
      return {};
    }
    const out: Record<string, string> = {};
    ((data as GroupReadRow[]) || []).forEach((r) => {
      out[r.group_id] = r.last_read_at;
    });
    return out;
  } catch (e) {
    console.warn('[group-reads] load exception', e);
    return {};
  }
}

/**
 * Mark the given group as read now. Upserts the (user_id, group_id) row with
 * last_read_at = now(). Best-effort — errors are logged but do not throw.
 */
export async function markGroupRead(
  userId: string,
  groupId: string,
): Promise<void> {
  if (!userId || !groupId) return;
  const now = new Date().toISOString();
  try {
    // Try update first (likely to exist after first open).
    const { data: existing } = await supabase
      .from('group_reads')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('group_reads')
        .update({ last_read_at: now, updated_at: now })
        .eq('id', (existing as { id: string }).id);
      if (error && error.code !== '42P01') {
        console.warn('[group-reads] update failed', error);
      }
      return;
    }
    const { error } = await supabase
      .from('group_reads')
      .insert({ user_id: userId, group_id: groupId, last_read_at: now });
    if (error && error.code !== '42P01' && error.code !== '23505') {
      console.warn('[group-reads] insert failed', error);
    }
  } catch (e) {
    console.warn('[group-reads] mark exception', e);
  }
}