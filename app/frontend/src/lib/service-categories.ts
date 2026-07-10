import { supabase } from '@/lib/supabase';

/**
 * Service category system for LOBOKO.
 *
 * Prestataires must pick a category from `services_categories` instead of
 * writing a free-text `metier`. The `metier` column is kept as a legacy
 * fallback so older accounts keep rendering correctly.
 */

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface ServiceCategoryWithCount extends ServiceCategory {
  provider_count: number;
}
export interface Service {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  requires_verification?: boolean;
  created_at?: string;
}

export interface ServiceWithCategory extends Service {
  category?: ServiceCategory | null;
}

/** Fetch all active categories, sorted by name. */
export async function fetchActiveCategories(): Promise<ServiceCategory[]> {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      console.error('fetchActiveCategories error', error);
      return [];
    }
    return (data as ServiceCategory[]) || [];
  } catch (e) {
    console.error('fetchActiveCategories exception', e);
    return [];
  }
}

export async function fetchActiveServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('fetchActiveServices error', error);
      return [];
    }

    return (data as Service[]) || [];
  } catch (e) {
    console.error('fetchActiveServices exception', e);
    return [];
  }
}

export async function fetchServicesByCategory(
  categoryId: string,
): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('fetchServicesByCategory error', error);
      return [];
    }

    return (data as Service[]) || [];
  } catch (e) {
    console.error('fetchServicesByCategory exception', e);
    return [];
  }
}

export async function fetchServiceById(id: string): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('fetchServiceById error', error);
      return null;
    }

    return (data as Service) || null;
  } catch (e) {
    console.error('fetchServiceById exception', e);
    return null;
  }
}

/** Fetch one category by slug. */
export async function fetchCategoryBySlug(
  slug: string,
): Promise<ServiceCategory | null> {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('fetchCategoryBySlug error', error);
      return null;
    }
    return (data as ServiceCategory) || null;
  } catch (e) {
    console.error('fetchCategoryBySlug exception', e);
    return null;
  }
}

/** Fetch one category by id. */
export async function fetchCategoryById(
  id: string,
): Promise<ServiceCategory | null> {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('fetchCategoryById error', error);
      return null;
    }
    return (data as ServiceCategory) || null;
  } catch (e) {
    console.error('fetchCategoryById exception', e);
    return null;
  }
}

/**
 * Fetch categories with a count of prestataires attached to each.
 * Best-effort: if counting fails we still return categories with 0.
 *
 * IMPORTANT : les prestataires sont rattachés à un SERVICE précis
 * (`profiles.service_id`, ex: "Chauffeur"), pas directement à une
 * catégorie — `profiles.service_category_id` est un champ hérité que le
 * formulaire de profil actuel remet systématiquement à `null`. On compte
 * donc via les services (service_id -> category_id), pas via ce vieux champ.
 */
