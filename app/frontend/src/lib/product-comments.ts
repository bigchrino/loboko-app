import { supabase } from './supabase';
import { getMediaUrl, uploadMediaEx } from './storage-helpers';

export interface ProductComment {
  id: string;
  product_id: string;
  user_id: string;
  comment: string;
  photo_key: string | null;
  created_at: string;
}

export interface ProductCommentWithAuthor extends ProductComment {
  photo_url?: string | null;
  author?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export async function fetchProductComments(
  productId: string,
): Promise<ProductCommentWithAuthor[]> {
  try {
    const { data, error } = await supabase
      .from('product_comments')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data as ProductComment[]) || [];
    if (rows.length === 0) return [];

    // Les commentaires pointent vers auth.users (pas de clé étrangère
    // directe vers profiles), donc on récupère les profils séparément
    // plutôt que via une jointure PostgREST.
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, username, avatar_key')
      .in('user_id', userIds);

    const profileMap = new Map(
      ((profiles as any[]) || []).map((p) => [p.user_id, p]),
    );

    return Promise.all(
      rows.map(async (r) => {
        const p = profileMap.get(r.user_id);
        return {
          ...r,
          photo_url: r.photo_key ? await getMediaUrl(r.photo_key) : null,
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
    console.error('fetchProductComments', e);
    return [];
  }
}

export async function createProductComment(input: {
  product_id: string;
  user_id: string;
  comment: string;
  photoFile?: File | null;
}): Promise<{ data: ProductCommentWithAuthor | null; error: string | null }> {
  try {
    let photo_key: string | null = null;
    if (input.photoFile) {
      const { key, error } = await uploadMediaEx(input.photoFile, 'posts');
      if (error || !key) {
        return { data: null, error: error || "Échec de l'envoi de la photo" };
      }
      photo_key = key;
    }

    const { data, error } = await supabase
      .from('product_comments')
      .insert({
        product_id: input.product_id,
        user_id: input.user_id,
        comment: input.comment.trim(),
        photo_key,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      data: {
        ...(data as ProductComment),
        photo_url: photo_key ? await getMediaUrl(photo_key) : null,
      },
      error: null,
    };
  } catch (e) {
    const err = e as { message?: string };
    console.error('createProductComment', e);
    return { data: null, error: err?.message || 'Erreur inconnue' };
  }
}

export async function deleteProductComment(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('product_comments').delete().eq('id', commentId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteProductComment', e);
    return false;
  }
}
