import { supabase } from './supabase';
import { getMediaUrl } from './storage-helpers';

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithProduct extends CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    stock_quantity: number;
    image_key: string | null;
    image_url?: string | null;
    is_active: boolean;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
  };
}

export async function fetchCart(userId: string): Promise<CartItemWithProduct[]> {
  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, shop_products!inner(*, shops!inner(id, name, slug))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data || []) as any[];
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const product = row.shop_products;
        const shop = product.shops;
        return {
          id: row.id,
          user_id: row.user_id,
          product_id: row.product_id,
          quantity: row.quantity,
          created_at: row.created_at,
          updated_at: row.updated_at,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            stock_quantity: product.stock_quantity,
            image_key: product.image_key,
            image_url: product.image_key ? await getMediaUrl(product.image_key) : null,
            is_active: product.is_active,
          },
          shop: { id: shop.id, name: shop.name, slug: shop.slug },
        } as CartItemWithProduct;
      }),
    );
    return enriched;
  } catch (e) {
    console.error('fetchCart', e);
    return [];
  }
}

/** Ajoute un produit au panier — augmente la quantité s'il y est déjà. */
export async function addToCart(
  userId: string,
  productId: string,
  quantity = 1,
): Promise<{ error: string | null }> {
  try {
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({
          quantity: existing.quantity + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) throw error;
      return { error: null };
    }

    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, product_id: productId, quantity });
    if (error) throw error;
    return { error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('addToCart', e);
    return { error: err?.message || 'Erreur inconnue' };
  }
}

export async function updateCartQuantity(
  cartItemId: string,
  quantity: number,
): Promise<boolean> {
  try {
    if (quantity <= 0) {
      const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
      if (error) throw error;
      return true;
    }
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', cartItemId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('updateCartQuantity', e);
    return false;
  }
}

export async function removeFromCart(cartItemId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('removeFromCart', e);
    return false;
  }
}
