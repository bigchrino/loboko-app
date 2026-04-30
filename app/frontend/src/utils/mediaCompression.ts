/**
 * Client-side media optimization helpers.
 *
 * These utilities are intentionally minimal and safe:
 *  - compressImage(): downscale an image to a reasonable max size and
 *    re-encode it (JPEG/WebP) with quality 0.82. Falls back to the original
 *    file if anything goes wrong so we never block a legitimate send.
 *  - checkVideoSize(): enforce a hard upper bound on video uploads. No
 *    in-browser transcoding is attempted (too heavy on mobile). If the video
 *    is over the limit, the caller receives a friendly error message to show
 *    to the user.
 *
 * The goal is to reduce bandwidth on low-quality networks without changing
 * any existing message flow. Callers may ignore these helpers and behavior
 * stays identical to before.
 */

// Reasonable defaults for messaging: 1920px longest side is enough for a
// full-screen phone view while keeping payloads small on weak networks.
const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.82;

// Hard cap on video uploads, independent of the storage bucket\'s own limit.
// The current bucket "message-media" allows 50 MB server-side. We keep the
// same value here so users get a fast client-side rejection.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export interface CompressImageOptions {
  /** Max longest-side in pixels. Defaults to 1920. */
  maxDimension?: number;
  /** JPEG/WebP quality between 0 and 1. Defaults to 0.82. */
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
  // Fallback on extension if the browser didn\'t set a MIME type.
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
 * Compress an image to at most `maxDimension` on its longest side and
 * re-encode it as JPEG (or WebP for transparent PNGs). Returns the original
 * file unchanged when:
 *   - the file is not a compressible raster image (GIF, SVG, HEIC, …)
 *   - the image is already smaller than `maxDimension` and under 300 KB
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

    // Tiny images are not worth re-encoding — re-encoding can actually make
    // some small PNG icons larger.
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

    // Nothing to do: small picture, and we already skipped tiny files above.
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // PNG with transparency → keep as WebP (smaller + keeps alpha). Every
    // other case → JPEG.
    const outType =
      (file.type || '').toLowerCase() === 'image/png' ? 'image/webp' : 'image/jpeg';
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
  return `Vidéo trop volumineuse (${actual} Mo). Maximum ${mb} Mo. Choisissez une vidéo plus courte ou de meilleure qualité réduite.`;
}