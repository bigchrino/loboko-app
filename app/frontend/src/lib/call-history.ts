// Helpers to load the user's call history from the `messages` table.
// Call events are stored as structured payloads (`kind: 'call_event'`) when
// a call ends, is missed or is rejected. We reuse this data — no new table
// is required for the read-only history view. If a more scalable dedicated
// `calls` table is introduced later, see CALLS_HISTORY_SETUP.md.

import { supabase } from '@/lib/supabase';
import { decodePayload, CallEventPayload } from '@/lib/message-format';

export type CallDirection = 'incoming' | 'outgoing';

/**
 * A normalized row for the history UI.
 * `event` encodes the outcome:
 *   - 'ended'    : call was answered and finished; duration > 0 for real calls.
 *   - 'missed'   : callee never picked up.
 *   - 'rejected' : callee explicitly declined.
 */
export interface CallHistoryEntry {
  id: string;
  peerId: string;
  mode: 'voice' | 'video';
  event: 'ended' | 'missed' | 'rejected';
  direction: CallDirection;
  duration: number;
  createdAt: string;
  callId: string;
}

const DEFAULT_LIMIT = 200;

/**
 * Fetch up to `limit` recent call events involving `myId`.
 * The `messages` row is authored by the side that closed the CallModal, so we
 * must infer direction from (user_id, receiver_id, event) — see below.
 */
export async function loadCallHistory(
  myId: string,
  limit = DEFAULT_LIMIT,
): Promise<CallHistoryEntry[]> {
  if (!myId) return [];
  // Pull bidirectional rows and filter for call_event payloads. We over-fetch
  // slightly because the table also contains texts/media/signalling rows.
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`user_id.eq.${myId},receiver_id.eq.${myId}`)
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 2, 50));
  if (error) {
    console.error('[call-history] query failed', error);
    return [];
  }

  // Deduplicate by callId: one call may have two call_event rows (one from
  // each side). We keep the most informative one:
  //   - Prefer 'ended' with duration > 0 (real conversation) over 'missed'.
  //   - Otherwise prefer whichever row is newer.
  const byCallId = new Map<string, CallHistoryEntry>();
  for (const row of (data || []) as Array<{
    id: string;
    user_id: string;
    receiver_id: string;
    content: string;
    created_at?: string;
  }>) {
    const payload = decodePayload(row.content);
    if (payload.kind !== 'call_event') continue;
    const ev = payload as CallEventPayload;
    if (!ev.callId) continue;

    // Direction is computed from whose POV this history line represents.
    // `user_id` authored the row. If the author closed a call they RECEIVED,
    // the actual caller is `receiver_id`. We infer with heuristics:
    //   - If the authoring user missed an incoming call, they wouldn't post
    //     a row (they weren't involved in closing). In practice missed/rejected
    //     are authored by the callee. So for those events:
    //       direction = incoming if user_id === myId, outgoing otherwise.
    //   - For 'ended', either side can author; we treat author as the one
    //     who hung up. Direction flag from the row is then:
    //       author is me -> we initiated or were callee — we can't tell
    //       with certainty without the original invite. We fall back to:
    //       incoming if receiver_id === me and the author is the peer, else
    //       outgoing.
    let direction: CallDirection;
    if (row.user_id === myId) {
      // I authored this row.
      if (ev.event === 'missed' || ev.event === 'rejected') {
        // I declined/missed => it was an incoming call for me.
        direction = 'incoming';
      } else {
        // I ended it => treat as outgoing by default. The peer is row.receiver_id.
        direction = 'outgoing';
      }
    } else {
      // Peer authored this row.
      if (ev.event === 'missed' || ev.event === 'rejected') {
        // Peer missed/rejected my call => I was the caller.
        direction = 'outgoing';
      } else {
        direction = 'incoming';
      }
    }
    const peerId = row.user_id === myId ? row.receiver_id : row.user_id;

    const entry: CallHistoryEntry = {
      id: row.id,
      peerId,
      mode: ev.mode,
      event: ev.event as 'ended' | 'missed' | 'rejected',
      direction,
      duration: ev.duration || 0,
      callId: ev.callId,
      createdAt: row.created_at || new Date().toISOString(),
    };

    const prev = byCallId.get(ev.callId);
    if (!prev) {
      byCallId.set(ev.callId, entry);
      continue;
    }
    // Prefer the "most informative" row.
    const prefer =
      entry.event === 'ended' && entry.duration > 0 && prev.event !== 'ended'
        ? entry
        : entry.event === prev.event
          ? new Date(entry.createdAt).getTime() > new Date(prev.createdAt).getTime()
            ? entry
            : prev
          : prev.event === 'ended'
            ? prev
            : entry;
    byCallId.set(ev.callId, prefer);
  }

  return Array.from(byCallId.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}