import { supabase } from '@/lib/supabase';

// Hard size limits (client-side guard). Supabase buckets may also enforce
// their own limit, but we want to fail fast with a clear message.
const MAX_SIZES: Record<string, number> = {
  avatars: 5 * 1024 * 1024, // 5 MB
  posts: 80 * 1024 * 1024, // 80 MB (videos allowed here)
  'voice-notes': 10 * 1024 * 1024, // 10 MB ~ several minutes of opus
  'message-media': 50 * 1024 * 1024, // 50 MB (short videos / photos)
  'message-documents': 25 * 1024 * 1024, // 25 MB (PDF, Word, Excel, ZIP)
  statuses: 50 * 1024 * 1024, // 50 MB (short videos / photos for stories)
};

export type UploadFolder =
  | 'avatars'
  | 'posts'
  | 'voice-notes'
  | 'message-media'
  | 'message-documents'
  | 'statuses';

export interface UploadResult {
  key: string | null;
  error: string | null;
}

/**
 * Upload a file to a Supabase Storage bucket. Returns a storage key of the
 * form "bucket::path" so the rest of the app can store a single string and
 * resolve it back later via `getMediaUrl`.
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
      const friendly = /not found|bucket/i.test(msg)
        ? `Bucket "${bucket}" introuvable. Créez-le dans Supabase Storage (voir MEDIA_SETUP.md).`
        : /row-level security|permission|not authorized/i.test(msg)
          ? `Permissions insuffisantes sur le bucket "${bucket}". Vérifiez les policies RLS (voir MEDIA_SETUP.md).`
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
 */
export async function getMediaUrl(storageKey?: string | null): Promise<string | null> {
  if (!storageKey) return null;
  try {
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

/**
 * Measure the duration (in seconds) of a video file locally in the browser.
 * Resolves with `null` if the browser cannot decode the file.
 */
export async function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.src = '';
      };
      video.onloadedmetadata = () => {
        const d = Number.isFinite(video.duration) ? video.duration : null;
        cleanup();
        resolve(d);
      };
      video.onerror = () => {
        cleanup();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}