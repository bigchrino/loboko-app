import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/mediaCompression';

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

    // Auto-compress large raster images at the upload layer. This benefits
    // every caller (posts, statuses, avatars, group avatars, message media)
    // without changing any call site. `compressImage` is a no-op for files
    // that are already small, animated, or not compressible — so behavior
    // stays identical in the worst case.
    let uploadFile = file;
    if ((file.type || '').startsWith('image/')) {
      try {
        uploadFile = await compressImage(file);
      } catch {
        uploadFile = file;
      }
    }

    const maxSize = MAX_SIZES[folder];
    if (maxSize && uploadFile.size > maxSize) {
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
    const ext = uploadFile.name.includes('.') ? uploadFile.name.split('.').pop() : 'bin';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, uploadFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: uploadFile.type || undefined,
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
 * Set of bucket IDs that are configured as **private** in Supabase
 * Storage. For these, we must never call `getPublicUrl` — it returns a URL
 * that won't be reachable without a signed token. Any caller that needs
 * temporary access to a file in a private bucket should use
 * `getSignedStorageUrl` instead and only at the moment of actual use
 * (typically on click, not at render time).
 */
const PRIVATE_BUCKETS: ReadonlySet<string> = new Set(['message-documents']);

/** Split a storage key "bucket::path" into its parts. */
function parseStorageKey(storageKey: string): { bucket: string; path: string } {
  let bucket = 'posts';
  let path = storageKey;
  if (storageKey.includes('::')) {
    const [b, ...rest] = storageKey.split('::');
    bucket = b;
    path = rest.join('::');
  }
  return { bucket, path };
}

/**
 * Resolve a storage key produced by `uploadMedia` into a browser-usable URL.
 *
 * For **public** buckets (`avatars`, `posts`, `message-media`, `voice-notes`,
 * `statuses`), this returns a standard public URL that can be placed in an
 * `<img>`/`<video>` tag.
 *
 * For **private** buckets (`message-documents`), this returns `null` — the
 * caller must use `getSignedStorageUrl` on demand instead. This prevents
 * rendering a dead public URL and forces the caller to generate a short-
 * lived signed URL only when the user explicitly asks for the file.
 */
export async function getMediaUrl(storageKey?: string | null): Promise<string | null> {
  if (!storageKey) return null;
  try {
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return storageKey;
    }
    const { bucket, path } = parseStorageKey(storageKey);
    if (PRIVATE_BUCKETS.has(bucket)) {
      // Private buckets never return a public URL. The caller must use
      // `getSignedStorageUrl` at click time.
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('getMediaUrl error', e);
    return null;
  }
}

/**
 * Create a short-lived signed URL for a storage key. Use this for private
 * buckets where direct access should only be granted at the moment the user
 * actually wants the file (e.g. clicks "Open" on a document).
 *
 * The default TTL is 60 seconds, which is enough for the browser to fetch
 * and download the file but short enough that an accidentally-shared URL
 * becomes useless almost immediately.
 *
 * Row Level Security on the bucket still applies: the signed URL endpoint
 * runs with the caller's auth context, so if RLS denies the SELECT, the
 * signed URL call itself will fail.
 */
export async function getSignedStorageUrl(
  storageKey: string | null | undefined,
  expiresInSeconds = 60,
): Promise<{ url: string | null; error: string | null }> {
  if (!storageKey) return { url: null, error: 'missing_key' };
  try {
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return { url: storageKey, error: null };
    }
    const { bucket, path } = parseStorageKey(storageKey);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error) {
      console.error('[getSignedStorageUrl] supabase error', error);
      const msg = error.message || '';
      const friendly = /not.?found|object/i.test(msg)
        ? 'Fichier introuvable.'
        : /row-level|not authorized|permission|denied/i.test(msg)
          ? "Accès refusé à ce fichier."
          : 'Lien temporaire indisponible.';
      return { url: null, error: friendly };
    }
    return { url: data?.signedUrl || null, error: null };
  } catch (e) {
    console.error('[getSignedStorageUrl] exception', e);
    return { url: null, error: 'Erreur inattendue.' };
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