import { supabase } from './supabase';
import { getMediaUrl } from './storage-helpers';

export type MusalaRequestType = 'emploi' | 'stage';

export interface MusalaRequest {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  request_type: MusalaRequestType;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MusalaRequestWithAuthor extends MusalaRequest {
  author?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export const MUSALA_TYPE_LABELS: Record<MusalaRequestType, string> = {
  emploi: "Recherche d'emploi",
  stage: 'Recherche de stage',
};

export async function fetchAllMusalaRequests(filter?: {
  requestType?: MusalaRequestType | null;
  query?: string;
}): Promise<MusalaRequestWithAuthor[]> {
  try {
    let q = supabase.from('musala_requests').select('*').eq('is_active', true);
    if (filter?.requestType) {
      q = q.eq('request_type', filter.requestType);
    }
    if (filter?.query && filter.query.trim()) {
      q = q.ilike('title', `%${filter.query.trim()}%`);
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data as MusalaRequest[]) || [];
    if (rows.length === 0) return [];

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, username, avatar_key')
      .in('user_id', userIds);
    const profileMap = new Map(((profiles as any[]) || []).map((p) => [p.user_id, p]));

    return Promise.all(
      rows.map(async (r) => {
        const p = profileMap.get(r.user_id);
        return {
          ...r,
          author: p
            ? {
                display_name: p.display_name,
                username: p.username,
                avatar_url: p.avatar_key ? await getMediaUrl(p.avatar_key) : null,
              }
            : null,
        };
      }),
    );
  } catch (e) {
    console.error('fetchAllMusalaRequests', e);
    return [];
  }
}

export async function fetchMyMusalaRequests(userId: string): Promise<MusalaRequest[]> {
  try {
    const { data, error } = await supabase
      .from('musala_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as MusalaRequest[]) || [];
  } catch (e) {
    console.error('fetchMyMusalaRequests', e);
    return [];
  }
}

export async function createMusalaRequest(input: {
  user_id: string;
  title: string;
  description?: string | null;
  request_type: MusalaRequestType;
  location?: string | null;
}): Promise<{ data: MusalaRequest | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('musala_requests')
      .insert({
        user_id: input.user_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        request_type: input.request_type,
        location: input.location?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as MusalaRequest, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('createMusalaRequest', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function updateMusalaRequest(
  requestId: string,
  patch: Partial<Pick<MusalaRequest, 'title' | 'description' | 'request_type' | 'location' | 'is_active'>>,
): Promise<{ data: MusalaRequest | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('musala_requests')
      .update(patch)
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as MusalaRequest, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('updateMusalaRequest', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function deleteMusalaRequest(requestId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('musala_requests').delete().eq('id', requestId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteMusalaRequest', e);
    return false;
  }
}
