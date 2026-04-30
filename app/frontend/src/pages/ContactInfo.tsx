import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Profile, useAuth } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { useCall } from '@/contexts/CallContext';
import {
  ArrowLeft,
  Phone,
  Video,
  Search,
  Image as ImageIcon,
  Star,
  Palette,
  Clock,
  Lock,
  Users,
  Heart,
  Eraser,
  Ban,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  blockUser,
  clearConversation,
  loadBlockedIds,
  unblockUser,
} from '@/lib/conversation-controls';
import { decodePayload } from '@/lib/message-format';
import {
  broadcastDmEphemeral,
  durationShort,
  loadDmEphemeralDuration,
  setDmEphemeralDuration,
  subscribeDmEphemeral,
} from '@/lib/ephemeral';
import EphemeralSettingsDialog from '@/components/EphemeralSettingsDialog';

interface MediaItem {
  kind: 'image' | 'video';
  objectKey: string;
  url?: string | null;
}

/**
 * Contact info page - shown when tapping the avatar/name in a conversation.
 * Layout is intentionally read-focused; sections like "Messages importants",
 * "Thème de la discussion" etc. are listed with a coming-soon behavior so the
 * screen is complete without blocking Phase 1 scope.
 */
export default function ContactInfo() {
  const { userId: peerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startCall } = useCall();
  const myId = user?.id || '';

  const [peer, setPeer] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openEphemeral, setOpenEphemeral] = useState(false);
  const [ephemeralDuration, setEphemeralDuration] = useState<number>(0);

  useEffect(() => {
    (async () => {
      if (!peerId || !myId) {
        setLoading(false);
        return;
      }
      try {
        // Profile
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', peerId)
          .maybeSingle();
        if (p) {
          setPeer(p as Profile);
          if ((p as Profile).avatar_key) {
            const url = await getMediaUrl((p as Profile).avatar_key!);
            setAvatarUrl(url);
          }
        }

        // Block status
        const bSet = await loadBlockedIds(myId);
        setBlocked(bSet.has(peerId));

        // Media extracted from exchanged messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('content')
          .or(
            `and(user_id.eq.${myId},receiver_id.eq.${peerId}),and(user_id.eq.${peerId},receiver_id.eq.${myId})`,
          )
          .order('created_at', { ascending: false })
          .limit(200);
        const items: MediaItem[] = [];
        (msgs || []).forEach((m: { content: string }) => {
          const payload = decodePayload(m.content);
          if (payload.kind === 'image') {
            items.push({ kind: 'image', objectKey: payload.object_key });
          } else if (payload.kind === 'video') {
            items.push({ kind: 'video', objectKey: payload.object_key });
          }
        });
        const limited = items.slice(0, 12);
        await Promise.all(
          limited.map(async (it) => {
            try {
              it.url = await getMediaUrl(it.objectKey);
            } catch {
              /* ignore */
            }
          }),
        );
        setMedia(limited);
      } catch (e) {
        console.error('[contact-info] load', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [peerId, myId]);

  // Load the current ephemeral duration for this 1-to-1 conversation and
  // listen to realtime updates broadcast by the peer so the row reflects
  // the current duration without needing to reload the page.
  useEffect(() => {
    if (!myId || !peerId) {
      setEphemeralDuration(0);
      return;
    }
    let cancelled = false;
    loadDmEphemeralDuration(myId, peerId).then((d) => {
      if (!cancelled) setEphemeralDuration(d);
    });
    const unsub = subscribeDmEphemeral(myId, peerId, ({ durationSeconds }) => {
      if (cancelled) return;
      setEphemeralDuration(durationSeconds);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [myId, peerId]);

  const handleEphemeralConfirm = async (durationSeconds: number) => {
    if (!myId || !peerId) return;
    try {
      await setDmEphemeralDuration(myId, peerId, durationSeconds);
      setEphemeralDuration(durationSeconds);
      // Notify the peer in realtime so their conversation header and info
      // page update immediately.
      broadcastDmEphemeral(myId, peerId, durationSeconds).catch(() => {});
      if (durationSeconds > 0) {
        toast.success(
          `Messages éphémères activés (${durationShort(durationSeconds)})`,
        );
      } else {
        toast.success('Messages éphémères désactivés');
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    }
  };

  const peerName = useMemo(
    () => peer?.display_name || peer?.username || 'Utilisateur',
    [peer],
  );
  const initials = peerName.slice(0, 2).toUpperCase();

  const doCall = async (mode: 'voice' | 'video') => {
    if (!peerId) return;
    await startCall(peerId, peerName, mode);
  };

  const goSearch = () => {
    if (!peerId) return;
    navigate(`/messages?to=${peerId}&search=1`);
  };

  const handleClear = async () => {
    if (!peerId || !myId) return;
    setBusy(true);
    try {
      await clearConversation(myId, peerId);
      toast.success('Discussion effacée');
      setConfirmClear(false);
      navigate(`/messages?to=${peerId}`);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const handleBlock = async () => {
    if (!peerId || !myId) return;
    setBusy(true);
    try {
      await blockUser(myId, peerId);
      setBlocked(true);
      toast.success('Contact bloqué');
      setConfirmBlock(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (!peerId || !myId) return;
    setBusy(true);
    try {
      await unblockUser(myId, peerId);
      setBlocked(false);
      toast.success('Contact débloqué');
      setConfirmUnblock(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const comingSoon = (label: string) =>
    toast.message(`${label} : bientôt disponible`);

  return (
    <Layout title="Infos du contact">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
        >
          <ArrowLeft size={16} />
          Retour
        </button>

        {loading ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Chargement…
          </div>
        ) : !peer ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Contact introuvable
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header card */}
            <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-6 flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-3xl">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={peerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <h2 className="font-semibold text-lg mt-3">{peerName}</h2>
              {peer.username && (
                <div className="text-xs text-[var(--loboko-text-muted)] mt-0.5">
                  @{peer.username}
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => doCall('voice')}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
                >
                  <Phone size={18} className="text-[#2563eb]" />
                  <span className="text-[11px]">Audio</span>
                </button>
                <button
                  type="button"
                  onClick={() => doCall('video')}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
                >
                  <Video size={18} className="text-[#2563eb]" />
                  <span className="text-[11px]">Vidéo</span>
                </button>
                <button
                  type="button"
                  onClick={goSearch}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)]"
                >
                  <Search size={18} className="text-[#2563eb]" />
                  <span className="text-[11px]">Rechercher</span>
                </button>
              </div>

              <Link
                to={`/u/${peer.user_id}`}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#2563eb] hover:underline"
              >
                <ExternalLink size={14} />
                Voir son profil public LOBOKO
              </Link>
            </div>

            {/* Media */}
            <section className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ImageIcon size={14} /> Médias
                </h3>
                <span className="text-xs text-[var(--loboko-text-muted)]">
                  {media.length === 0 ? 'Aucun' : media.length}
                </span>
              </div>
              {media.length === 0 ? (
                <p className="text-xs text-[var(--loboko-text-muted)]">
                  Aucun média partagé dans cette conversation
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {media.map((it, idx) => (
                    <div
                      key={idx}
                      className="aspect-square rounded-lg overflow-hidden bg-[var(--loboko-elevated)]"
                    >
                      {it.url ? (
                        it.kind === 'image' ? (
                          <img
                            src={it.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={it.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Feature list (sections stubs) */}
            <section className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
              {[
                { key: 'important', label: 'Messages importants', icon: Star },
                { key: 'theme', label: 'Thème de la discussion', icon: Palette },
                { key: 'ephemeral', label: 'Messages éphémères', icon: Clock },
                { key: 'lock', label: 'Verrouiller la discussion', icon: Lock },
                {
                  key: 'group',
                  label: 'Créer un groupe avec cette personne',
                  icon: Users,
                },
                { key: 'favorite', label: 'Ajouter aux favoris', icon: Heart },
              ].map(({ key, label, icon: Icon }) => {
                const isEphemeral = key === 'ephemeral';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      isEphemeral ? setOpenEphemeral(true) : comingSoon(label)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--loboko-surface-hover)] border-b border-[var(--loboko-border)] last:border-b-0"
                  >
                    <Icon size={18} className="text-[#2563eb] shrink-0" />
                    <span className="text-sm flex-1">{label}</span>
                    {isEphemeral && ephemeralDuration > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(37,99,235,0.18)] text-[#60a5fa] font-semibold">
                        {durationShort(ephemeralDuration)}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-[var(--loboko-text-muted)]" />
                  </button>
                );
              })}
            </section>

            {/* Destructive section */}
            <section className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--loboko-surface-hover)] border-b border-[var(--loboko-border)]"
              >
                <Eraser size={18} className="text-red-400 shrink-0" />
                <span className="text-sm flex-1 text-red-400">Effacer la discussion</span>
                <ChevronRight size={16} className="text-[var(--loboko-text-muted)]" />
              </button>
              <button
                type="button"
                onClick={() => (blocked ? setConfirmUnblock(true) : setConfirmBlock(true))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--loboko-surface-hover)]"
              >
                <Ban size={18} className="text-red-400 shrink-0" />
                <span className="text-sm flex-1 text-red-400">
                  {blocked ? 'Débloquer' : 'Bloquer'}
                </span>
                <ChevronRight size={16} className="text-[var(--loboko-text-muted)]" />
              </button>
            </section>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Effacer la discussion ?"
        description="Cette action effacera tous les messages de cette conversation pour vous. Votre contact pourra toujours voir les messages de son côté."
        confirmLabel="Effacer"
        destructive
        loading={busy}
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={confirmBlock}
        title={`Bloquer ${peerName} ?`}
        description="Cette personne ne pourra plus vous contacter ni voir votre activité. Vous pouvez la débloquer à tout moment."
        confirmLabel="Bloquer"
        destructive
        loading={busy}
        onConfirm={handleBlock}
        onCancel={() => setConfirmBlock(false)}
      />
      <ConfirmDialog
        open={confirmUnblock}
        title={`Débloquer ${peerName} ?`}
        description="Cette personne pourra à nouveau vous contacter."
        confirmLabel="Débloquer"
        loading={busy}
        onConfirm={handleUnblock}
        onCancel={() => setConfirmUnblock(false)}
      />

      <EphemeralSettingsDialog
        open={openEphemeral}
        currentDuration={ephemeralDuration}
        onClose={() => setOpenEphemeral(false)}
        onConfirm={handleEphemeralConfirm}
      />
    </Layout>
  );
}