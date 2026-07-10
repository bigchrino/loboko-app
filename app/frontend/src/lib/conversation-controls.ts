// Helpers for Phase 1 messaging controls:
// archive / unarchive / clear (soft delete conversation for owner only) / block / unblock / report.
//
// Every helper is defensive: if the underlying tables (see MESSAGING_PHASE1_SETUP.md)
// are missing, the helpers throw a PostgrestError-like object that the UI layer
// turns into a user-friendly toast asking the operator to run the SQL setup.

import { supabase } from '@/lib/supabase';

export interface ConversationState {
  id?: string;
  owner_id: string;
  peer_id: string;
  archived: boolean;
  archived_at?: string | null;
  cleared_at?: string | null;
  pinned: boolean;
  pinned_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

const SETUP_HINT =
  "Exécutez le SQL de MESSAGING_PHASE1_SETUP.md dans Supabase.";

function humanizeError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Action impossible';
  const code = error.code;
  if (code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
    return `Table absente. ${SETUP_HINT}`;
  }
  if (code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
    return `Permissions manquantes. ${SETUP_HINT}`;
  }
  return error.message || 'Action impossible';
}

/**
 * Load all conversation states for the given owner.
 * Returns an empty array if the table is missing (so the UI still works).
 */
export async function loadConversationStates(
  ownerId: string,
): Promise<ConversationState[]> {
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('owner_id', ownerId);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[conv-controls] loadConversationStates', error);
    return [];
  }
  return (data as ConversationState[]) || [];
}

/**
 * Upsert a conversation state (archived / cleared_at) for owner_id + peer_id.
 */
async function upsertState(
  ownerId: string,
  peerId: string,
  patch: Partial<ConversationState>,
): Promise<ConversationState> {
  // Try to fetch existing row first to know whether to insert or update.
  const { data: existing, error: fetchErr } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('peer_id', peerId)
    .maybeSingle();
  if (fetchErr && fetchErr.code !== 'PGRST116') {
    throw new Error(humanizeError(fetchErr));
  }

  if (existing) {
    const { data, error } = await supabase
      .from('conversation_states')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', (existing as ConversationState).id!)
      .select()
      .single();
    if (error) throw new Error(humanizeError(error));
    return data as ConversationState;
  }
  const { data, error } = await supabase
    .from('conversation_states')
    .insert({
      owner_id: ownerId,
      peer_id: peerId,
      archived: false,
      pinned: false,
      ...patch,
    })
    .select()
    .single();
  if (error) throw new Error(humanizeError(error));
  return data as ConversationState;
}

export async function archiveConversation(
  ownerId: string,
  peerId: string,
): Promise<ConversationState> {
  return upsertState(ownerId, peerId, {
    archived: true,
    archived_at: new Date().toISOString(),
  });
}

export async function unarchiveConversation(
  ownerId: string,
  peerId: string,
): Promise<ConversationState> {
  return upsertState(ownerId, peerId, {
    archived: false,
    archived_at: null,
  });
}

export async function pinConversation(
  ownerId: string,
  peerId: string,
): Promise<ConversationState> {
  return upsertState(ownerId, peerId, {
    pinned: true,
    pinned_at: new Date().toISOString(),
  });
}

export async function unpinConversation(
  ownerId: string,
  peerId: string,
): Promise<ConversationState> {
  return upsertState(ownerId, peerId, {
    pinned: false,
    pinned_at: null,
  });
}

/**
 * Soft-delete a conversation for the owner only: all messages with created_at
 * prior to now() are hidden client-side. Real messages are kept for the peer.
 */
export async function clearConversation(
  ownerId: string,
  peerId: string,
): Promise<ConversationState> {
  return upsertState(ownerId, peerId, {
    cleared_at: new Date().toISOString(),
    archived: false,
    archived_at: null,
  });
}

/**
 * Load the set of user ids currently blocked by ownerId.
 * Returns an empty Set if the blocked_users table does not exist yet.
 */
export async function loadBlockedIds(ownerId: string): Promise<Set<string>> {
  if (!ownerId) return new Set();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('owner_id', ownerId);
  if (error) {
    if (error.code === '42P01') return new Set();
    console.error('[conv-controls] loadBlockedIds', error);
    return new Set();
  }
  return new Set(((data as { blocked_id: string }[]) || []).map((r) => r.blocked_id));
}

export async function blockUser(ownerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .insert({ owner_id: ownerId, blocked_id: blockedId });
  if (error && error.code !== '23505') {
    throw new Error(humanizeError(error));
  }
}

export async function unblockUser(ownerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('owner_id', ownerId)
    .eq('blocked_id', blockedId);
  if (error) throw new Error(humanizeError(error));
}

export async function reportUser(
  reporterId: string,
  reportedId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_reports')
    .insert({
      reporter_id: reporterId,
      reported_id: reportedId,
      reason: reason || null,
    });
  if (error) throw new Error(humanizeError(error));
}
