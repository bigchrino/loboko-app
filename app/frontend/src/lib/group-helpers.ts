// Helpers for Phase 3 groups feature. All helpers are defensive: if the
// underlying tables (see GROUPS_SETUP.md) are missing, they return empty
// results or throw a human-readable error.

import { supabase } from '@/lib/supabase';

export type GroupRole = 'owner' | 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  avatar_key: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at?: string;
}

export interface GroupMessage {
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

const SETUP_HINT = "Exécutez le SQL de GROUPS_SETUP_FIXED.md dans Supabase.";

function humanize(error: { message?: string; code?: string; details?: string } | null | undefined): string {
  if (!error) return 'Action impossible';
  const code = error.code;
  const msg = (error.message || '').toLowerCase();
  if (code === '42P01' || msg.includes('does not exist')) {
    return `Table manquante. ${SETUP_HINT}`;
  }
  if (code === '42703' || msg.includes('column')) {
    return `Colonne manquante (ex: reply_to_message_id). ${SETUP_HINT}`;
  }
  if (code === '42501' || msg.includes('row-level security') || msg.includes('policy')) {
    return `Permission refusée par les policies RLS. ${SETUP_HINT}`;
  }
  if (code === '23505') {
    return 'Entrée déjà existante.';
  }
  return error.message || 'Action impossible';
}

// ------------------ Groups listing ------------------------------------------

export async function loadMyGroups(userId: string): Promise<{
  groups: Group[];
  membersByGroup: Record<string, GroupMember[]>;
}> {
  if (!userId) return { groups: [], membersByGroup: {} };
  // 1) find group ids I belong to
  const { data: memberships, error: mErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (mErr) {
    if (mErr.code === '42P01') return { groups: [], membersByGroup: {} };
    console.error('[groups] loadMyGroups memberships', mErr);
    return { groups: [], membersByGroup: {} };
  }
  const groupIds = ((memberships as { group_id: string }[]) || []).map(
    (r) => r.group_id,
  );
  if (groupIds.length === 0) return { groups: [], membersByGroup: {} };

  const { data: gData, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .is('deleted_at', null);
  if (gErr) {
    console.error('[groups] loadMyGroups groups', gErr);
    return { groups: [], membersByGroup: {} };
  }
  const groups = (gData as Group[]) || [];

  const { data: allMembers } = await supabase
    .from('group_members')
    .select('*')
    .in('group_id', groupIds);
  const membersByGroup: Record<string, GroupMember[]> = {};
  ((allMembers as GroupMember[]) || []).forEach((m) => {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
    membersByGroup[m.group_id].push(m);
  });
  return { groups, membersByGroup };
}

// ------------------ Group creation ------------------------------------------

export async function createGroup(params: {
  name: string;
  avatarKey?: string | null;
  memberIds: string[];
  creatorId: string;
}): Promise<Group> {
  const { name, avatarKey, memberIds, creatorId } = params;

  // Step 1 — insert the group itself (creator must be auth.uid()).
  const { data: g, error } = await supabase
    .from('groups')
    .insert({
      name,
      avatar_key: avatarKey || null,
      created_by: creatorId,
    })
    .select()
    .single();
  if (error) {
    console.error('[groups] create step1 (insert groups)', error);
    throw new Error(humanize(error));
  }
  const group = g as Group;

  // Step 2 — bulk insert the full membership (creator as owner + invitees).
  // The policy `group_members_insert_creator_batch` in GROUPS_SETUP_FIXED.md
  // allows the creator to insert any row as long as they own the group.
  const rows: Array<{ group_id: string; user_id: string; role: GroupRole }> = [
    { group_id: group.id, user_id: creatorId, role: 'owner' },
    ...memberIds
      .filter((id) => id !== creatorId)
      .map((id) => ({
        group_id: group.id,
        user_id: id,
        role: 'member' as GroupRole,
      })),
  ];
  const { error: mErr } = await supabase.from('group_members').insert(rows);
  if (!mErr) return group;

  // Fallback for older policies: insert creator alone first, then invitees.
  console.warn('[groups] batch insert failed, falling back', mErr);
  const { error: ownerErr } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: creatorId,
    role: 'owner',
  });
  if (ownerErr && ownerErr.code !== '23505') {
    console.error('[groups] create step2a (owner row)', ownerErr);
    throw new Error(humanize(ownerErr));
  }
  const invitees = memberIds
    .filter((id) => id !== creatorId)
    .map((id) => ({
      group_id: group.id,
      user_id: id,
      role: 'member' as GroupRole,
    }));
  if (invitees.length > 0) {
    const { error: invErr } = await supabase.from('group_members').insert(invitees);
    if (invErr) {
      console.error('[groups] create step2b (invitees)', invErr);
      throw new Error(humanize(invErr));
    }
  }
  return group;
}

// ------------------ Group updates -------------------------------------------

export async function updateGroup(
  groupId: string,
  patch: { name?: string; avatar_key?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', groupId);
  if (error) throw new Error(humanize(error));
}

export async function softDeleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', groupId);
  if (error) throw new Error(humanize(error));
}

// ------------------ Membership ---------------------------------------------

export async function addGroupMembers(
  groupId: string,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) return;
  const rows = memberIds.map((id) => ({
    group_id: groupId,
    user_id: id,
    role: 'member' as GroupRole,
  }));
  const { error } = await supabase.from('group_members').insert(rows);
  if (error && error.code !== '23505') throw new Error(humanize(error));
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(humanize(error));
}

export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<void> {
  // Only non-owner members can leave.
  return removeGroupMember(groupId, userId);
}

// ------------------ Messages ------------------------------------------------

export async function loadGroupMessages(
  groupId: string,
  limit = 300,
): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[groups] loadGroupMessages', error);
    return [];
  }
  return (data as GroupMessage[]) || [];
}

export async function sendGroupMessage(params: {
  groupId: string;
  userId: string;
  content: string;
  replyToMessageId?: string | null;
  // Per-message expiration timestamp, locked at send time. See
  // computeExpiresAt() in lib/ephemeral.ts. Once written on a group_messages
  // row, it is NEVER recomputed — changing the conversation's ephemeral
  // duration only affects messages sent AFTER the change.
  expiresAt?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {
    group_id: params.groupId,
    user_id: params.userId,
    content: params.content,
  };
  if (params.replyToMessageId) row.reply_to_message_id = params.replyToMessageId;
  if (params.expiresAt) {
    row.expires_at = params.expiresAt;
    row.is_ephemeral = true;
  }
  const { error } = await supabase.from('group_messages').insert(row);
  if (error) {
    // Retry without reply / ephemeral columns if they are missing.
    const { error: err2 } = await supabase.from('group_messages').insert({
      group_id: params.groupId,
      user_id: params.userId,
      content: params.content,
    });
    if (err2) throw new Error(humanize(err2));
  }
}

export async function deleteGroupMessageForEveryone(
  messageId: string,
  byUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('group_messages')
    .update({
      deleted_for_everyone_at: new Date().toISOString(),
      deleted_by: byUserId,
    })
    .eq('id', messageId);
  if (error) throw new Error(humanize(error));
}