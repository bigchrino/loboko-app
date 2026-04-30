// Helpers for ephemeral messages (auto-destruct) feature.
//
// See EPHEMERAL_MESSAGES_SETUP.md for the SQL schema this file relies on.
// All helpers are defensive: if the `conversation_settings` table does not
// exist yet (operator has not run the SQL), they return safe defaults
// (0 = disabled) and do NOT throw — so the rest of the messaging UI keeps
// working.

import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/message-format';

export type EphemeralScope = 'dm' | 'group';

// ---------------------------------------------------------------------------
// Realtime synchronization
// ---------------------------------------------------------------------------
//
// The `conversation_settings` table has RLS `owner_id = auth.uid()`, which
// means user B cannot listen to postgres_changes on user A's row. To keep
// RLS strict and still provide realtime sync between the two participants of
// a conversation, we use a Supabase Realtime **broadcast** channel with a
// deterministic name derived from the conversation target. Both users join
// the same channel; whoever changes the duration also broadcasts it.
//
// Payload shape: { durationSeconds: number, from: string (userId) }
// ---------------------------------------------------------------------------

const BROADCAST_EVENT = 'ephemeral_update';

function dmChannelName(a: string, b: string): string {
  // Deterministic: sort to get the same name on both sides.
  const [x, y] = [a, b].sort();
  return `ephemeral:dm:${x}:${y}`;
}

function groupChannelName(groupId: string): string {
  return `ephemeral:group:${groupId}`;
}

export interface EphemeralUpdatePayload {
  durationSeconds: number;
  from: string;
}

/**
 * Subscribe to realtime ephemeral-duration changes for a DM conversation
 * between `myId` and `peerId`. The callback is invoked whenever the peer
 * broadcasts a new duration. Returns an unsubscribe function.
 */
export function subscribeDmEphemeral(
  myId: string,
  peerId: string,
  onUpdate: (payload: EphemeralUpdatePayload) => void,
): () => void {
  if (!myId || !peerId) return () => {};
  const name = dmChannelName(myId, peerId);
  const ch: RealtimeChannel = supabase.channel(name, {
    config: { broadcast: { self: false } },
  });
  ch.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
    const p = payload as EphemeralUpdatePayload | undefined;
    if (!p) return;
    // Ignore our own broadcasts (belt + suspenders: `self: false` already does
    // this, but a second tab of the same user could still echo).
    if (p.from === myId) return;
    onUpdate(p);
  });
  ch.subscribe();
  return () => {
    try {
      supabase.removeChannel(ch);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Subscribe to realtime ephemeral-duration changes for a group. Any member
 * who changes the duration broadcasts it to all other members.
 */
export function subscribeGroupEphemeral(
  myId: string,
  groupId: string,
  onUpdate: (payload: EphemeralUpdatePayload) => void,
): () => void {
  if (!myId || !groupId) return () => {};
  const name = groupChannelName(groupId);
  const ch: RealtimeChannel = supabase.channel(name, {
    config: { broadcast: { self: false } },
  });
  ch.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
    const p = payload as EphemeralUpdatePayload | undefined;
    if (!p) return;
    if (p.from === myId) return;
    onUpdate(p);
  });
  ch.subscribe();
  return () => {
    try {
      supabase.removeChannel(ch);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Broadcast a DM ephemeral-duration update to the peer. Best-effort: if the
 * channel is not ready yet, the message is still queued by supabase-js.
 */
export async function broadcastDmEphemeral(
  myId: string,
  peerId: string,
  durationSeconds: number,
): Promise<void> {
  if (!myId || !peerId) return;
  const name = dmChannelName(myId, peerId);
  const ch = supabase.channel(name, {
    config: { broadcast: { self: false } },
  });
  try {
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
      // Safety timeout: resolve anyway after 1.5s so we don't hang the UI.
      setTimeout(resolve, 1500);
    });
    await ch.send({
      type: 'broadcast',
      event: BROADCAST_EVENT,
      payload: {
        durationSeconds,
        from: myId,
      } as EphemeralUpdatePayload,
    });
  } catch (e) {
    console.warn('[ephemeral] broadcastDmEphemeral failed', e);
  } finally {
    setTimeout(() => {
      try {
        supabase.removeChannel(ch);
      } catch {
        /* ignore */
      }
    }, 500);
  }
}

/**
 * Broadcast a group ephemeral-duration update to all other group members.
 */
export async function broadcastGroupEphemeral(
  myId: string,
  groupId: string,
  durationSeconds: number,
): Promise<void> {
  if (!myId || !groupId) return;
  const name = groupChannelName(groupId);
  const ch = supabase.channel(name, {
    config: { broadcast: { self: false } },
  });
  try {
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
      setTimeout(resolve, 1500);
    });
    await ch.send({
      type: 'broadcast',
      event: BROADCAST_EVENT,
      payload: {
        durationSeconds,
        from: myId,
      } as EphemeralUpdatePayload,
    });
  } catch (e) {
    console.warn('[ephemeral] broadcastGroupEphemeral failed', e);
  } finally {
    setTimeout(() => {
      try {
        supabase.removeChannel(ch);
      } catch {
        /* ignore */
      }
    }, 500);
  }
}

