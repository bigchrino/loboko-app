import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { ArrowLeft, Ban, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { loadBlockedIds, unblockUser } from '@/lib/conversation-controls';

interface BlockedProfile {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
}

/**
 * Settings → Confidentialité.
 *
 * Jusqu'ici, bloquer quelqu'un (depuis une conversation) était à sens
 * unique : aucun endroit dans l'app ne permettait de voir qui on avait
 * bloqué, ni de le débloquer. Cette page comble ce trou.
 */
export default function BlockedContacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/settings');

  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUnblock, setConfirmUnblock] = useState<BlockedProfile | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const myId = user?.id || '';

  const load = async () => {
    if (!myId) return;
    setLoading(true);
    try {
      const ids = await loadBlockedIds(myId);
      const idList = Array.from(ids);
      if (idList.length === 0) {
        setBlocked([]);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_key')
        .in('user_id', idList);
      if (error) throw error;

      const list = (data as BlockedProfile[]) || [];
      const enriched = await Promise.all(
        list.map(async (p) => ({
          ...p,
          avatar_url: p.avatar_key ? await getMediaUrl(p.avatar_key) : null,
        })),
      );
      setBlocked(enriched);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger la liste des contacts bloqués');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const handleUnblock = async () => {
    if (!confirmUnblock || !myId) return;
    setUnblocking(true);
    try {
      await unblockUser(myId, confirmUnblock.user_id);
      toast.success(
        `${confirmUnblock.display_name || confirmUnblock.username} débloqué`,
      );
      setBlocked((cur) => cur.filter((p) => p.user_id !== confirmUnblock.user_id));
      setConfirmUnblock(null);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <Layout title="Confidentialité">
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-2xl font-bold mb-1 hidden lg:block">Confidentialité</h1>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] mb-4">
        <ShieldCheck size={20} className="text-[#2563eb] shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--loboko-text-secondary)]">
          Les personnes bloquées ne peuvent plus vous envoyer de messages, vous
          appeler, ni voir votre statut en ligne.
        </p>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--loboko-text-muted)] mb-2">
        Contacts bloqués
      </h2>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : blocked.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Ban size={22} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucun contact bloqué</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Les personnes que vous bloquez apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {blocked.map((p) => {
            const name = p.display_name || p.username;
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <li
                key={p.user_id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/u/${p.user_id}`)}
                  className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold shrink-0"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{name}</div>
                  <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                    @{p.username}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmUnblock(p)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)]"
                >
                  Débloquer
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmUnblock}
        title="Débloquer ce contact ?"
        description={
          confirmUnblock
            ? `${confirmUnblock.display_name || confirmUnblock.username} pourra à nouveau vous envoyer des messages et vous appeler.`
            : ''
        }
        confirmLabel="Débloquer"
        loading={unblocking}
        onCancel={() => setConfirmUnblock(null)}
        onConfirm={handleUnblock}
      />
    </Layout>
  );
}
