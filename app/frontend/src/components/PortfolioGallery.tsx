import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  fetchProviderPortfolio,
  getPortfolioSignedUrl,
  PortfolioItem,
} from '@/lib/provider-portfolio';
import PortfolioMedia from './PortfolioMedia';

/**
 * PortfolioGallery
 *
 * Public read-only gallery displayed on a prestataire's profile. Media are
 * loaded through short-lived signed URLs from the private bucket. Clicking
 * an item opens a simple lightbox with a fresh signed URL.
 */

interface Props {
  userId: string;
}

export default function PortfolioGallery({ userId }: Props) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{
    item: PortfolioItem;
    url: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchProviderPortfolio(userId);
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openViewer = async (item: PortfolioItem) => {
    const signed = await getPortfolioSignedUrl(item.media_key, 120);
    if (!signed) return;
    setViewer({ item, url: signed });
  };

  if (loading) {
    return (
      <div className="text-center py-6 text-xs text-[var(--loboko-text-muted)]">
        Chargement du portfolio…
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-base font-bold mb-3">Portfolio ({items.length})</h3>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <PortfolioMedia key={it.id} item={it} onClick={() => openViewer(it)} />
        ))}
      </div>

      {viewer && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <button
            type="button"
            onClick={() => setViewer(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
          <div
            className="max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {viewer.item.media_type === 'video' ? (
              <video
                src={viewer.url}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[85vh] rounded-xl"
              />
            ) : (
              <img
                src={viewer.url}
                alt=""
                className="max-w-full max-h-[85vh] rounded-xl object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}