/** Allowed durations in seconds. 0 = disabled. */
export const EPHEMERAL_DURATIONS: Array<{
  value: number;
  label: string;
  short: string;
}> = [
  { value: 0, label: 'Désactivé', short: 'Off' },
  { value: 24 * 60 * 60, label: '24 heures', short: '24h' },
  { value: 7 * 24 * 60 * 60, label: '7 jours', short: '7j' },
  { value: 30 * 24 * 60 * 60, label: '30 jours', short: '30j' },
];

export function durationLabel(seconds: number): string {
  const found = EPHEMERAL_DURATIONS.find((d) => d.value === seconds);
  if (found) return found.label;
  if (seconds <= 0) return 'Désactivé';
  return `${Math.round(seconds / 3600)}h`;
}

export function durationShort(seconds: number): string {
  const found = EPHEMERAL_DURATIONS.find((d) => d.value === seconds);
  return found?.short || '';
}

/**
 * Compute expires_at ISO string from now() + duration, or null if disabled.
 *
 * ⚠️ INVARIANT — PER-MESSAGE EXPIRATION:
 * This function MUST be called exactly once per message, at the moment the
 * message is sent. The returned ISO timestamp is then persisted on that
 * specific row (messages.expires_at / group_messages.expires_at) and never
 * recomputed afterwards.
 *
 * Changing the conversation's ephemeral duration (via setDmEphemeralDuration
 * or setGroupEphemeralDuration) updates ONLY `conversation_settings` and
 * MUST NOT trigger any UPDATE on previously sent messages. Older messages
 * keep their original expires_at; only messages sent AFTER the change use
 * the new duration.
 *
 * Example timeline:
 *   t0: user enables 24h  → conversation_settings = 24h
 *   t1: sends message A   → A.expires_at = t1 + 24h   (locked)
 *   t2: user changes 7d   → conversation_settings = 7d (A unchanged)
 *   t3: sends message B   → B.expires_at = t3 + 7d
 */
export function computeExpiresAt(durationSeconds: number): string | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  return new Date(Date.now() + durationSeconds * 1000).toISOString();
}

/** Check if a message with optional expires_at is currently expired. */
export function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

/** Returns true if the conversation_settings table is missing. */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const m = (error.message || '').toLowerCase();
  return m.includes('does not exist') || m.includes('relation') && m.includes('settings');
}

/**
 * Load the ephemeral duration (in seconds) chosen by `ownerId` for a DM with
 * `peerId`. Returns 0 if no setting or if the table is missing.
 */