export async function fetchCategoriesWithCounts(): Promise<ServiceCategoryWithCount[]> {
  const categories = await fetchActiveCategories();
  if (categories.length === 0) return [];

  try {
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, category_id')
      .eq('is_active', true);
    if (servicesError) {
      console.error('fetchCategoriesWithCounts services error', servicesError);
      return categories.map((c) => ({ ...c, provider_count: 0 }));
    }
    const categoryByServiceId = new Map<string, string>();
    for (const s of (services || []) as { id: string; category_id: string }[]) {
      categoryByServiceId.set(s.id, s.category_id);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('service_id')
      .eq('role', 'prestataire')
      .not('service_id', 'is', null);
    if (error) {
      console.error('fetchCategoriesWithCounts count error', error);
      return categories.map((c) => ({ ...c, provider_count: 0 }));
    }
    const counts = new Map<string, number>();
    for (const row of (data as { service_id: string | null }[]) || []) {
      if (!row.service_id) continue;
      const catId = categoryByServiceId.get(row.service_id);
      if (!catId) continue;
      counts.set(catId, (counts.get(catId) || 0) + 1);
    }
    return categories.map((c) => ({
      ...c,
      provider_count: counts.get(c.id) || 0,
    }));
  } catch (e) {
    console.error('fetchCategoriesWithCounts exception', e);
    return categories.map((c) => ({ ...c, provider_count: 0 }));
  }
}

export interface ProviderProfile {
  id: string;
  user_id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  metier?: string | null;
  avatar_key?: string | null;
  role: 'client' | 'prestataire';
  service_category_id?: string | null;
  service_id?: string | null;
  created_at?: string;
  city?: string | null;
  province?: string | null;
  commune?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  availability_status?: 'available' | 'busy' | 'unavailable';
  completed_jobs_count?: number;
  is_verified?: boolean;
  subscription_type?: 'free' | 'premium';
  subscription_expires_at?: string | null;
}

export interface ProviderSearchFilters {
  /** Restrict to one category id. Undefined = all categories. */
  categoryId?: string;
  serviceId?: string;
  /** City filter (substring, case-insensitive). */
  city?: string;
  /** When true, only return providers with availability_status='available'. */
  availableOnly?: boolean;
  /** When true, only return providers with is_verified=true. */
  verifiedOnly?: boolean;
}

/**
 * Fetch all prestataires under a category — resolved via the precise
 * services that belong to it (see comment on fetchCategoriesWithCounts
 * above for why we can't query profiles.service_category_id directly).
 */
export async function fetchProvidersByCategory(
  categoryId: string,
): Promise<ProviderProfile[]> {
  try {
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id')
      .eq('category_id', categoryId)
      .eq('is_active', true);
    if (servicesError) {
      console.error('fetchProvidersByCategory (services) error', servicesError);
      return [];
    }
    const serviceIds = ((services || []) as { id: string }[]).map((s) => s.id);
    if (serviceIds.length === 0) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'prestataire')
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchProvidersByCategory error', error);
      return [];
    }
    return (data as ProviderProfile[]) || [];
  } catch (e) {
    console.error('fetchProvidersByCategory exception', e);
    return [];
  }
}

/** Fetch all prestataires linked to one precise service id (ex: "Chauffeur"). */
export async function fetchProvidersByService(
  serviceId: string,
): Promise<ProviderProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'prestataire')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchProvidersByService error', error);
      return [];
    }
    return (data as ProviderProfile[]) || [];
  } catch (e) {
    console.error('fetchProvidersByService exception', e);
    return [];
  }
}

/**
 * Fetch all prestataires matching the given filters. Used by the global
 * advanced search page. Rating-based filters are applied client-side (after
 * enrichment) because rating lives in a separate table.
 *
 * NOTE : cette fonction n'est appelée nulle part dans l'app pour l'instant.
 * Si vous la branchez un jour, sachez que `filters.categoryId` ne fonctionne
 * pas correctement (même souci que fetchProvidersByCategory avant sa
 * correction) — passez plutôt par `filters.serviceId`, ou reprenez la
 * logique "services de la catégorie -> service_id IN (...)" de
 * fetchProvidersByCategory ci-dessus.
 */
export async function fetchProviders(
  filters: ProviderSearchFilters = {},
): Promise<ProviderProfile[]> {
  try {
    let q = supabase.from('profiles').select('*').eq('role', 'prestataire');
    if (filters.serviceId) q = q.eq('service_id', filters.serviceId);
    if (filters.availableOnly) q = q.eq('availability_status', 'available');
    if (filters.verifiedOnly) q = q.eq('is_verified', true);
    if (filters.city && filters.city.trim()) {
      q = q.ilike('city', `%${filters.city.trim()}%`);
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) {
      console.error('fetchProviders error', error);
      return [];
    }
    return (data as ProviderProfile[]) || [];
  } catch (e) {
    console.error('fetchProviders exception', e);
    return [];
  }
}
