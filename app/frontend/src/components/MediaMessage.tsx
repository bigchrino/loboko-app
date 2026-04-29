import { useEffect, useState } from 'react';
import { getMediaUrl } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';

interface Props {
  kind: 'image' | 'video';
  objectKey: string;
  duration?: number;
}

/**
 * Render an image or video message bubble content. Resolves the Supabase
 * storage key into a public URL on mount.
 */
export default function MediaMessage({ kind, objectKey, duration }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(objectKey).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  if (!url) {
    return (
      <div className="w-56 h-40 rounded-lg bg-black/20 animate-pulse" aria-label="Chargement du média" />
    );
  }

  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt="photo"
          className="rounded-lg max-w-[260px] max-h-80 object-cover block"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <div className="relative">
      <video
        src={url}
        className="rounded-lg max-w-[280px] max-h-80 object-cover block bg-black"
        controls
        playsInline
        preload="metadata"
      />
      {duration != null && (
        <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}