export async function loadDmEphemeralDuration(
  ownerId: string,
  peerId: string,
): Promise<number> {
  if (!ownerId || !peerId) return 0;
  const { data, error } = await supabase
    .from('conversation_settings')
    .select('ephemeral_duration_seconds')
    .eq('scope', 'dm')
    .eq('owner_id', ownerId)
    .eq('peer_id', peerId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return 0;
    // PGRST116 = no rows -> fine
    if (error.code === 'PGRST116') return 0;
    console.error('[ephemeral] loadDmEphemeralDuration', error);
    return 0;
  }
  const row = data as { ephemeral_duration_seconds?: number } | null;
  return row?.ephemeral_duration_seconds ?? 0;
}

/**
 * Load the ephemeral duration (in seconds) chosen by `ownerId` for a group.
 * Returns 0 if no setting or if the table is missing.
 */
export async function loadGroupEphemeralDuration(
  ownerId: string,
  groupId: string,
): Promise<number> {
  if (!ownerId || !groupId) return 0;
  const { data, error } = await supabase
    .from('conversation_settings')
    .select('ephemeral_duration_seconds')
    .eq('scope', 'group')
    .eq('owner_id', ownerId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return 0;
    if (error.code === 'PGRST116') return 0;
    console.error('[ephemeral] loadGroupEphemeralDuration', error);
    return 0;
  }
  const row = data as { ephemeral_duration_seconds?: number } | null;
  return row?.ephemeral_duration_seconds ?? 0;
}

/**
 * Upsert a DM ephemeral setting (owner → peer). Throws a human-readable
 * error if the table is missing.
 *
 * ⚠️ IMPORTANT: This function MUST only write to `conversation_settings`.
 * It must NEVER issue an UPDATE on the `messages` table to recompute
 * expires_at for previously sent messages. Each message locks its own
 * expires_at at send time (see computeExpiresAt). Changing the duration
 * only affects messages sent AFTER the change.
 */
export async function setDmEphemeralDuration(
  ownerId: string,
  peerId: string,
  durationSeconds: number,
): Promise<void> {
  if (!ownerId || !peerId) return;
  // Try fetch existing
  const { data: existing, error: fetchErr } = await supabase
    .from('conversation_settings')
    .select('id')
    .eq('scope', 'dm')
    .eq('owner_id', ownerId)
    .eq('peer_id', peerId)
    .maybeSingle();
  if (fetchErr && !isMissingTable(fetchErr) && fetchErr.code !== 'PGRST116') {
    throw new Error(fetchErr.message || 'Action impossible');
  }
  if (isMissingTable(fetchErr)) {
    throw new Error(
      'Table conversation_settings manquante. Exécutez le SQL de EPHEMERAL_MESSAGES_SETUP.md dans Supabase.',
    );
  }
  if (existing) {
    const { error } = await supabase
      .from('conversation_settings')
      .update({
        ephemeral_duration_seconds: durationSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message || 'Action impossible');
    return;
  }
  const { error } = await supabase.from('conversation_settings').insert({
    scope: 'dm',
    owner_id: ownerId,
    peer_id: peerId,
    ephemeral_duration_seconds: durationSeconds,
  });
  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        'Table conversation_settings manquante. Exécutez le SQL de EPHEMERAL_MESSAGES_SETUP.md dans Supabase.',
      );
    }
    throw new Error(error.message || 'Action impossible');
  }
}

/**
 * Upsert a group ephemeral setting (owner → group). Throws a human-readable
 * error if the table is missing.
 *
 * ⚠️ IMPORTANT: This function MUST only write to `conversation_settings`.
 * It must NEVER issue an UPDATE on the `group_messages` table to recompute
 * expires_at for previously sent messages. Each message locks its own
 * expires_at at send time (see computeExpiresAt). Changing the duration
 * only affects messages sent AFTER the change.
 */
