// Helpers for ephemeral messages (auto-destruct) feature.
//
// See EPHEMERAL_MESSAGES_SETUP.md for the SQL schema this file relies on.
// All helpers are defensive: if the `conversation_settings` table does not
// exist yet (operator has not run the SQL), they return safe defaults
// (0 = disabled) and do NOT throw — so the rest of the messaging UI keeps
// working.

import { supabase } from '@/lib/supabase';

export type EphemeralScope = 'dm' | 'group';

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

/** Compute expires_at ISO string from now() + duration, or null if disabled. */
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