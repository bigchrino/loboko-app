import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { ArrowLeft, Ban, ShieldCheck, PauseCircle, Trash2 } from 'lucide-react';
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/settings');

  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUnblock, setConfirmUnblock] = useState<BlockedProfile | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState(false);

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

  /**
   * Désactivation temporaire — le compte disparaît des recherches et est
   * déconnecté immédiatement, mais se réactive tout seul dès la prochaine
   * connexion (voir AuthContext.tsx), sans action supplémentaire.
   */
  const handleDeactivate = async () => {
    if (!myId) return;
    setAccountActionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('user_id', myId);
      if (error) throw error;

      toast.success('Compte désactivé — reconnectez-vous quand vous voulez pour le réactiver.');
      await logout();
      navigate('/');
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
      setAccountActionLoading(false);
    }
  };

  /**
   * Suppression définitive — anonymise le profil (nom, photo, position...)
   * et bloque l'accès pour toujours. Note technique honnête : l'identifiant
   * de connexion Supabase lui-même n'est pas supprimé ici (ça demande une
   * clé serveur, jamais exposée côté app pour des raisons de sécurité) —
   * mais AuthContext.tsx refuse systématiquement l'accès à tout compte
   * marqué `deleted_at`, donc le compte est inutilisable dans les faits.
   */
  const handleDelete = async () => {
    if (!myId) return;
    setAccountActionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          deleted_at: new Date().toISOString(),
          display_name: 'Utilisateur supprimé',
          bio: null,
          metier: null,
          avatar_key: null,
          city: null,
          province: null,
          commune: null,
          latitude: null,
          longitude: null,
          availability_status: 'unavailable',
        })
        .eq('user_id', myId);
      if (error) throw error;

      toast.success('Compte supprimé définitivement.');
      await logout();
      navigate('/');
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
      setAccountActionLoading(false);
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

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--loboko-text-muted)] mt-6 mb-2">
        Compte
      </h2>
      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setConfirmDeactivate(true)}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition border-b border-[var(--loboko-border)]"
        >
          <PauseCircle size={18} className="text-[#f59e0b] shrink-0" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">Désactiver temporairement</div>
            <div className="text-xs text-[var(--loboko-text-muted)]">
              Votre profil disparaît des recherches. Il revient dès que vous vous reconnectez.
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition"
        >
          <Trash2 size={18} className="text-red-500 shrink-0" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-red-500">Supprimer définitivement</div>
            <div className="text-xs text-[var(--loboko-text-muted)]">
              Votre profil est effacé et l'accès à ce compte est bloqué pour toujours.
            </div>
          </div>
        </button>
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        title="Désactiver temporairement le compte ?"
        description="Vous serez déconnecté et votre profil disparaîtra des recherches. Reconnectez-vous à tout moment pour le réactiver automatiquement."
        confirmLabel="Désactiver"
        loading={accountActionLoading}
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer définitivement le compte ?"
        description="Cette action est irréversible : votre nom, votre photo et votre position seront effacés, et vous ne pourrez plus jamais vous reconnecter à ce compte."
        confirmLabel="Supprimer définitivement"
        destructive
        loading={accountActionLoading}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </Layout>
  );
}
