import { supabase } from './supabase';

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  color_key: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopColorOption {
  key: string;
  label: string;
  hex: string;
  premium: boolean;
}

/**
 * Palette de couleurs pour personnaliser une boutique. Les couleurs
 * `premium: true` sont réservées aux comptes Premium (même statut que
 * pour les prestataires — voir lib/subscription.ts).
 */
export const SHOP_COLORS: ShopColorOption[] = [
  { key: 'blue', label: 'Bleu', hex: '#2563eb', premium: false },
  { key: 'green', label: 'Vert', hex: '#16a34a', premium: false },
  { key: 'orange', label: 'Orange', hex: '#f59e0b', premium: false },
  { key: 'red', label: 'Rouge', hex: '#dc2626', premium: false },
  { key: 'purple', label: 'Violet', hex: '#9333ea', premium: true },
  { key: 'pink', label: 'Rose', hex: '#ec4899', premium: true },
  { key: 'teal', label: 'Turquoise', hex: '#0d9488', premium: true },
  { key: 'gold', label: 'Or', hex: '#ca8a04', premium: true },
  { key: 'black', label: 'Noir', hex: '#18181b', premium: true },
];

export function getShopColor(key: string): ShopColorOption {
  return SHOP_COLORS.find((c) => c.key === key) || SHOP_COLORS[0];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // enlève les accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'boutique'
  );
}

/** Récupère la boutique de l'utilisateur — une seule par personne. */
export async function fetchMyShop(userId: string): Promise<Shop | null> {
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as Shop) || null;
  } catch (e) {
    console.error('fetchMyShop', e);
    return null;
  }
}

export async function fetchShopBySlug(slug: string): Promise<Shop | null> {
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return (data as Shop) || null;
  } catch (e) {
    console.error('fetchShopBySlug', e);
    return null;
  }
}

/**
 * Crée une boutique. Réessaie avec un slug légèrement différent en cas de
 * collision (deux boutiques avec un nom très proche), plutôt que d'échouer
 * directement.
 */
export async function createShop(input: {
  owner_id: string;
  name: string;
  color_key: string;
  description?: string | null;
}): Promise<{ data: Shop | null; error: string | null }> {
  const base = slugify(input.name);
  let slug = base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('shops')
      .insert({
        owner_id: input.owner_id,
        name: input.name.trim(),
        slug,
        color_key: input.color_key,
        description: input.description || null,
      })
      .select('*')
      .single();

    if (!error) return { data: data as Shop, error: null };

    if (error.code === '23505') {
      // Collision d'unicité (slug déjà pris, ou déjà une boutique pour ce
      // compte) — on ne réessaie que si c'est le slug qui pose problème.
      if (error.message.includes('owner_id')) {
        return { data: null, error: 'Vous avez déjà une boutique.' };
      }
      slug = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
      continue;
    }

    console.error('createShop', error);
    return { data: null, error: error.message };
  }

  return {
    data: null,
    error: 'Impossible de créer la boutique pour le moment, réessayez.',
  };
}

export interface ShopProduct {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  image_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchShopProducts(shopId: string): Promise<ShopProduct[]> {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ShopProduct[]) || [];
  } catch (e) {
    console.error('fetchShopProducts', e);
    return [];
  }
}

export async function createProduct(input: {
  shop_id: string;
  name: string;
  description?: string | null;
  price: number;
  stock_quantity: number;
  image_key?: string | null;
}): Promise<{ data: ShopProduct | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .insert({
        shop_id: input.shop_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        price: input.price,
        stock_quantity: input.stock_quantity,
        image_key: input.image_key || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as ShopProduct, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('createProduct', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function updateProduct(
  productId: string,
  patch: Partial<
    Pick<ShopProduct, 'name' | 'description' | 'price' | 'stock_quantity' | 'image_key' | 'is_active'>
  >,
): Promise<{ data: ShopProduct | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .update(patch)
      .eq('id', productId)
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as ShopProduct, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('updateProduct', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function deleteProduct(productId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('shop_products').delete().eq('id', productId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteProduct', e);
    return false;
  }
}

export async function updateShop(
  shopId: string,
  patch: Partial<Pick<Shop, 'name' | 'color_key' | 'description'>>,
): Promise<{ data: Shop | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('shops')
      .update(patch)
      .eq('id', shopId)
      .select('*')
      .single();
    if (error) throw error;
    return { data: data as Shop, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('updateShop', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}
