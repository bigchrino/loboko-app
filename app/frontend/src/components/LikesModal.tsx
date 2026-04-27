import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';

interface Liker {
  user_id: string;
  username?: string;
  display_name?: string;
  avatar_key?: string;
  metier?: string;
  avatar_url?: string;
}

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
}

export default function LikesModal({ postId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data: likes, error } = await supabase
          .from('likes')
          .select('user_id, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const userIds = (likes || []).map((l: any) => l.user_id);
        if (userIds.length === 0) {
          setLikers([]);
          return;
        }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_key, metier')
          .in('user_id', userIds);
        const enriched: Liker[] = await Promise.all(
          (profiles || []).map(async (p: any) => {
            let avatar_url: string | undefined;
            if (p.avatar_key) {
              try {
                avatar_url = (await getMediaUrl(p.avatar_key)) || undefined;
              } catch {
                /* ignore */
              }
            }
            return { ...p, avatar_url };
          }),
        );
        setLikers(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, postId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <h3 className="font-semibold text-sm">Personnes qui ont aimé</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
          ) : likers.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">
              Personne n'a encore aimé cette publication.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--loboko-border)]">
              {likers.map((l) => {
                const name = l.display_name || l.username || 'Utilisateur';
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <li key={l.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {l.avatar_url ? (
                        <img src={l.avatar_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{name}</div>
                      <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                        {l.metier || `@${l.username || 'user'}`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}