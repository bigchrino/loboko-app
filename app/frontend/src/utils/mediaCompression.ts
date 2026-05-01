/**
 * Client-side media optimization helpers.
 *
 * These utilities are intentionally minimal and safe:
 *  - compressImage(): downscale an image to a reasonable max size and
 *    re-encode it (JPEG/WebP) with quality 0.72. Falls back to the original
 *    file if anything goes wrong so we never block a legitimate send.
 *  - checkVideoSize(): enforce a hard upper bound on video uploads. No
 *    in-browser transcoding is attempted (too heavy on mobile). If the video
 *    is over the limit, the caller receives a friendly error message to show
 *    to the user.
 *
 * The goal is to reduce bandwidth on low-quality networks without changing
 * any existing message flow.
 */

// Defaults tuned for weak networks (3G/4G) while preserving good visual
// quality. 1280px longest side is enough for any phone / tablet screen, and
// quality 0.72 keeps photos visually clean while typically cutting file size
// by 4-8x.
const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_QUALITY = 0.72;

// Hard cap on video uploads. Aligned with the product brief: 15 MB max.
// The bucket may allow more server-side, but we want a fast client-side
// rejection with a clear error message.
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

// Hard cap on image uploads (post-compression). Aligned with the brief.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface CompressImageOptions {
  /** Max longest-side in pixels. Defaults to 1280. */
  maxDimension?: number;
  /** JPEG/WebP quality between 0 and 1. Defaults to 0.72. */
  quality?: number;
}

/**
 * Check whether a file looks like a compressible raster image. We avoid
 * touching SVG / GIF (animated) / HEIC because the browser cannot always
 * decode them reliably and re-encoding would break them.
 */
function isCompressibleImage(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg') return true;
  if (t === 'image/png') return true;
  if (t === 'image/webp') return true;
  // Fallback on extension if the browser didn't set a MIME type.
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(name);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode_failed'));
    img.src = url;
  });
}

/**
 * Detect whether a PNG image has any non-opaque pixel. We sample a small
 * downscaled version to keep this fast even on large pictures. If we find
 * any transparency, we keep the PNG as WebP (preserves alpha + still small).
 * Otherwise we convert to JPEG (smaller, no alpha needed).
 */
function hasTransparency(img: HTMLImageElement): boolean {
  try {
    const w = Math.min(64, img.width);
    const h = Math.min(64, img.height);
    if (!w || !h) return false;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Compress an image to at most `maxDimension` on its longest side and
 * re-encode it as JPEG (or WebP only when the source PNG has transparency).
 * Returns the original file unchanged when:
 *   - the file is not a compressible raster image (GIF, SVG, HEIC, …)
 *   - the image is tiny (< 300 KB) and already small enough
 *   - anything throws during canvas decode / encode
 *
 * Never throws — callers can use the result directly.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  try {
    if (!isCompressibleImage(file)) return file;
    const maxDim = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const quality = options.quality ?? DEFAULT_QUALITY;

    // Very small files: not worth re-encoding. Below 300 KB the bandwidth
    // savings are negligible and re-encoding can actually hurt quality.
    if (file.size < 300 * 1024) return file;

    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    const { width, height } = img;
    if (!width || !height) return file;

    const longest = Math.max(width, height);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Only keep WebP (with alpha) for PNGs that actually use transparency.
    // Opaque PNGs are re-encoded to JPEG (much smaller for photos).
    const srcType = (file.type || '').toLowerCase();
    const keepAlpha = srcType === 'image/png' && hasTransparency(img);
    const outType = keepAlpha ? 'image/webp' : 'image/jpeg';

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality);
    });
    if (!blob) return file;
    // If compression somehow produced a larger file, keep the original.
    if (blob.size >= file.size) return file;

    const ext = outType === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${ext}`, { type: outType });
  } catch (e) {
    console.warn('[mediaCompression] compressImage failed, using original', e);
    return file;
  }
}

/**
 * Validate a video file against the hard size cap. Returns a human-readable
 * error message if the file is too big, otherwise `null`.
 */
export function checkVideoSize(file: File, maxBytes = MAX_VIDEO_BYTES): string | null {
  if (file.size <= maxBytes) return null;
  const mb = (maxBytes / (1024 * 1024)).toFixed(0);
  const actual = (file.size / (1024 * 1024)).toFixed(1);
  return `Fichier trop volumineux (${actual} Mo). Maximum ${mb} Mo pour les vidéos.`;
}

/**
 * Validate an image file against the hard size cap (post-compression).
 * Returns a human-readable error message if the file is too big, otherwise
 * `null`.
 */
export function checkImageSize(file: File, maxBytes = MAX_IMAGE_BYTES): string | null {
  if (file.size <= maxBytes) return null;
  const mb = (maxBytes / (1024 * 1024)).toFixed(0);
  const actual = (file.size / (1024 * 1024)).toFixed(1);
  return `Fichier trop volumineux (${actual} Mo). Maximum ${mb} Mo pour les images.`;
}