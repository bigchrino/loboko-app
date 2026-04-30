// Tracks which missed calls have already been "seen" by the current user.
// We persist the timestamp of the most recent missed call that the user has
// acknowledged (by opening `/calls`) in localStorage. The missed-call badge
// then shows the number of missed-call entries whose `createdAt` is newer
// than that timestamp.
//
// This keeps the feature 100% client-side (no schema change), which matches
// the rest of the call history flow that reads from `messages` rows.

import { supabase } from '@/lib/supabase';
import { decodePayload, CallEventPayload } from '@/lib/message-format';

const storageKey = (userId: string) => `loboko:missed_calls_seen_at:${userId}`;

/** Read the last-seen ISO timestamp for the current user. */
export function getLastSeenMissedAt(userId: string): string | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/** Mark ALL current missed calls as seen (called when user opens /calls). */
export function markAllMissedSeen(userId: string): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    // ignore quota / privacy errors
  }
}

/**
 * Count missed-or-rejected incoming calls newer than the last-seen marker.
 * We only count events that represent a real missed call FOR ME:
 *   - event is 'missed' or 'rejected'
 *   - the current user was the callee (direction === 'incoming')
 * Heuristic for direction uses the same logic as `loadCallHistory`.
 */
export async function countUnseenMissedCalls(userId: string): Promise<number> {
  if (!userId) return 0;
  const lastSeen = getLastSeenMissedAt(userId);
  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;

  // Limit to a reasonable window — missed calls older than 30 days aren't
  // useful for a badge counter.
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('messages')
    .select('id,user_id,receiver_id,content,created_at')
    .or(`user_id.eq.${userId},receiver_id.eq.${userId}`)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn('[missed-calls] query failed', error);
    return 0;
  }

  // Dedup by callId to avoid double counting (both sides may log an event).
  const seenCallIds = new Set<string>();
  let count = 0;
  for (const row of data || []) {
    const payload = decodePayload(row.content);
    if (payload.kind !== 'call_event') continue;
    const ev = payload as CallEventPayload;
    if (ev.event !== 'missed' && ev.event !== 'rejected') continue;

    // Determine if this represents an incoming call the current user missed.
    // Author logs the event. Using the same heuristic as call-history.ts:
    // for missed/rejected, the author is the callee.
    const isIncomingForMe = row.user_id === userId;
    if (!isIncomingForMe) continue;

    // Only count missed — declining a call yourself is not a "missed call"
    // for the callee from a UX standpoint.
    if (ev.event !== 'missed') continue;

    if (ev.callId && seenCallIds.has(ev.callId)) continue;
    if (ev.callId) seenCallIds.add(ev.callId);

    const createdAt = row.created_at
      ? new Date(row.created_at).getTime()
      : 0;
    if (createdAt > lastSeenMs) count += 1;
  }
  return count;
}