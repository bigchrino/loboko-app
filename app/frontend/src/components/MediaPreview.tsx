import { X } from 'lucide-react';
import { MediaSelection } from '@/components/MediaPicker';
import { formatDuration } from '@/lib/message-format';

interface Props {
  media: MediaSelection;
  onRemove: () => void;
  className?: string;
}

/**
 * Display the pending media (image or short video) before the user confirms
 * sending/publishing.
 */
export default function MediaPreview({ media, onRemove, className = '' }: Props) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-[var(--loboko-border)] ${className}`}
    >
      {media.kind === 'image' ? (
        <img
          src={media.previewUrl}
          alt="aperçu"
          className="w-full max-h-80 object-cover"
        />
      ) : (
        <div className="relative">
          <video
            src={media.previewUrl}
            className="w-full max-h-80 object-cover bg-black"
            controls
            playsInline
          />
          {media.duration != null && (
            <span className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">
              {formatDuration(media.duration)}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
        aria-label="Retirer"
      >
        <X size={16} />
      </button>
    </div>
  );
}