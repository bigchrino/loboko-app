import { supabase } from '@/lib/supabase';

export interface ShopRatingRow {
  id: string;
  from_user_id: string;
  shop_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface RatingSummary {
  average: number;
  count: number;
}

export async function fetchShopRatingSummary(shopId: string): Promise<RatingSummary> {
  try {
    const { data, error } = await supabase
      .from('shop_ratings')
      .select('rating')
      .eq('shop_id', shopId);
    if (error) throw error;
    const rows = (data as { rating: number }[]) || [];
    if (rows.length === 0) return { average: 0, count: 0 };
    const sum = rows.reduce((a, r) => a + Number(r.rating), 0);
    return { average: sum / rows.length, count: rows.length };
  } catch (e) {
    console.error('fetchShopRatingSummary', e);
    return { average: 0, count: 0 };
  }
}

export async function fetchMyShopRating(
  fromUserId: string,
  shopId: string,
): Promise<ShopRatingRow | null> {
  try {
    const { data, error } = await supabase
      .from('shop_ratings')
      .select('*')
      .eq('from_user_id', fromUserId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw error;
    return (data as ShopRatingRow) || null;
  } catch (e) {
    console.error('fetchMyShopRating', e);
    return null;
  }
}

export async function submitShopRating(params: {
  fromUserId: string;
  shopId: string;
  rating: number;
  comment?: string;
}): Promise<ShopRatingRow> {
  const payload = {
    from_user_id: params.fromUserId,
    shop_id: params.shopId,
    rating: params.rating,
    comment: params.comment?.trim() || null,
  };
  const { data, error } = await supabase
    .from('shop_ratings')
    .upsert(payload, { onConflict: 'from_user_id,shop_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShopRatingRow;
}

export async function fetchShopRatingsList(
  shopId: string,
  limit = 20,
): Promise<ShopRatingRow[]> {
  try {
    const { data, error } = await supabase
      .from('shop_ratings')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as ShopRatingRow[]) || [];
  } catch (e) {
    console.error('fetchShopRatingsList', e);
    return [];
  }
}
