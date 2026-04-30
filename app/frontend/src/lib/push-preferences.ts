/**
 * Per-user push preferences (DM / groups / mentions_only).
 * Persisted in `push_preferences` (see PUSH_NOTIFICATIONS_SETUP.md).
 */

import { supabase } from '@/lib/supabase';

export type PushPreferences = {
  dm_enabled: boolean;
  groups_enabled: boolean;
  mentions_only: boolean;
};

export const DEFAULT_PREFS: PushPreferences = {
  dm_enabled: true,
  groups_enabled: true,
  mentions_only: false,
};

export async function loadPushPreferences(userId: string): Promise<PushPreferences> {
  if (!userId) return DEFAULT_PREFS;
  try {
    const { data, error } = await supabase
      .from('push_preferences')
      .select('dm_enabled, groups_enabled, mentions_only')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_PREFS;
    return {
      dm_enabled: data.dm_enabled ?? true,
      groups_enabled: data.groups_enabled ?? true,
      mentions_only: data.mentions_only ?? false,
    };
  } catch (e) {
    console.error('[push-pref] load failed', e);
    return DEFAULT_PREFS;
  }
}

export async function savePushPreferences(
  userId: string,
  prefs: Partial<PushPreferences>,
): Promise<PushPreferences> {
  if (!userId) return DEFAULT_PREFS;
  const merged = { ...DEFAULT_PREFS, ...prefs };
  try {
    const { error } = await supabase
      .from('push_preferences')
      .upsert(
        {
          user_id: userId,
          dm_enabled: merged.dm_enabled,
          groups_enabled: merged.groups_enabled,
          mentions_only: merged.mentions_only,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) throw error;
    return merged;
  } catch (e) {
    console.error('[push-pref] save failed', e);
    return merged;
  }
}