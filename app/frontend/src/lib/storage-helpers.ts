import { supabase } from '@/lib/supabase';

/**
 * Upload a file to a Supabase Storage bucket. Returns a storage key of the
 * form "bucket::path" so the rest of the app can store a single string and
 * resolve it back later via `getMediaUrl`.
 */
export async function uploadMedia(
  file: File,
  folder: 'avatars' | 'posts' | 'voice-notes',
): Promise<string | null> {
  try {
    const bucket = folder;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || 'anon';
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      console.error('uploadMedia error', error);
      return null;
    }
    return `${bucket}::${path}`;
  } catch (e) {
    console.error('uploadMedia exception', e);
    return null;
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