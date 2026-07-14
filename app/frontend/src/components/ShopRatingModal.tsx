import { useEffect, useState } from 'react';
import { X, Star } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMyShopRating, submitShopRating } from '@/lib/shop-ratings';

interface ShopRatingModalProps {
  open: boolean;
  onClose: () => void;
  fromUserId: string;
  shopId: string;
  shopName: string;
  onSubmitted?: () => void;
}

export default function ShopRatingModal({
  open,
  onClose,
  fromUserId,
  shopId,
  shopName,
  onSubmitted,
}: ShopRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    (async () => {
      const existing = await fetchMyShopRating(fromUserId, shopId);
      if (existing) {
        setRating(existing.rating);
        setComment(existing.comment || '');
      } else {
        setRating(0);
        setComment('');
      }
      setLoaded(true);
    })();
  }, [open, fromUserId, shopId]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      toast.error('Choisissez une note de 1 à 5 étoiles');
      return;
    }
    setSaving(true);
    try {
      await submitShopRating({ fromUserId, shopId, rating, comment });
      toast.success('Merci pour votre avis !');
      onSubmitted?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de l\u2019envoi';
      console.error(e);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const display = hover || rating;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)]"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold mb-1">Noter {shopName}</h3>
        <p className="text-xs text-[var(--loboko-text-muted)] mb-5">
          Donnez votre avis sur cette boutique
        </p>

        {!loaded ? (
          <div className="text-center py-8 text-sm text-[var(--loboko-text-muted)]">
            Chargement...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 !bg-transparent !hover:bg-transparent hover:scale-110 transition"
                  aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                >
                  <Star
                    size={36}
                    color={display >= n ? '#f59e0b' : 'rgba(148,163,184,0.4)'}
                    fill={display >= n ? '#f59e0b' : 'none'}
                  />
                </button>
              ))}
            </div>

            <div className="text-center text-sm font-semibold mb-4 text-[var(--loboko-text-secondary)]">
              {rating > 0 ? `${rating}/5 étoile${rating > 1 ? 's' : ''}` : 'Sélectionnez une note'}
            </div>

            <label className="block text-xs font-semibold mb-1 text-[var(--loboko-text-secondary)]">
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Partagez votre expérience..."
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb] resize-none"
            />
            <div className="text-[10px] text-[var(--loboko-text-muted)] text-right mb-4">
              {comment.length}/500
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)] font-semibold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || rating < 1}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