export async function setGroupEphemeralDuration(
  ownerId: string,
  groupId: string,
  durationSeconds: number,
): Promise<void> {
  if (!ownerId || !groupId) return;
  const { data: existing, error: fetchErr } = await supabase
    .from('conversation_settings')
    .select('id')
    .eq('scope', 'group')
    .eq('owner_id', ownerId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (fetchErr && !isMissingTable(fetchErr) && fetchErr.code !== 'PGRST116') {
    throw new Error(fetchErr.message || 'Action impossible');
  }
  if (isMissingTable(fetchErr)) {
    throw new Error(
      'Table conversation_settings manquante. Exécutez le SQL de EPHEMERAL_MESSAGES_SETUP.md dans Supabase.',
    );
  }
  if (existing) {
    const { error } = await supabase
      .from('conversation_settings')
      .update({
        ephemeral_duration_seconds: durationSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message || 'Action impossible');
    return;
  }
  const { error } = await supabase.from('conversation_settings').insert({
    scope: 'group',
    owner_id: ownerId,
    group_id: groupId,
    ephemeral_duration_seconds: durationSeconds,
  });
  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        'Table conversation_settings manquante. Exécutez le SQL de EPHEMERAL_MESSAGES_SETUP.md dans Supabase.',
      );
    }
    throw new Error(error.message || 'Action impossible');
  }
}

// ---------------------------------------------------------------------------
// System messages for ephemeral setting changes
// ---------------------------------------------------------------------------
//
// When a user changes the ephemeral duration, we insert a non-editable
// `system` message in the conversation so both participants see the change
// inline. Storage piggybacks on the normal `content` column of messages /
// group_messages via the existing `@@loboko:` JSON payload prefix — no DB
// migration required.

/**
 * Insert a system message in a DM conversation announcing an ephemeral
 * setting change. Errors are swallowed so the setting change itself still
 * succeeds even if this insert fails.
 */
export async function insertEphemeralSystemMessageDM(args: {
  fromUserId: string;
  toUserId: string;
  durationSeconds: number;
}): Promise<void> {
  try {
    const content = encodePayload({
      kind: 'system',
      system_type: 'ephemeral_setting',
      duration_seconds: args.durationSeconds,
      actor_id: args.fromUserId,
    });
    await supabase.from('messages').insert({
      user_id: args.fromUserId,
      receiver_id: args.toUserId,
      content,
    });
  } catch {
    // best-effort
  }
}

/**
 * Insert a system message in a group conversation announcing an ephemeral
 * setting change.
 */
export async function insertEphemeralSystemMessageGroup(args: {
  fromUserId: string;
  groupId: string;
  durationSeconds: number;
}): Promise<void> {
  try {
    const content = encodePayload({
      kind: 'system',
      system_type: 'ephemeral_setting',
      duration_seconds: args.durationSeconds,
      actor_id: args.fromUserId,
    });
    await supabase.from('group_messages').insert({
      group_id: args.groupId,
      user_id: args.fromUserId,
      content,
    });
  } catch {
    // best-effort
  }
}

/**
 * Format an ephemeral duration change into a localized (fr) label for the
 * system message. `selfActor` true means the current user is the actor.
 */
export function formatEphemeralSystemLabel(args: {
  durationSeconds: number;
  selfActor: boolean;
  actorName: string;
}): string {
  const { durationSeconds, selfActor, actorName } = args;
  if (durationSeconds <= 0) {
    return 'Messages éphémères désactivés';
  }
  const human = formatDurationHuman(durationSeconds);
  if (selfActor) {
    return `Vous avez activé les messages éphémères (${human})`;
  }
  return `${actorName} a activé les messages éphémères (${human})`;
}

function formatDurationHuman(seconds: number): string {
  if (seconds === 24 * 3600) return '24 h';
  if (seconds === 7 * 24 * 3600) return '7 jours';
  if (seconds === 30 * 24 * 3600) return '30 jours';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 24 * 3600) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} jours`;
}