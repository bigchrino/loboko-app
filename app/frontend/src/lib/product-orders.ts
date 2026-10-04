import { supabase } from './supabase';

export interface ProductOrder {
  id: string;
  client_id: string;
  shop_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'refunded';
  created_at: string;
  updated_at: string;
  payment_intents?: { status: string; amount: number; currency: string; exchange_rate: number; created_at: string }[];
}

/**
 * Passe une vraie commande produit : réserve le stock et crée la commande
 * en une seule opération sécurisée côté base (fonction place_product_order).
 * Le paiement reste en attente jusqu'à la vérification serveur CinetPay.
 */
export async function placeProductOrder(
  clientId: string,
  productId: string,
  quantity: number,
): Promise<{ data: ProductOrder | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('place_product_order', {
      p_client_id: clientId,
      p_product_id: productId,
      p_quantity: quantity,
    });
    if (error) throw error;
    return { data: data as ProductOrder, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('placeProductOrder', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

/**
 * Annule une commande produit en attente — remet automatiquement le
 * stock réservé (voir la fonction SQL cancel_product_order).
 */
export async function cancelProductOrder(
  orderId: string,
): Promise<{ data: ProductOrder | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('cancel_product_order', {
      p_order_id: orderId,
    });
    if (error) throw error;
    return { data: data as ProductOrder, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('cancelProductOrder', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function fetchMyProductOrders(clientId: string): Promise<ProductOrder[]> {
  try {
    const { data, error } = await supabase
      .from('product_orders')
      .select('*, payment_intents:product_payment_intents(status,amount,currency,exchange_rate,created_at)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ProductOrder[]) || [];
  } catch (e) {
    console.error('fetchMyProductOrders', e);
    return [];
  }
}

/** Une commande ne peut être terminée qu'après paiement vérifié et livraison. */
export async function completeProductOrder(
  orderId: string,
): Promise<{ data: ProductOrder | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('complete_product_order', {
      p_order_id: orderId,
    });
    if (error) throw error;
    return { data: data as ProductOrder, error: null };
  } catch (e) {
    const err = e as { message?: string };
    console.error('completeProductOrder', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function fetchShopProductOrders(shopId: string): Promise<ProductOrder[]> {
  try {
    const { data, error } = await supabase
      .from('product_orders')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ProductOrder[]) || [];
  } catch (e) {
    console.error('fetchShopProductOrders', e);
    return [];
  }
}
