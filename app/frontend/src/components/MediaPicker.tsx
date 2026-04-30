import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Video as VideoIcon, Film, X } from 'lucide-react';
import { toast } from 'sonner';
import { getVideoDuration } from '@/lib/storage-helpers';
import { compressImage, checkVideoSize } from '@/utils/mediaCompression';

export type MediaKind = 'image' | 'video';

export interface MediaSelection {
  file: File;
  kind: MediaKind;
  previewUrl: string; // object URL, caller must revoke when done
  duration?: number; // seconds, videos only
}

interface Props {
  /** Maximum video duration in seconds. */
  maxVideoSeconds: number;
  /** Called when user picks a valid media file. */
  onSelect: (media: MediaSelection) => void;
  /** Label for the button group. */
  compact?: boolean;
  disabled?: boolean;
}

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';

function detectKind(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const name = file.name.toLowerCase();
  if (/\.(jpg|jpeg|png|webp)$/.test(name)) return 'image';
  if (/\.(mp4|webm|mov)$/.test(name)) return 'video';
  return null;
}

/**
 * MediaPicker exposes four actions: pick photo from gallery, take photo with
 * camera, pick video from gallery, take video with camera. It also validates
 * size/format/duration and calls `onSelect` with a preview URL. Caller is
 * responsible for revoking the object URL after use.
 */
export default function MediaPicker({ maxVideoSeconds, onSelect, compact, disabled }: Props) {
  const galleryImgRef = useRef<HTMLInputElement>(null);
  const cameraImgRef = useRef<HTMLInputElement>(null);
  const galleryVidRef = useRef<HTMLInputElement>(null);
  const cameraVidRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);

  const handle = async (file: File, forcedKind?: MediaKind) => {
    if (busy) return;
    setBusy(true);
    try {
      const kind = forcedKind ?? detectKind(file);
      if (!kind) {
        toast.error('Format non supporté. Utilisez jpg, png, webp, mp4, webm ou mov.');
        return;
      }
      if (kind === 'video') {
        // Hard size cap first — rejecting early avoids a wasted metadata
        // decode on very large files on low-end devices.
        const sizeError = checkVideoSize(file);
        if (sizeError) {
          toast.error(sizeError);
          return;
        }
        const duration = await getVideoDuration(file);
        if (duration == null) {
          toast.error('Impossible de lire cette vidéo dans le navigateur.');
          return;
        }
        if (duration > maxVideoSeconds + 0.2) {
          toast.error(
            `Vidéo trop longue (${Math.ceil(duration)}s). Maximum ${maxVideoSeconds}s. Merci de la couper avant de l'envoyer.`,
          );
          return;
        }
        const previewUrl = URL.createObjectURL(file);
        onSelect({ file, kind, previewUrl, duration });
      } else {
        // Compress images client-side before upload. Falls back to the
        // original file if compression cannot run (unsupported format,
        // decode error, …), so behavior stays identical in the worst case.
        const compressed = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        onSelect({ file: compressed, kind, previewUrl });
      }
    } finally {
      setBusy(false);
    }
  };

  const resetInputs = () => {
    [galleryImgRef, cameraImgRef, galleryVidRef, cameraVidRef].forEach((r) => {
      if (r.current) r.current.value = '';
    });
  };

  useEffect(() => {
    return () => resetInputs();
  }, []);

  const baseBtn = compact
    ? 'w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center text-[var(--loboko-text)]'
    : 'flex items-center gap-1.5 px-3 py-2 rounded-full text-[#2563eb] hover:bg-[rgba(37,99,235,0.15)] transition text-sm font-medium';

  return (
    <div className={compact ? 'flex items-center gap-1.5' : 'flex items-center gap-1 flex-wrap'}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          resetInputs();
          galleryImgRef.current?.click();
        }}
        className={baseBtn}
        aria-label="Photo depuis la galerie"
        title="Photo (galerie)"
      >
        <ImageIcon size={compact ? 16 : 18} />
        {!compact && <span>Photo</span>}
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          resetInputs();
          cameraImgRef.current?.click();
        }}
        className={baseBtn}
        aria-label="Prendre une photo"
        title="Prendre une photo"
      >
        <Camera size={compact ? 16 : 18} />
        {!compact && <span>Caméra</span>}
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          resetInputs();
          galleryVidRef.current?.click();
        }}
        className={baseBtn}
        aria-label="Vidéo depuis la galerie"
        title="Vidéo (galerie)"
      >
        <Film size={compact ? 16 : 18} />
        {!compact && <span>Vidéo</span>}
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          resetInputs();
          cameraVidRef.current?.click();
        }}
        className={baseBtn}
        aria-label="Filmer une vidéo"
        title="Filmer"
      >
        <VideoIcon size={compact ? 16 : 18} />
        {!compact && <span>Filmer</span>}
      </button>

      <input
        ref={galleryImgRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f, 'image');
        }}
      />
      <input
        ref={cameraImgRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f, 'image');
        }}
      />
      <input
        ref={galleryVidRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f, 'video');
        }}
      />
      <input
        ref={cameraVidRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f, 'video');
        }}
      />
    </div>
  );
}

export { X as _MediaPickerCloseIcon };