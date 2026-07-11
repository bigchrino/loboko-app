import { supabase } from '@/lib/supabase';

/**
 * Marketplace helpers — provider_works, service_requests, favorites.
 *
 * All reads are paginated (PAGE_SIZE items) and ordered by created_at DESC.
 * Favorites are indexed on (user_id, type) to stay cheap on mobile.
 */

export const MARKETPLACE_PAGE_SIZE = 20;

// ----- Types ----------------------------------------------------------

export interface ProviderWork {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  city: string | null;
  media_key: string;
  media_type: 'image' | 'video';
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category_id: string | null;
  city: string | null;
  budget: string | null;
  is_urgent: boolean;
  status: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
}

export interface ServiceRequestResponse {
  id: string;
  request_id: string;
  provider_id: string;
  message: string;
  price_offer: string | null;
  created_at: string;
}

export type FavoriteType = 'provider' | 'work' | 'service';

export interface FavoriteRow {
  id: string;
  user_id: string;
  type: FavoriteType;
  target_id: string;
  created_at: string;
}

// ----- Provider works -------------------------------------------------

export interface WorksFilter {
  categoryId?: string | null;
  city?: string | null;
  userId?: string | null;
  /** Recherche texte sur le titre et la description (côté serveur). */
  query?: string | null;
}

export async function fetchWorks(
  page: number,
  filter: WorksFilter = {},
): Promise<ProviderWork[]> {
  try {
    let q = supabase
      .from('provider_works')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * MARKETPLACE_PAGE_SIZE, page * MARKETPLACE_PAGE_SIZE + MARKETPLACE_PAGE_SIZE - 1);
    if (filter.categoryId) q = q.eq('category_id', filter.categoryId);
    if (filter.city) q = q.eq('city', filter.city);
    if (filter.userId) q = q.eq('user_id', filter.userId);
    if (filter.query && filter.query.trim()) {
      const term = filter.query.trim().replace(/[%,]/g, ' ');
      q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as ProviderWork[]) || [];
  } catch (e) {
    console.error('fetchWorks', e);
    return [];
  }
}

export async function createWork(input: {
  user_id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  city?: string | null;
  media_key: string;
  media_type: 'image' | 'video';
}): Promise<{ data: ProviderWork | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('provider_works')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as ProviderWork, error: null };
  } catch (e) {
    console.error('createWork', e);
    const err = e as { message?: string; details?: string; hint?: string };
    const message =
      [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ') ||
      'Erreur inconnue';
    return { data: null, error: message };
  }
}

export async function deleteWork(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('provider_works').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteWork', e);
    return false;
  }
}

// ----- Service requests ----------------------------------------------

export interface RequestsFilter {
  categoryId?: string | null;
  city?: string | null;
  urgentOnly?: boolean;
  status?: 'open' | 'closed' | 'all';
  userId?: string | null;
}

export async function fetchRequests(
  page: number,
  filter: RequestsFilter = {},
): Promise<ServiceRequest[]> {
  try {
    let q = supabase
      .from('service_requests')
      .select('*')
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * MARKETPLACE_PAGE_SIZE, page * MARKETPLACE_PAGE_SIZE + MARKETPLACE_PAGE_SIZE - 1);
    if (filter.categoryId) q = q.eq('category_id', filter.categoryId);
    if (filter.city) q = q.eq('city', filter.city);
    if (filter.urgentOnly) q = q.eq('is_urgent', true);
    if (filter.userId) q = q.eq('user_id', filter.userId);
    if (!filter.status || filter.status === 'open') q = q.eq('status', 'open');
    else if (filter.status === 'closed') q = q.eq('status', 'closed');
    const { data, error } = await q;
    if (error) throw error;
    return (data as ServiceRequest[]) || [];
  } catch (e) {
    console.error('fetchRequests', e);
    return [];
  }
}

export async function fetchRequestById(id: string): Promise<ServiceRequest | null> {
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as ServiceRequest) || null;
  } catch (e) {
    console.error('fetchRequestById', e);
    return null;
  }
}

