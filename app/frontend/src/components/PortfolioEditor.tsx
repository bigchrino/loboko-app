import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import {
  addPortfolioMedia,
  deletePortfolioMedia,
  fetchProviderPortfolio,
  PORTFOLIO_MAX_ITEMS,
  PortfolioItem,
} from '@/lib/provider-portfolio';
import PortfolioMedia from './PortfolioMedia';

/**
 * PortfolioEditor
 *
 * Owner-only editor displayed on the prestataire's own profile page. Allows
 * adding and removing up to 12 photos/videos that will be shown to other
 * users on their public profile.
 */

interface Props {
  userId: string;
}

export default function PortfolioEditor({ userId }: Props) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await fetchProviderPortfolio(userId);
    setItems(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    reload();
  }, [userId, reload]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = PORTFOLIO_MAX_ITEMS - items.length;
    if (remaining <= 0) {
      toast.error(`Limite atteinte (${PORTFOLIO_MAX_ITEMS} médias maximum).`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    let added = 0;
    for (const f of toUpload) {
      const { item, error } = await addPortfolioMedia(userId, f);
      if (error) {
        toast.error(error);
      } else if (item) {
        added++;
      }
    }
    if (added > 0) {
      toast.success(
        added === 1 ? 'Média ajouté au portfolio' : `${added} médias ajoutés`,
      );
      await reload();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (item: PortfolioItem) => {
    if (!confirm('Supprimer ce média du portfolio ?')) return;
    const { ok, error } = await deletePortfolioMedia(item);
    if (!ok) {
      toast.error(error || 'Suppression impossible');
      return;
    }
    toast.success('Média supprimé');
    setItems((prev) => prev.filter((p) => p.id !== item.id));
  };

  const count = items.length;
  const full = count >= PORTFOLIO_MAX_ITEMS;

  return (
    <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold">Portfolio</h3>
          <p className="text-[11px] text-[var(--loboko-text-muted)]">
            Photos & vidéos de vos réalisations — {count}/{PORTFOLIO_MAX_ITEMS}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || full}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white text-xs font-semibold disabled:opacity-50"
        >
          <Plus size={14} />
          {uploading ? 'Envoi…' : 'Ajouter'}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--loboko-text-muted)]">
          Aucun média pour l'instant. Ajoutez jusqu'à {PORTFOLIO_MAX_ITEMS} photos ou
          vidéos pour mettre en avant vos réalisations.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((it) => (
            <div key={it.id} className="relative group">
              <PortfolioMedia item={it} />
              <button
                type="button"
                onClick={() => handleDelete(it)}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Supprimer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}