import { useEffect, useState, useRef } from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';
import { getPortfolioSignedUrl, PortfolioItem } from '@/lib/provider-portfolio';

/**
 * PortfolioMedia
 *
 * Renders one portfolio item (image or video) using a short-lived signed URL
 * from the PRIVATE `provider-portfolio` bucket. The URL is generated only
 * when this component mounts (lazy), and refreshed if the component is
 * re-mounted. Signed URLs default to 60 seconds on the server, but we refresh
 * every 55 seconds for items that stay on screen to stay safe.
 */

interface Props {
  item: PortfolioItem;
  className?: string;
  /** When true, render the media inline; when false, show a placeholder only. */
  eager?: boolean;
  onClick?: () => void;
}

export default function PortfolioMedia({ item, className, eager = true, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!eager) return;
    let cancelled = false;

    const refresh = async () => {
      const signed = await getPortfolioSignedUrl(item.media_key, 60);
      if (cancelled) return;
      if (!signed) {
        setError(true);
        return;
      }
      setError(false);
      setUrl(signed);
    };

    refresh();
    // Refresh just before expiration while the component remains mounted.
    timerRef.current = window.setInterval(refresh, 55_000);
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [item.media_key, eager]);

  const base =
    className ||
    'w-full aspect-square rounded-xl overflow-hidden bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] relative';

  if (error) {
    return (
      <div className={base}>
        <div className="w-full h-full flex items-center justify-center text-[var(--loboko-text-muted)]">
          <ImageIcon size={20} />
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className={base}>
        <div className="w-full h-full animate-pulse bg-[var(--loboko-surface)]" />
      </div>
    );
  }

  if (item.media_type === 'video') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} group`}
      >
        <video
          src={url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play size={18} className="text-black ml-0.5" fill="currentColor" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className={base}>
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    </button>
  );
}