export async function countUserRequestsLast24h(userId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error('countUserRequestsLast24h', e);
    return 0;
  }
}

export const MAX_REQUESTS_PER_DAY = 5;

export async function createRequest(input: {
  user_id: string;
  title: string;
  description: string;
  category_id?: string | null;
  city?: string | null;
  budget?: string | null;
  is_urgent?: boolean;
}): Promise<{ ok: true; data: ServiceRequest } | { ok: false; error: string }> {
  const used = await countUserRequestsLast24h(input.user_id);
  if (used >= MAX_REQUESTS_PER_DAY) {
    return {
      ok: false,
      error: `Limite atteinte : ${MAX_REQUESTS_PER_DAY} demandes maximum par 24h.`,
    };
  }
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        ...input,
        is_urgent: !!input.is_urgent,
        status: 'open',
      })
      .select('*')
      .single();
    if (error) throw error;
    return { ok: true, data: data as ServiceRequest };
  } catch (e) {
    console.error('createRequest', e);
    return { ok: false, error: 'Erreur lors de la création de la demande.' };
  }
}

export async function closeRequest(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('service_requests')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('closeRequest', e);
    return false;
  }
}

export async function reopenRequest(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('service_requests')
      .update({ status: 'open', closed_at: null })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('reopenRequest', e);
    return false;
  }
}

export async function deleteRequest(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('service_requests').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteRequest', e);
    return false;
  }
}

// ----- Request responses ----------------------------------------------

export async function fetchResponses(requestId: string): Promise<ServiceRequestResponse[]> {
  try {
    const { data, error } = await supabase
      .from('service_request_responses')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ServiceRequestResponse[]) || [];
  } catch (e) {
    console.error('fetchResponses', e);
    return [];
  }
}

export async function createResponse(input: {
  request_id: string;
  provider_id: string;
  message: string;
  price_offer?: string | null;
}): Promise<ServiceRequestResponse | null> {
  try {
    const { data, error } = await supabase
      .from('service_request_responses')
      .upsert(input, { onConflict: 'request_id,provider_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as ServiceRequestResponse;
  } catch (e) {
    console.error('createResponse', e);
    return null;
  }
}

// ----- Favorites ------------------------------------------------------

export async function isFavorite(
  userId: string,
  type: FavoriteType,
  targetId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('target_id', targetId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) {
    console.error('isFavorite', e);
    return false;
  }
}

export async function addFavorite(
  userId: string,
  type: FavoriteType,
  targetId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('favorites')
      .upsert(
        { user_id: userId, type, target_id: targetId },
        { onConflict: 'user_id,type,target_id' },
      );
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('addFavorite', e);
    return false;
  }
}

export async function removeFavorite(
  userId: string,
  type: FavoriteType,
  targetId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('type', type)
      .eq('target_id', targetId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('removeFavorite', e);
    return false;
  }
}

export async function listFavorites(
  userId: string,
  type: FavoriteType,
): Promise<FavoriteRow[]> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as FavoriteRow[]) || [];
  } catch (e) {
    console.error('listFavorites', e);
    return [];
  }
}

// ----- Recommendation scoring ----------------------------------------

/**
 * Deterministic score: avg_rating * log10(1 + review_count)
 * boosted by availability and completed jobs. Higher = better.
 *
 * No random logic — consistent ranking across renders.
 */
export function scoreProvider(p: {
  rating_avg?: number | null;
  rating_count?: number | null;
  availability_status?: string | null;
  completed_jobs_count?: number | null;
  is_verified?: boolean | null;
}): number {
  const avg = Number(p.rating_avg || 0);
  const count = Number(p.rating_count || 0);
  const jobs = Number(p.completed_jobs_count || 0);
  const available = p.availability_status === 'available' ? 1 : 0;
  const verified = p.is_verified ? 1 : 0;
  const base = avg * Math.log10(1 + count); // volume-adjusted rating
  return base + 0.3 * available + 0.1 * Math.log10(1 + jobs) + 0.15 * verified;
}
