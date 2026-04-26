import { client } from '@/lib/atoms-client';

const BUCKET = 'loboko-media';

export async function uploadMedia(file: File, prefix = 'media'): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'bin';
    const object_key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await client.storage.upload({
      bucket_name: BUCKET,
      object_key,
      file,
    });
    return object_key;
  } catch (e) {
    console.error('uploadMedia error', e);
    return null;
  }
}

export async function getMediaUrl(object_key?: string | null): Promise<string | null> {
  if (!object_key) return null;
  try {
    const res = await client.storage.getDownloadUrl({
      bucket_name: BUCKET,
      object_key,
    });
    return (res?.data?.download_url as string) || null;
  } catch (e) {
    console.error('getMediaUrl error', e);
    return null;
  }
}