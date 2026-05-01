import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addFavorite,
  FavoriteType,
  isFavorite,
  removeFavorite,
} from '@/lib/marketplace';
import { toast } from 'sonner';

/**
 * useFavoriteToggle — optimistic favorite toggle hook.
 *
 * Returns `{ favorited, toggling, toggle }`. Silently no-ops when the user is
 * not logged in, and reverts the optimistic state if the backend call fails.
 */
export function useFavoriteToggle(type: FavoriteType, targetId: string | null) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !targetId) {
      setFavorited(false);
      return;
    }
    (async () => {
      const v = await isFavorite(user.id, type, targetId);
      if (!cancelled) setFavorited(v);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, type, targetId]);

  const toggle = useCallback(async () => {
    if (!user) {
      toast.error('Connectez-vous pour enregistrer vos favoris.');
      return;
    }
    if (!targetId || toggling) return;
    setToggling(true);
    const prev = favorited;
    setFavorited(!prev);
    try {
      const ok = prev
        ? await removeFavorite(user.id, type, targetId)
        : await addFavorite(user.id, type, targetId);
      if (!ok) throw new Error('failed');
      toast.success(prev ? 'Retiré des favoris' : 'Ajouté aux favoris');
    } catch {
      setFavorited(prev);
      toast.error('Opération impossible. Réessayez.');
    } finally {
      setToggling(false);
    }
  }, [user, type, targetId, favorited, toggling]);

  return { favorited, toggling, toggle };
}