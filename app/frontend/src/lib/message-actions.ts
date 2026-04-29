// Phase 2 helpers: reactions, starred messages, delete-for-me,
// delete-for-everyone, reply metadata. Defensive against missing tables
// (MESSAGING_PHASE2_SETUP.md not yet executed).

import { supabase } from '@/lib/supabase';

const SETUP_HINT = "Exécutez le SQL de MESSAGING_PHASE2_SETUP.md dans Supabase.";

function humanize(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Action impossible';
  const code = error.code;
  const msg = (error.message || '').toLowerCase();
  if (code === '42P01' || msg.includes('does not exist')) {
    return `Table manquante. ${SETUP_HINT}`;
  }
  if (code === '42703' || msg.includes('column')) {
    return `Colonne manquante. ${SETUP_HINT}`;
  }
  if (code === '42501' || msg.includes('row-level security')) {
    return `Permission refusée. ${SETUP_HINT}`;
  }
  return error.message || 'Action impossible';
}

// -------------------- Reactions ----------------------------------------------

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at?: string;
}

export async function loadReactionsForMessages(
  messageIds: string[],
): Promise<Reaction[]> {
  if (!messageIds.length) return [];
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[msg-actions] loadReactions', error);
    return [];
  }
  return (data as Reaction[]) || [];
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<'added' | 'removed'> {
  // Check if already present
  const { data: existing, error: selErr } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();
  if (selErr && selErr.code !== 'PGRST116') {
    throw new Error(humanize(selErr));
  }
  if (existing) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(humanize(error));
    return 'removed';
  }
  const { error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error && error.code !== '23505') {
    throw new Error(humanize(error));
  }
  return 'added';
}

// -------------------- Starred (important) -----------------------------------

export async function loadStarredIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('starred_messages')
    .select('message_id')
    .eq('user_id', userId);
  if (error) {
    if (error.code === '42P01') return new Set();
    console.error('[msg-actions] loadStarredIds', error);
    return new Set();
  }
  return new Set(((data as { message_id: string }[]) || []).map((r) => r.message_id));
}

export async function toggleStar(
  userId: string,
  messageId: string,
  starred: boolean,
): Promise<void> {
  if (starred) {
    const { error } = await supabase
      .from('starred_messages')
      .delete()
      .eq('user_id', userId)
      .eq('message_id', messageId);
    if (error) throw new Error(humanize(error));
  } else {
    const { error } = await supabase
      .from('starred_messages')
      .insert({ user_id: userId, message_id: messageId });
    if (error && error.code !== '23505') throw new Error(humanize(error));
  }
}

// -------------------- Delete for me -----------------------------------------

export async function loadDeletedForMeIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('message_deletions')
    .select('message_id')
    .eq('user_id', userId);
  if (error) {
    if (error.code === '42P01') return new Set();
    console.error('[msg-actions] loadDeletedForMeIds', error);
    return new Set();
  }
  return new Set(((data as { message_id: string }[]) || []).map((r) => r.message_id));
}

export async function deleteForMe(userId: string, messageId: string): Promise<void> {
  const { error } = await supabase
    .from('message_deletions')
    .insert({ user_id: userId, message_id: messageId });
  if (error && error.code !== '23505') throw new Error(humanize(error));
}

// -------------------- Delete for everyone -----------------------------------

export async function deleteForEveryone(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_for_everyone_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw new Error(humanize(error));
}