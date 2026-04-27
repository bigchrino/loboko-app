import { supabase } from '@/lib/supabase';

// Hard size limits (client-side guard). Supabase buckets may also enforce
// their own limit, but we want to fail fast with a clear message.
const MAX_SIZES: Record<string, number> = {
  avatars: 5 * 1024 * 1024, // 5 MB
  posts: 25 * 1024 * 1024, // 25 MB
  'voice-notes': 10 * 1024 * 1024, // 10 MB ~ several minutes of opus
};

export type UploadFolder = 'avatars' | 'posts' | 'voice-notes';

export interface UploadResult {
  key: string | null;
  error: string | null;
}

/**
 * Upload a file to a Supabase Storage bucket. Returns a storage key of the
 * form "bucket::path" so the rest of the app can store a single string and
 * resolve it back later via `getMediaUrl`.
 *
 * Legacy signature returns just the key string (or null). Prefer `uploadMediaEx`
 * for callers that need the error message for user feedback.
 */
export async function uploadMedia(
  file: File,
  folder: UploadFolder,
): Promise<string | null> {
  const { key } = await uploadMediaEx(file, folder);
  return key;
}

export async function uploadMediaEx(
  file: File,
  folder: UploadFolder,
): Promise<UploadResult> {
  try {
    const bucket = folder;

    const maxSize = MAX_SIZES[folder];
    if (maxSize && file.size > maxSize) {
      const mb = (maxSize / (1024 * 1024)).toFixed(0);
      return { key: null, error: `Fichier trop volumineux (max ${mb} Mo)` };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return { key: null, error: 'Vous devez être connecté pour envoyer un fichier.' };
    }
    const userId = user.id;
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      console.error('[uploadMedia] supabase error', { bucket, path, error });
      const msg = error.message || 'Upload failed';
      // Hint on the most common cause: missing bucket / RLS.
      const friendly = /not found|bucket/i.test(msg)
        ? `Bucket "${bucket}" introuvable. Créez-le dans Supabase Storage.`
        : /row-level security|permission|not authorized/i.test(msg)
          ? `Permissions insuffisantes sur le bucket "${bucket}". Vérifiez les policies RLS.`
          : msg;
      return { key: null, error: friendly };
    }
    return { key: `${bucket}::${path}`, error: null };
  } catch (e) {
    console.error('[uploadMedia] exception', e);
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return { key: null, error: msg };
  }
}

/**
 * Resolve a storage key produced by `uploadMedia` into a browser-usable URL.
 * Buckets are public by default for simplicity; signed URLs could be added
 * later if needed.
 */
export async function getMediaUrl(storageKey?: string | null): Promise<string | null> {
  if (!storageKey) return null;
  try {
    // Full URL already -> return as-is
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return storageKey;
    }
    let bucket = 'posts';
    let path = storageKey;
    if (storageKey.includes('::')) {
      const [b, ...rest] = storageKey.split('::');
      bucket = b;
      path = rest.join('::');
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('getMediaUrl error', e);
    return null;
  }
}