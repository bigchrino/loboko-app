import { supabase } from '@/lib/supabase';

/**
 * Provider portfolio helpers.
 *
 * A prestataire can attach up to 12 work samples (photos / short videos) to
 * their profile. Media live in the `provider-portfolio` storage bucket under
 * `<user_id>/<filename>`, and an index row is stored in
 * `provider_portfolio (id, user_id, media_key, media_type, created_at)`.
 *
 * The 12-media limit is also enforced server-side by a trigger — this file
 * simply surfaces a nice error message before hitting the network.
 */

export const PORTFOLIO_MAX_ITEMS = 12;
export const PORTFOLIO_BUCKET = 'provider-portfolio';

export interface PortfolioItem {
  id: string;
  user_id: string;
  media_key: string;
  media_type: 'image' | 'video';
  created_at: string;
}

/**
 * Create a signed URL (short-lived) for a portfolio media. The bucket is
 * PRIVATE so we never expose public URLs; we mint a signed URL on demand
 * at render time.
 */
export async function getPortfolioSignedUrl(
  mediaKey: string,
  _expiresInSeconds = 60,
): Promise<string | null> {
  try {
    if (!mediaKey) return null;

    if (mediaKey.startsWith('http://') || mediaKey.startsWith('https://')) {
      return mediaKey;
    }

    const cleanKey = mediaKey.includes('::')
      ? mediaKey.split('::').slice(1).join('::')
      : mediaKey;

    const { data } = supabase.storage
      .from(PORTFOLIO_BUCKET)
      .getPublicUrl(cleanKey);

    return data?.publicUrl || null;
  } catch (e) {
    console.error('getPortfolioSignedUrl exception', e);
    return null;
  }
}
/** Fetch every portfolio item for a given provider, newest first.
 *
 * Only the index rows are returned — URLs are generated lazily via
 * `getPortfolioSignedUrl` at render time (see `PortfolioMedia` component).
 */
export async function fetchProviderPortfolio(
  userId: string,
): Promise<PortfolioItem[]> {
  try {
    const { data, error } = await supabase
      .from('provider_portfolio')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('fetchProviderPortfolio error', error);
      return [];
    }
    return (data as PortfolioItem[]) || [];
  } catch (e) {
    console.error('fetchProviderPortfolio exception', e);
    return [];
  }
}

/** Count existing items to pre-check the 12-item limit client-side. */
export async function countProviderPortfolio(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('provider_portfolio')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) {
      console.error('countProviderPortfolio error', error);
      return 0;
    }
    return count || 0;
  } catch (e) {
    console.error('countProviderPortfolio exception', e);
    return 0;
  }
}

/**
 * Upload a single media file to the portfolio bucket and insert its index
 * row. Returns the new item on success, or an error message on failure.
 *
 * The bucket is private — callers request a signed URL via
 * `getPortfolioSignedUrl` when they actually render the media.
 */
export async function addPortfolioMedia(
  userId: string,
  file: File,
): Promise<{ item: PortfolioItem | null; error: string | null }> {
  const mime = (file.type || '').toLowerCase();
  let kind: 'image' | 'video' | null = null;
  if (mime.startsWith('image/')) kind = 'image';
  else if (mime.startsWith('video/')) kind = 'video';
  else {
    const name = file.name.toLowerCase();
    if (/\.(jpe?g|png|webp)$/.test(name)) kind = 'image';
    else if (/\.(mp4|webm|mov)$/.test(name)) kind = 'video';
  }
  if (!kind) {
    return { item: null, error: 'Format non supporté (image ou vidéo uniquement).' };
  }

  // Pre-check the 12-item cap so users get an immediate toast.
  const current = await countProviderPortfolio(userId);
  if (current >= PORTFOLIO_MAX_ITEMS) {
    return {
      item: null,
      error: `Limite portfolio atteinte (${PORTFOLIO_MAX_ITEMS} médias maximum).`,
    };
  }

  // Path = <user_id>/<timestamp>-<safe_name>. Safe name keeps the extension
  // so the player can infer the format. RLS only allows upload under the
  // caller's own <user_id>/ folder.
  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
  const key = `${userId}/${Date.now()}-${safeBase}`;

  const { error: upErr } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(key, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upErr) {
    console.error('addPortfolioMedia upload error', upErr);
    return { item: null, error: 'Échec de l\'upload.' };
  }

  const { data, error } = await supabase
    .from('provider_portfolio')
    .insert({ user_id: userId, media_key: key, media_type: kind })
    .select('*')
    .single();
  if (error) {
    console.error('addPortfolioMedia insert error', error);
    // Clean up the orphan file if index insert failed.
    try {
      await supabase.storage.from(PORTFOLIO_BUCKET).remove([key]);
    } catch {
      /* best effort */
    }
    const msg = error.message?.includes('Limite portfolio')
      ? `Limite portfolio atteinte (${PORTFOLIO_MAX_ITEMS} médias maximum).`
      : 'Impossible d\'ajouter ce média.';
    return { item: null, error: msg };
  }

  return { item: data as PortfolioItem, error: null };
}

/** Delete one portfolio item (row + storage object). Owner-only by RLS. */
export async function deletePortfolioMedia(
  item: PortfolioItem,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    // Storage first: if the row is gone but the object isn't, we'd orphan.
    await supabase.storage.from(PORTFOLIO_BUCKET).remove([item.media_key]);
    const { error } = await supabase
      .from('provider_portfolio')
      .delete()
      .eq('id', item.id);
    if (error) {
      console.error('deletePortfolioMedia row error', error);
      return { ok: false, error: 'Impossible de supprimer ce média.' };
    }
    return { ok: true, error: null };
  } catch (e) {
    console.error('deletePortfolioMedia exception', e);
    return { ok: false, error: 'Erreur inattendue.' };
  }
}
