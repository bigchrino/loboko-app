import { getAppPreferences } from '@/lib/app-preferences';
import { supabase } from '@/lib/supabase';

export interface RecommendedService {
  service_id: string;
  service_name: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  provider_count: number;
  available_count: number;
  reason: 'search' | 'related' | 'discover';
}

export const normalizeServiceSearch = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_]/g, ' ').trim();
export const matchesServiceSearch = (query: string, ...values: string[]) => {
  const terms = normalizeServiceSearch(query).split(/\s+/).filter(Boolean);
  const text = normalizeServiceSearch(values.join(' '));
  return terms.every((term) => text.includes(term));
};

const recentEvents = new Map<string, number>();
export const recommendationCache = new Map<string, RecommendedService[]>();
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    recentEvents.clear();
    recommendationCache.clear();
  }
});

// Search/category signals are weak; selecting a precise service is stronger.
// Never send raw search text, location coordinates or another account's ID.
export async function recordServiceInterest(userId: string, serviceIds: string[],
  eventType: 'search' | 'category' | 'service') {
  const ids = [...new Set(serviceIds)].slice(0, 8);
  if (!userId || !ids.length || !getAppPreferences(userId).personalizedServices) return;
  const key = `${userId}:${eventType}:${[...ids].sort().join(',')}`;
  const now = Date.now();
  if (now - (recentEvents.get(key) ?? 0) < 30_000) return;
  recentEvents.set(key, now);
  if (recentEvents.size > 200) recentEvents.delete(recentEvents.keys().next().value!);
  try {
  const { error } = await supabase.rpc('record_service_interest', {
    service_ids: ids, event_type: eventType,
  });
  if (error) {
    recentEvents.delete(key);
    console.warn('Impossible de mettre à jour les suggestions', error.code);
  } else {
    recommendationCache.delete(userId);
  }
  } catch {
    recentEvents.delete(key);
  }
}

/** Delete only this account's service-interest signals, never posts or messages. */
export async function resetServiceInterests(userId: string) {
  if (!userId) throw new Error('Connexion requise');
  const { error } = await supabase.from('user_service_interests').delete().eq('user_id', userId);
  if (error) throw error;
  recommendationCache.delete(userId);
  for (const key of recentEvents.keys()) {
    if (key.startsWith(`${userId}:`)) recentEvents.delete(key);
  }
}
