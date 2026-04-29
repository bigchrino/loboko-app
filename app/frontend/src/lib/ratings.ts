import { supabase } from '@/lib/supabase';

export interface RatingRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface RatingSummary {
  average: number;
  count: number;
}

export async function fetchRatingSummary(toUserId: string): Promise<RatingSummary> {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('to_user_id', toUserId);
    if (error) throw error;
    const rows = (data as { rating: number }[]) || [];
    if (rows.length === 0) return { average: 0, count: 0 };
    const sum = rows.reduce((a, r) => a + Number(r.rating), 0);
    return { average: sum / rows.length, count: rows.length };
  } catch (e) {
    console.error('fetchRatingSummary', e);
    return { average: 0, count: 0 };
  }
}

export async function fetchMyRating(
  fromUserId: string,
  toUserId: string,
): Promise<RatingRow | null> {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .maybeSingle();
    if (error) throw error;
    return (data as RatingRow) || null;
  } catch (e) {
    console.error('fetchMyRating', e);
    return null;
  }
}

export async function submitRating(params: {
  fromUserId: string;
  toUserId: string;
  rating: number;
  comment?: string;
}): Promise<RatingRow> {
  const payload = {
    from_user_id: params.fromUserId,
    to_user_id: params.toUserId,
    rating: params.rating,
    comment: params.comment?.trim() || null,
  };
  const { data, error } = await supabase
    .from('ratings')
    .upsert(payload, { onConflict: 'from_user_id,to_user_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RatingRow;
}

export async function fetchRatingsList(
  toUserId: string,
  limit = 20,
): Promise<RatingRow[]> {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('to_user_id', toUserId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as RatingRow[]) || [];
  } catch (e) {
    console.error('fetchRatingsList', e);
    return [];
  }
}